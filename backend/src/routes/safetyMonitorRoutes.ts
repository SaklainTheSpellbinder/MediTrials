import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Inject req.user from X-User-Data header (frontend passes localStorage user)
// ──────────────────────────────────────────────────────────────────────────────
router.use((req: any, _res: any, next: any) => {
    try {
        const header = req.headers['x-user-data'];
        if (header) {
            const decoded = Buffer.from(header as string, 'base64').toString('utf-8');
            req.user = JSON.parse(decoded);
        }
    } catch (_) { /* ignore malformed header */ }
    next();
});

// ──────────────────────────────────────────────────────────────────────────────
// Role guard — Safety Monitor only
// ──────────────────────────────────────────────────────────────────────────────
const requireSafetyMonitor = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'Safety_Monitor') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/safety-monitor
// Composite dashboard data built from 9 queries + stored procedures
// ──────────────────────────────────────────────────────────────────────────────
router.get('/safety-monitor', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        // Step 1: Per-trial safety overview from MV
        const overviewRows = await pool.query(
            `SELECT trial_id, trial_title, trial_status, total_ae, grade3plus_ae,
                    total_sae, ae_deaths, total_alerts, active_alerts, total_deviations
             FROM meditrials.mv_safety_overview ORDER BY trial_id`
        );

        // Step 2: Critical/Severe active alert count
        const criticalCount = await pool.query(
            `SELECT COUNT(*) AS cnt FROM meditrials.safety_alerts
             WHERE alert_severity IN ('CRITICAL','SEVERE') AND alert_status = 'ACTIVE'`
        );

        // Step 3: SAE deadline counts
        const saeDeadlines = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE report_deadline_date <= NOW() + INTERVAL '72 hours'
                                 AND sae_status NOT IN ('Reported','Closed')
                                 AND report_submitted_date IS NULL) AS pending_count,
               COUNT(*) FILTER (WHERE report_deadline_date < CURRENT_DATE
                                 AND sae_status NOT IN ('Reported','Closed')
                                 AND report_submitted_date IS NULL) AS overdue_count
             FROM meditrials.serious_adverse_events`
        );

        // Step 4: AE trend this month vs last month
        const aeTrend = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE ae_start_date >= date_trunc('month', CURRENT_DATE)) AS this_month,
               COUNT(*) FILTER (WHERE ae_start_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                  AND ae_start_date < date_trunc('month', CURRENT_DATE)) AS last_month
             FROM meditrials.adverse_events`
        );

        // Step 5: Overdue/at-risk SAE detail rows (up to 10)
        const overdueSaes = await pool.query(
            `SELECT sae.sae_report_number, p.trial_patient_id, ss.institution_name AS site_name,
                    ae.ae_term, ae.severity_grade, sae.report_deadline_date,
                    (CURRENT_DATE - sae.report_deadline_date) AS days_overdue,
                    EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW())) / 3600 AS hours_until_deadline
             FROM meditrials.serious_adverse_events sae
             JOIN meditrials.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN meditrials.patients p ON p.patient_id = ae.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             WHERE sae.report_deadline_date <= CURRENT_DATE + 3
               AND sae.sae_status NOT IN ('Reported','Closed')
               AND sae.report_submitted_date IS NULL
             ORDER BY sae.report_deadline_date ASC
             LIMIT 10`
        );

        // Step 6: Critical alerts feed (most recent 20)
        const alertsFeed = await pool.query(
            `SELECT sa.alert_id, p.trial_patient_id, ss.institution_name AS site_name,
                    sa.alert_code, sa.alert_message, sa.alert_severity, sa.created_at,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.created_at)) / 60)::INT AS minutes_open
             FROM meditrials.safety_alerts sa
             JOIN meditrials.patients p ON p.patient_id = sa.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             WHERE sa.alert_severity IN ('CRITICAL','SEVERE') AND sa.alert_status = 'ACTIVE'
             ORDER BY sa.created_at DESC
             LIMIT 20`
        );

        // Step 7: AE grade breakdown per trial (raw query — mv_ae_by_arm is per term, not grade per trial)
        const gradeByTrial = await pool.query(
            `SELECT ss.trial_id, ct.trial_title,
               COUNT(*) FILTER (WHERE ae.severity_grade = 1) AS grade1,
               COUNT(*) FILTER (WHERE ae.severity_grade = 2) AS grade2,
               COUNT(*) FILTER (WHERE ae.severity_grade = 3) AS grade3,
               COUNT(*) FILTER (WHERE ae.severity_grade = 4) AS grade4,
               COUNT(*) FILTER (WHERE ae.severity_grade = 5) AS grade5
             FROM meditrials.adverse_events ae
             JOIN meditrials.patients p ON p.patient_id = ae.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             JOIN meditrials.clinical_trials ct ON ct.trial_id = ss.trial_id
             WHERE ae.ae_start_date >= NOW() - INTERVAL '30 days'
             GROUP BY ss.trial_id, ct.trial_title ORDER BY ss.trial_id`
        );

        // Step 8: Safety signals for each trial via sp_detect_safety_signals
        const trialIds: number[] = overviewRows.rows.map((r: any) => r.trial_id);
        const allSignals: any[] = [];
        for (const tid of trialIds) {
            try {
                const { rows: sr } = await pool.query(
                    `SELECT signals FROM (CALL meditrials.sp_detect_safety_signals($1, NULL)) AS r`,
                    [tid]
                );
                const signals = sr[0]?.signals ?? [];
                signals.forEach((s: any) => allSignals.push({ ...s, trialId: tid }));
            } catch (_) {
                // Procedure may return empty if no AEs yet
            }
        }
        const topSignals = allSignals
            .sort((a, b) => (b.prr ?? 0) - (a.prr ?? 0))
            .slice(0, 5);

        // Step 9: SAE timeline for pending SAEs
        const saeTimeline = await pool.query(
            `SELECT sae.sae_id, sae.sae_report_number, p.trial_patient_id,
                    ae.ae_term, sae.report_deadline_date, sae.sae_status,
                    EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW())) / 3600 AS hours_until_deadline
             FROM meditrials.serious_adverse_events sae
             JOIN meditrials.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN meditrials.patients p ON p.patient_id = ae.patient_id
             WHERE sae.sae_status IN ('Open','Under Investigation')
             ORDER BY sae.report_deadline_date ASC`
        );

        const thisMonth = parseInt(aeTrend.rows[0].this_month) || 0;
        const lastMonth = parseInt(aeTrend.rows[0].last_month) || 0;

        res.json({
            criticalAlerts: parseInt(criticalCount.rows[0].cnt) || 0,
            pendingSaeCount: parseInt(saeDeadlines.rows[0].pending_count) || 0,
            overdueSaeCount: parseInt(saeDeadlines.rows[0].overdue_count) || 0,
            totalAeThisMonth: thisMonth,
            totalAeLastMonth: lastMonth,
            aeTrend: thisMonth > lastMonth ? 'up' : thisMonth < lastMonth ? 'down' : 'flat',
            trialSafetyOverview: overviewRows.rows,
            overdueSaes: overdueSaes.rows,
            criticalAlertsFeed: alertsFeed.rows,
            aeByGradeByTrial: gradeByTrial.rows,
            topSignals,
            pendingSaeTimeline: saeTimeline.rows,
        });
    } catch (err: any) {
        console.error('Safety Monitor Dashboard Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/safety/alerts
// Paginated alert list with optional filters
// ──────────────────────────────────────────────────────────────────────────────
router.get('/alerts', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { severity, status, site_id, date_from, date_to, page = '1', limit = '25' } = req.query;
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const offset = (pageNum - 1) * limitNum;

        const { rows } = await pool.query(
            `SELECT sa.alert_id, p.trial_patient_id, ss.institution_name AS site_name,
                    sa.alert_code, sa.alert_message, sa.alert_severity, sa.alert_status,
                    sa.created_at,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.created_at)) / 60)::INT AS minutes_open
             FROM meditrials.safety_alerts sa
             JOIN meditrials.patients p ON p.patient_id = sa.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             WHERE ($1::TEXT IS NULL OR sa.alert_severity = $1)
               AND ($2::TEXT IS NULL OR sa.alert_status = $2)
               AND ($3::INT IS NULL OR ss.site_id = $3)
               AND ($4::DATE IS NULL OR sa.created_at::DATE >= $4)
               AND ($5::DATE IS NULL OR sa.created_at::DATE <= $5)
             ORDER BY sa.created_at DESC
             LIMIT $6 OFFSET $7`,
            [
                severity || null,
                status || null,
                site_id ? parseInt(site_id as string) : null,
                date_from || null,
                date_to || null,
                limitNum,
                offset,
            ]
        );

        res.json(rows);
    } catch (err: any) {
        console.error('Safety Alerts List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/safety/alerts/:alertId/acknowledge
// ──────────────────────────────────────────────────────────────────────────────
router.put('/alerts/:alertId/acknowledge', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const alertId = parseInt(req.params.alertId);
        const { reason } = req.body;
        const userId = req.user?.user_id;

        if (!reason) {
            return res.status(400).json({ error: 'reason is required' });
        }

        await pool.query(
            `UPDATE meditrials.safety_alerts
             SET alert_status = 'ACKNOWLEDGED',
                 acknowledged_by_user_id = $1,
                 updated_at = NOW()
             WHERE alert_id = $2`,
            [userId, alertId]
        );

        // Audit log (21 CFR Part 11)
        await pool.query(
            `INSERT INTO meditrials.audit_trail_21cfr
               (table_name, record_id, action_type, new_values, changed_by_user_id, change_reason)
             VALUES ('safety_alerts', $1, 'UPDATE',
                     jsonb_build_object('alert_status','ACKNOWLEDGED','reason',$2),
                     $3, $2)`,
            [alertId, reason, userId]
        );

        res.json({ success: true, message: 'Alert acknowledged' });
    } catch (err: any) {
        console.error('Acknowledge Alert Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/safety/ae
// Paginated AE list with LEFT JOIN to SAEs for report number
// ──────────────────────────────────────────────────────────────────────────────
router.get('/ae', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, patient_id, severity_min, page = '1', limit = '25' } = req.query;
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const offset = (pageNum - 1) * limitNum;

        const { rows } = await pool.query(
            `SELECT ae.ae_id, p.trial_patient_id, ss.institution_name AS site_name,
                    ct.trial_title, ae.ae_term, ae.ae_start_date, ae.ae_end_date,
                    ae.severity_grade, ae.causality_relationship,
                    ae.results_in_death, ae.life_threatening, ae.requires_hospitalization,
                    ae.treatment_related, ae.outcome,
                    sae.sae_report_number, sae.sae_status
             FROM meditrials.adverse_events ae
             JOIN meditrials.patients p ON p.patient_id = ae.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             JOIN meditrials.clinical_trials ct ON ct.trial_id = ss.trial_id
             LEFT JOIN meditrials.serious_adverse_events sae ON sae.ae_id = ae.ae_id
             WHERE ($1::INT IS NULL OR ss.trial_id = $1)
               AND ($2::INT IS NULL OR ae.patient_id = $2)
               AND ($3::INT IS NULL OR ae.severity_grade >= $3)
             ORDER BY ae.ae_start_date DESC
             LIMIT $4 OFFSET $5`,
            [
                trial_id ? parseInt(trial_id as string) : null,
                patient_id ? parseInt(patient_id as string) : null,
                severity_min ? parseInt(severity_min as string) : null,
                limitNum,
                offset,
            ]
        );

        res.json(rows);
    } catch (err: any) {
        console.error('AE List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/safety/sae
// SAE list with joins
// ──────────────────────────────────────────────────────────────────────────────
router.get('/sae', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, sae_status, page = '1', limit = '25' } = req.query;
        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const offset = (pageNum - 1) * limitNum;

        const { rows } = await pool.query(
            `SELECT sae.sae_id, sae.sae_report_number, sae.sae_status,
                    sae.report_deadline_date, sae.report_submitted_date,
                    sae.dsmb_review_date, sae.narrative_text,
                    p.trial_patient_id, ss.institution_name AS site_name,
                    ct.trial_title,
                    ae.ae_term, ae.severity_grade, ae.ae_start_date,
                    ae.results_in_death, ae.life_threatening, ae.requires_hospitalization,
                    (CURRENT_DATE - sae.report_deadline_date) AS days_overdue
             FROM meditrials.serious_adverse_events sae
             JOIN meditrials.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN meditrials.patients p ON p.patient_id = ae.patient_id
             JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
             JOIN meditrials.clinical_trials ct ON ct.trial_id = ss.trial_id
             WHERE ($1::INT IS NULL OR ss.trial_id = $1)
               AND ($2::TEXT IS NULL OR sae.sae_status = $2)
             ORDER BY sae.report_deadline_date ASC NULLS LAST
             LIMIT $3 OFFSET $4`,
            [
                trial_id ? parseInt(trial_id as string) : null,
                sae_status || null,
                limitNum,
                offset,
            ]
        );

        res.json(rows);
    } catch (err: any) {
        console.error('SAE List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/safety/sae/:saeId
// Partial update: sae_status, report_submitted_date, dsmb_review_date, narrative_text
// ──────────────────────────────────────────────────────────────────────────────
router.put('/sae/:saeId', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const saeId = parseInt(req.params.saeId);
        const { sae_status, report_submitted_date, dsmb_review_date, narrative_text } = req.body;

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (sae_status !== undefined) { setClauses.push(`sae_status = $${idx++}`); values.push(sae_status); }
        if (report_submitted_date !== undefined) { setClauses.push(`report_submitted_date = $${idx++}`); values.push(report_submitted_date); }
        if (dsmb_review_date !== undefined) { setClauses.push(`dsmb_review_date = $${idx++}`); values.push(dsmb_review_date); }
        if (narrative_text !== undefined) { setClauses.push(`narrative_text = $${idx++}`); values.push(narrative_text); }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(saeId);

        const { rows } = await pool.query(
            `UPDATE meditrials.serious_adverse_events
             SET ${setClauses.join(', ')}
             WHERE sae_id = $${idx}
             RETURNING *`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'SAE not found' });
        }

        res.json(rows[0]);
    } catch (err: any) {
        console.error('SAE Update Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/safety/signals?trial_id=N
// Calls sp_detect_safety_signals for the given trial
// ──────────────────────────────────────────────────────────────────────────────
router.get('/signals', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const trialId = req.query.trial_id;
        if (!trialId) {
            return res.status(400).json({ error: 'trial_id is required' });
        }

        const { rows } = await pool.query(
            `SELECT signals FROM (CALL meditrials.sp_detect_safety_signals($1, NULL)) AS r`,
            [parseInt(trialId as string)]
        );

        res.json(rows[0]?.signals ?? []);
    } catch (err: any) {
        console.error('Safety Signals Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/safety/reports/generate?trial_id=N&cutoff_date=YYYY-MM-DD
// Calls sp_generate_safety_report
// ──────────────────────────────────────────────────────────────────────────────
router.get('/reports/generate', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, cutoff_date } = req.query;
        if (!trial_id) {
            return res.status(400).json({ error: 'trial_id is required' });
        }
        const cutoff = (cutoff_date as string) ?? new Date().toISOString().split('T')[0];

        const { rows } = await pool.query(
            `SELECT report FROM (CALL meditrials.sp_generate_safety_report($1, $2::DATE, NULL)) AS r`,
            [parseInt(trial_id as string), cutoff]
        );

        res.json(rows[0]?.report ?? null);
    } catch (err: any) {
        console.error('Safety Report Error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
