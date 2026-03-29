import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// ── Inject req.user from X-User-Data header ───────────────────────────────────
router.use((req: any, _res: any, next: any) => {
    try {
        const header = req.headers['x-user-data'];
        if (header) {
            req.user = JSON.parse(Buffer.from(header as string, 'base64').toString('utf-8'));
        }
    } catch (_) { }
    next();
});

const requireSafetyMonitor = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'Safety_Monitor') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

// Helper: set 21 CFR Part 11 session vars on a client
const set21CFRVars = async (client: any, userId: number, reason: string) => {
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    await client.query(`SET LOCAL app.change_reason = '${reason.replace(/'/g, "''")}'`);
};

// ── GET /api/dashboard/safety-monitor ────────────────────────────────────────
router.get('/safety-monitor', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const overviewRows = await pool.query(
            `SELECT trial_id, trial_title, trial_status, total_ae, grade3plus_ae,
                    total_sae, ae_deaths, total_alerts, active_alerts,
                    total_deviations, critical_deviations
             FROM public.mv_safety_overview ORDER BY trial_id`
        );
        const criticalCount = await pool.query(
            `SELECT COUNT(*) AS cnt FROM public.safety_alerts
             WHERE alert_severity IN ('CRITICAL','SEVERE') AND alert_status = 'ACTIVE'`
        );
        const saeDeadlines = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE report_deadline_date <= NOW() + INTERVAL '72 hours'
                                 AND sae_status NOT IN ('Reported','Closed')
                                 AND report_submitted_date IS NULL) AS pending_count,
               COUNT(*) FILTER (WHERE report_deadline_date < CURRENT_DATE
                                 AND sae_status NOT IN ('Reported','Closed')
                                 AND report_submitted_date IS NULL) AS overdue_count
             FROM public.serious_adverse_events`
        );
        const aeTrend = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE ae_start_date >= date_trunc('month', CURRENT_DATE)) AS this_month,
               COUNT(*) FILTER (WHERE ae_start_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                  AND ae_start_date < date_trunc('month', CURRENT_DATE)) AS last_month
             FROM public.adverse_events`
        );
        const overdueSaes = await pool.query(
            `SELECT sae.sae_report_number, p.trial_patient_id, ss.institution_name AS site_name,
                    ae.ae_term, ae.severity_grade, sae.report_deadline_date,
                    (CURRENT_DATE - sae.report_deadline_date) AS days_overdue,
                    EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW())) / 3600 AS hours_until_deadline
             FROM public.serious_adverse_events sae
             JOIN public.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             WHERE sae.report_deadline_date <= CURRENT_DATE + 3
               AND sae.sae_status NOT IN ('Reported','Closed')
               AND sae.report_submitted_date IS NULL
             ORDER BY sae.report_deadline_date ASC LIMIT 10`
        );
        const alertsFeed = await pool.query(
            `SELECT sa.alert_id, p.trial_patient_id, ss.institution_name AS site_name,
                    sa.alert_code, sa.alert_message, sa.alert_severity, sa.created_at,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.created_at)) / 60)::INT AS minutes_open
             FROM public.safety_alerts sa
             JOIN public.patients p ON p.patient_id = sa.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             WHERE sa.alert_severity IN ('CRITICAL','SEVERE') AND sa.alert_status = 'ACTIVE'
             ORDER BY sa.created_at DESC LIMIT 20`
        );
        const gradeByTrial = await pool.query(
            `SELECT ss.trial_id, ct.trial_title,
               COUNT(*) FILTER (WHERE ae.severity_grade = 1) AS grade1,
               COUNT(*) FILTER (WHERE ae.severity_grade = 2) AS grade2,
               COUNT(*) FILTER (WHERE ae.severity_grade = 3) AS grade3,
               COUNT(*) FILTER (WHERE ae.severity_grade = 4) AS grade4,
               COUNT(*) FILTER (WHERE ae.severity_grade = 5) AS grade5
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             WHERE ae.ae_start_date >= NOW() - INTERVAL '30 days'
             GROUP BY ss.trial_id, ct.trial_title ORDER BY ss.trial_id`
        );

        // Complex Query 1 — Safety Monitor dashboard KPIs
        const kpiData = await pool.query(
            `SELECT ct.trial_id, ct.trial_title,
                COUNT(DISTINCT p.patient_id) as total_patients,
                COUNT(DISTINCT ae.ae_id) as total_ae_this_month,
                COUNT(DISTINCT sae.sae_id) FILTER (WHERE sae.sae_status = 'Open') as open_saes,
                COUNT(DISTINCT sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE' AND sa.alert_severity IN ('CRITICAL','SEVERE')) as critical_alerts,
                COUNT(DISTINCT sae.sae_id) FILTER (WHERE sae.report_deadline_date < CURRENT_DATE AND sae.report_submitted_date IS NULL) as overdue_saes
            FROM public.clinical_trials ct
            JOIN public.study_sites ss ON ss.trial_id = ct.trial_id
            JOIN public.patients p ON p.site_id = ss.site_id
            LEFT JOIN public.adverse_events ae ON ae.patient_id = p.patient_id AND ae.ae_start_date >= DATE_TRUNC('month', CURRENT_DATE)
            LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
            LEFT JOIN public.safety_alerts sa ON sa.patient_id = p.patient_id
            GROUP BY ct.trial_id, ct.trial_title`
        );

        // System events log from audit trail (trigger evidence)
        const systemEvents = await pool.query(
            `SELECT at.audit_id, at.table_name, at.action_type, at.change_reason,
                    at.changed_at, at.changed_by_user_id
             FROM public.audit_trail_21cfr at
             WHERE at.action_type = 'INSERT'
             ORDER BY at.changed_at DESC LIMIT 10`
        );

        const trialIds: number[] = overviewRows.rows.map((r: any) => r.trial_id);
        const allSignals: any[] = [];
        for (const tid of trialIds) {
            try {
                // INOUT procedure: pass NULL for the INOUT param; pg returns it in rows[0].signals
                const { rows: sr } = await pool.query(
                    `CALL public.sp_detect_safety_signals($1, NULL::JSONB)`, [tid]
                );
                const sigArray = sr[0]?.signals ?? [];
                (Array.isArray(sigArray) ? sigArray : []).forEach((s: any) =>
                    allSignals.push({ ...s, trialId: tid })
                );
            } catch (_) {
                // Signal detection is non-critical; swallow errors per-trial
            }
        }

        const saeTimeline = await pool.query(
            `SELECT sae.sae_id, sae.sae_report_number, p.trial_patient_id,
                    ae.ae_term, sae.report_deadline_date, sae.sae_status,
                    EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW())) / 3600 AS hours_until_deadline
             FROM public.serious_adverse_events sae
             JOIN public.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN public.patients p ON p.patient_id = ae.patient_id
             WHERE sae.sae_status IN ('Open','Under Investigation')
             ORDER BY sae.report_deadline_date ASC`
        );

        const thisMonth = parseInt(aeTrend.rows[0].this_month) || 0;
        const lastMonth = parseInt(aeTrend.rows[0].last_month) || 0;
        res.json({
            criticalAlerts: parseInt(criticalCount.rows[0].cnt) || 0,
            pendingSaeCount: parseInt(saeDeadlines.rows[0].pending_count) || 0,
            overdueSaeCount: parseInt(saeDeadlines.rows[0].overdue_count) || 0,
            totalAeThisMonth: thisMonth, totalAeLastMonth: lastMonth,
            aeTrend: thisMonth > lastMonth ? 'up' : thisMonth < lastMonth ? 'down' : 'flat',
            trialSafetyOverview: overviewRows.rows,
            overdueSaes: overdueSaes.rows,
            criticalAlertsFeed: alertsFeed.rows,
            aeByGradeByTrial: gradeByTrial.rows,
            topSignals: allSignals.sort((a, b) => (b.prr ?? 0) - (a.prr ?? 0)).slice(0, 5),
            pendingSaeTimeline: saeTimeline.rows,
            trialKpis: kpiData.rows,
            systemEvents: systemEvents.rows,
        });
    } catch (err: any) {
        console.error('Safety Monitor Dashboard Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/patients — cross-site patient list ────────────────────────
router.get('/patients', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { site_id, status, has_alerts, search, date_from, date_to, page = '1', limit = '50' } = req.query;
        const offset = (Math.max(1, parseInt(page as string)) - 1) * Math.min(100, parseInt(limit as string));
        const lim = Math.min(100, parseInt(limit as string));
        const { rows } = await pool.query(
            `SELECT p.patient_id, p.trial_patient_id, p.date_of_birth, p.gender, p.patient_status,
                    p.enrollment_date, p.site_id, p.created_at,
                    ss.institution_name, ss.country, ss.trial_id,
                    ct.trial_title,
                    ta.arm_code,
                    COUNT(sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE') as active_alert_count,
                    MAX(sa.alert_severity) FILTER (WHERE sa.alert_status = 'ACTIVE') as max_alert_severity,
                    MAX(pv.visit_date) as last_visit_date,
                    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INT as age
             FROM public.patients p
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             LEFT JOIN public.randomization_assignments ra ON ra.patient_id = p.patient_id
             LEFT JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
             LEFT JOIN public.safety_alerts sa ON sa.patient_id = p.patient_id
             LEFT JOIN public.patient_visits pv ON pv.patient_id = p.patient_id
             WHERE ($1::INT IS NULL OR p.site_id = $1)
               AND ($2::TEXT IS NULL OR p.patient_status = $2)
               AND ($3::TEXT IS NULL OR p.trial_patient_id ILIKE '%' || $3 || '%')
               AND ($4::DATE IS NULL OR p.enrollment_date >= $4)
               AND ($5::DATE IS NULL OR p.enrollment_date <= $5)
             GROUP BY p.patient_id, ss.institution_name, ss.country, ss.trial_id,
                      ct.trial_title, ta.arm_code
             HAVING ($6::BOOLEAN IS NULL OR (NOT $6) OR COUNT(sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE') > 0)
             ORDER BY p.created_at DESC
             LIMIT $7 OFFSET $8`,
            [
                site_id ? parseInt(site_id as string) : null,
                status || null,
                search || null,
                date_from || null,
                date_to || null,
                has_alerts === 'true' ? true : null,
                lim, offset,
            ]
        );
        res.json(rows);
    } catch (err: any) {
        console.error('SM Patients Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/patients/:patientId/ae-summary — uses DB function ─────────
router.get('/patients/:patientId/ae-summary', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM public.get_patient_ae_summary($1)`,
            [parseInt(req.params.patientId)]
        );
        res.json(rows[0] ?? {});
    } catch (err: any) {
        console.error('AE Summary Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/alerts ────────────────────────────────────────────────────
router.get('/alerts', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { severity, status, site_id, date_from, date_to, page = '1', limit = '50' } = req.query;
        const offset = (Math.max(1, parseInt(page as string)) - 1) * Math.min(100, parseInt(limit as string));
        const lim = Math.min(100, parseInt(limit as string));
        const { rows } = await pool.query(
            `SELECT sa.alert_id, sa.patient_id, p.trial_patient_id, ss.institution_name AS site_name,
                    sa.alert_code, sa.alert_message, sa.alert_severity, sa.alert_status,
                    sa.source_type, sa.source_record_id, sa.escalation_level, sa.escalated_at,
                    sa.acknowledged_by_user_id, sa.created_at,
                    EXTRACT(EPOCH FROM (NOW() - sa.created_at))/3600 AS hours_open,
                    lr.test_value, lr.reference_range_low, lr.reference_range_high, lr.critical_result_flag,
                    lt.test_name
             FROM public.safety_alerts sa
             JOIN public.patients p ON p.patient_id = sa.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             LEFT JOIN public.lab_results lr ON lr.lab_result_id = sa.source_record_id AND sa.source_type = 'LAB_RESULT'
             LEFT JOIN public.laboratory_tests lt ON lt.test_id = lr.test_id
             WHERE ($1::TEXT IS NULL OR sa.alert_severity = $1)
               AND ($2::TEXT IS NULL OR sa.alert_status = $2)
               AND ($3::INT IS NULL OR ss.site_id = $3)
               AND ($4::DATE IS NULL OR sa.created_at::DATE >= $4)
               AND ($5::DATE IS NULL OR sa.created_at::DATE <= $5)
             ORDER BY
               CASE sa.alert_severity WHEN 'CRITICAL' THEN 1 WHEN 'SEVERE' THEN 2 WHEN 'WARNING' THEN 3 ELSE 4 END,
               sa.created_at ASC
             LIMIT $6 OFFSET $7`,
            [severity || null, status || null, site_id ? parseInt(site_id as string) : null,
            date_from || null, date_to || null, lim, offset]
        );

        // KPI counts
        const counts = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE alert_status = 'ACTIVE') as total_active,
               COUNT(*) FILTER (WHERE alert_status = 'ACTIVE' AND alert_severity = 'CRITICAL') as critical,
               COUNT(*) FILTER (WHERE alert_status = 'ACTIVE' AND alert_severity = 'SEVERE') as severe,
               COUNT(*) FILTER (WHERE alert_status = 'ACTIVE' AND alert_severity = 'WARNING') as warning,
               COUNT(*) FILTER (WHERE alert_status = 'ACTIVE' AND alert_severity = 'INFO') as info
             FROM public.safety_alerts`
        );
        res.json({ alerts: rows, kpis: counts.rows[0] });
    } catch (err: any) {
        console.error('Safety Alerts Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/safety/alerts/:alertId/acknowledge ───────────────────────────────
router.put('/alerts/:alertId/acknowledge', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const alertId = parseInt(req.params.alertId);
        const { reason } = req.body;
        const userId = req.user?.user_id;
        if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'reason required' }); }
        await set21CFRVars(client, userId, reason);
        await client.query(
            `UPDATE public.safety_alerts SET alert_status='ACKNOWLEDGED', acknowledged_by_user_id=$1, updated_at=NOW() WHERE alert_id=$2`,
            [userId, alertId]
        );
        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,new_values,changed_by_user_id,change_reason)
             VALUES ('safety_alerts',$1,'UPDATE',jsonb_build_object('alert_status','ACKNOWLEDGED','reason',$2),$3,$2)`,
            [alertId, reason, userId]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Acknowledge Error:', err);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── PUT /api/safety/alerts/:alertId/escalate ──────────────────────────────────
router.put('/alerts/:alertId/escalate', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const alertId = parseInt(req.params.alertId);
        const { escalation_level, reason } = req.body;
        const userId = req.user?.user_id;
        if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'reason required' }); }
        await set21CFRVars(client, userId, reason);
        await client.query(
            `UPDATE public.safety_alerts
             SET escalation_level = COALESCE($1, escalation_level + 1),
                 escalated_at = NOW(), alert_status = 'ESCALATED', updated_at = NOW()
             WHERE alert_id = $2`,
            [escalation_level ?? null, alertId]
        );
        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,new_values,changed_by_user_id,change_reason)
             VALUES ('safety_alerts',$1,'UPDATE',jsonb_build_object('action','ESCALATED','reason',$2),$3,$2)`,
            [alertId, reason, userId]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── PUT /api/safety/alerts/:alertId/dismiss ───────────────────────────────────
router.put('/alerts/:alertId/dismiss', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const alertId = parseInt(req.params.alertId);
        const { reason } = req.body;
        const userId = req.user?.user_id;
        if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'reason required' }); }
        await set21CFRVars(client, userId, reason);
        await client.query(
            `UPDATE public.safety_alerts SET alert_status='DISMISSED', updated_at=NOW() WHERE alert_id=$1`,
            [alertId]
        );
        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,new_values,changed_by_user_id,change_reason)
             VALUES ('safety_alerts',$1,'UPDATE',jsonb_build_object('alert_status','DISMISSED','reason',$2),$3,$2)`,
            [alertId, reason, userId]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── GET /api/safety/ae ────────────────────────────────────────────────────────
router.get('/ae', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, site_id, severity_min, severity_max, causality, sae_only, treatment_related, date_from, date_to, page = '1', limit = '50' } = req.query;
        const offset = (Math.max(1, parseInt(page as string)) - 1) * Math.min(100, parseInt(limit as string));
        const lim = Math.min(100, parseInt(limit as string));
        const { rows } = await pool.query(
            `SELECT ae.ae_id, ae.patient_id, p.trial_patient_id, ss.institution_name AS site_name,
                    ct.trial_title, ct.trial_id, ae.ae_term, ae.ae_start_date, ae.ae_end_date,
                    ae.severity_grade, ae.causality_relationship, ae.outcome,
                    ae.results_in_death, ae.life_threatening, ae.requires_hospitalization,
                    ae.treatment_related, ae.status,
                    sae.sae_id, sae.sae_report_number, sae.sae_status, sae.report_deadline_date
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
             WHERE ($1::INT IS NULL OR ss.trial_id = $1)
               AND ($2::INT IS NULL OR p.site_id = $2)
               AND ($3::INT IS NULL OR ae.severity_grade >= $3)
               AND ($4::INT IS NULL OR ae.severity_grade <= $4)
               AND ($5::TEXT IS NULL OR ae.causality_relationship = $5)
               AND ($6::BOOLEAN IS NULL OR (NOT $6) OR sae.sae_id IS NOT NULL)
               AND ($7::BOOLEAN IS NULL OR (NOT $7) OR ae.treatment_related = TRUE)
               AND ($8::DATE IS NULL OR ae.ae_start_date >= $8)
               AND ($9::DATE IS NULL OR ae.ae_start_date <= $9)
             ORDER BY ae.ae_start_date DESC
             LIMIT $10 OFFSET $11`,
            [
                trial_id ? parseInt(trial_id as string) : null,
                site_id ? parseInt(site_id as string) : null,
                severity_min ? parseInt(severity_min as string) : null,
                severity_max ? parseInt(severity_max as string) : null,
                causality || null,
                sae_only === 'true' ? true : null,
                treatment_related === 'true' ? true : null,
                date_from || null, date_to || null, lim, offset,
            ]
        );
        res.json(rows);
    } catch (err: any) {
        console.error('AE List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/ae/:aeId ──────────────────────────────────────────────────
router.get('/ae/:aeId', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT ae.*, p.trial_patient_id, ss.institution_name AS site_name, ct.trial_title,
                    sae.sae_id, sae.sae_report_number, sae.sae_status, sae.report_deadline_date,
                    sae.report_submitted_date, sae.narrative_text, sae.dsmb_review_date
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
             WHERE ae.ae_id = $1`, [parseInt(req.params.aeId)]
        );
        if (!rows.length) return res.status(404).json({ error: 'AE not found' });

        const alerts = await pool.query(
            `SELECT * FROM public.safety_alerts WHERE patient_id = $1 ORDER BY created_at ASC`,
            [rows[0].patient_id]
        );
        res.json({ ...rows[0], relatedAlerts: alerts.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/safety/ae/:aeId — update causality/outcome only ─────────────────
router.put('/ae/:aeId', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const aeId = parseInt(req.params.aeId);
        const { causality_relationship, outcome, reason } = req.body;
        const userId = req.user?.user_id;
        if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'reason required for 21 CFR Part 11' }); }
        await set21CFRVars(client, userId, reason);

        const oldRow = await client.query(`SELECT causality_relationship, outcome FROM public.adverse_events WHERE ae_id=$1`, [aeId]);
        const { rows } = await client.query(
            `UPDATE public.adverse_events
             SET causality_relationship = COALESCE($1, causality_relationship),
                 outcome = COALESCE($2, outcome),
                 updated_at = NOW()
             WHERE ae_id = $3 RETURNING *`,
            [causality_relationship ?? null, outcome ?? null, aeId]
        );
        if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'AE not found' }); }

        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,old_values,new_values,changed_by_user_id,change_reason)
             VALUES ('adverse_events',$1,'UPDATE',$2,$3,$4,$5)`,
            [aeId, JSON.stringify(oldRow.rows[0]),
                JSON.stringify({ causality_relationship, outcome }), userId, reason]
        );
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── GET /api/safety/sae ───────────────────────────────────────────────────────
router.get('/sae', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, sae_status, page = '1', limit = '50' } = req.query;
        const offset = (Math.max(1, parseInt(page as string)) - 1) * Math.min(100, parseInt(limit as string));
        const lim = Math.min(100, parseInt(limit as string));

        const { rows } = await pool.query(
            `SELECT sae.sae_id, sae.sae_report_number, sae.sae_status,
                    sae.report_deadline_date, sae.report_submitted_date,
                    sae.dsmb_review_date, sae.narrative_text,
                    sae.fda_submitted_date, sae.ema_submitted_date, sae.irb_submitted_date,
                    p.trial_patient_id, ss.institution_name AS site_name, ct.trial_title,
                    ae.ae_term, ae.severity_grade, ae.ae_start_date,
                    ae.results_in_death, ae.life_threatening, ae.requires_hospitalization,
                    ae.causality_relationship, ae.ae_id,
                    (CURRENT_DATE - sae.report_deadline_date) AS days_overdue,
                    EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW()))/3600 AS hours_until_deadline
             FROM public.serious_adverse_events sae
             JOIN public.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             WHERE ($1::INT IS NULL OR ss.trial_id = $1)
               AND ($2::TEXT IS NULL OR sae.sae_status = $2)
             ORDER BY sae.report_deadline_date ASC NULLS LAST
             LIMIT $3 OFFSET $4`,
            [trial_id ? parseInt(trial_id as string) : null, sae_status || null, lim, offset]
        );

        // Tab counts
        const tabCounts = await pool.query(
            `SELECT sae_status, COUNT(*) as cnt FROM public.serious_adverse_events GROUP BY sae_status`
        );
        res.json({ saes: rows, tabCounts: tabCounts.rows });
    } catch (err: any) {
        console.error('SAE List Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/sae/:saeId ────────────────────────────────────────────────
router.get('/sae/:saeId', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT sae.*, p.trial_patient_id, ss.institution_name AS site_name, ct.trial_title,
                    ae.ae_term, ae.severity_grade, ae.ae_start_date, ae.ae_end_date,
                    ae.results_in_death, ae.life_threatening, ae.requires_hospitalization,
                    ae.causality_relationship, ae.outcome, ae.treatment_related,
                    ra.awareness_date
             FROM public.serious_adverse_events sae
             JOIN public.adverse_events ae ON ae.ae_id = sae.ae_id
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             JOIN public.clinical_trials ct ON ct.trial_id = ss.trial_id
             LEFT JOIN (SELECT ae_id, MIN(created_at)::DATE AS awareness_date FROM public.audit_trail_21cfr WHERE table_name='adverse_events' GROUP BY ae_id) ra ON ra.ae_id = ae.ae_id
             WHERE sae.sae_id = $1`, [parseInt(req.params.saeId)]
        );
        if (!rows.length) return res.status(404).json({ error: 'SAE not found' });
        res.json(rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/safety/sae/:saeId ────────────────────────────────────────────────
router.put('/sae/:saeId', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const saeId = parseInt(req.params.saeId);
        const { sae_status, report_submitted_date, dsmb_review_date, narrative_text,
            fda_submitted_date, ema_submitted_date, irb_submitted_date, reason } = req.body;
        const userId = req.user?.user_id;
        if (!reason) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'reason required' }); }
        await set21CFRVars(client, userId, reason);

        const setClauses: string[] = []; const values: any[] = []; let idx = 1;
        if (sae_status !== undefined) { setClauses.push(`sae_status=$${idx++}`); values.push(sae_status); }
        if (report_submitted_date !== undefined) { setClauses.push(`report_submitted_date=$${idx++}`); values.push(report_submitted_date); }
        if (dsmb_review_date !== undefined) { setClauses.push(`dsmb_review_date=$${idx++}`); values.push(dsmb_review_date); }
        if (narrative_text !== undefined) { setClauses.push(`narrative_text=$${idx++}`); values.push(narrative_text); }
        if (fda_submitted_date !== undefined) { setClauses.push(`fda_submitted_date=$${idx++}`); values.push(fda_submitted_date); }
        if (ema_submitted_date !== undefined) { setClauses.push(`ema_submitted_date=$${idx++}`); values.push(ema_submitted_date); }
        if (irb_submitted_date !== undefined) { setClauses.push(`irb_submitted_date=$${idx++}`); values.push(irb_submitted_date); }
        if (!setClauses.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No fields to update' }); }

        setClauses.push(`updated_at=NOW()`); values.push(saeId);
        const { rows } = await client.query(
            `UPDATE public.serious_adverse_events SET ${setClauses.join(',')} WHERE sae_id=$${idx} RETURNING *`, values
        );
        if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'SAE not found' }); }

        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,new_values,changed_by_user_id,change_reason)
             VALUES ('serious_adverse_events',$1,'UPDATE',$2::jsonb,$3,$4)`,
            [saeId, JSON.stringify({ sae_status, report_submitted_date }), userId, reason]
        );
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── GET /api/safety/signals ───────────────────────────────────────────────────
router.get('/signals', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const trialId = req.query.trial_id;
        if (!trialId) return res.status(400).json({ error: 'trial_id required' });
        const { rows } = await pool.query(
            `SELECT signals FROM (CALL public.sp_detect_safety_signals($1, NULL)) AS r`,
            [parseInt(trialId as string)]
        );
        res.json(rows[0]?.signals ?? []);
    } catch (err: any) {
        console.error('Signals Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/signals/drilldown?ae_term=X&trial_id=Y ───────────────────
router.get('/signals/drilldown', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { ae_term, trial_id } = req.query;
        const { rows } = await pool.query(
            `SELECT ae.ae_id, p.trial_patient_id, ss.institution_name AS site_name,
                    ae.ae_start_date, ae.severity_grade, ae.causality_relationship,
                    EXTRACT(DAY FROM ae.ae_start_date - p.enrollment_date)::INT AS days_from_enrollment
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             WHERE ae.ae_term = $1 AND ($2::INT IS NULL OR ss.trial_id = $2)
             ORDER BY ae.ae_start_date DESC`, [ae_term, trial_id ? parseInt(trial_id as string) : null]
        );

        // AE trend for signal page (Complex Query 2 — window functions)
        const trend = await pool.query(
            `SELECT ae.ae_term, DATE_TRUNC('week', ae.ae_start_date) as week,
                    COUNT(*) as count_this_week,
                    SUM(COUNT(*)) OVER (PARTITION BY ae.ae_term ORDER BY DATE_TRUNC('week', ae.ae_start_date)) as cumulative_count,
                    AVG(ae.severity_grade) as avg_severity,
                    COUNT(*) FILTER (WHERE ae.severity_grade >= 3) as grade3plus
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             WHERE ae.ae_term = $1 AND ($2::INT IS NULL OR ss.trial_id = $2)
               AND ae.ae_start_date >= CURRENT_DATE - INTERVAL '90 days'
             GROUP BY ae.ae_term, DATE_TRUNC('week', ae.ae_start_date)
             ORDER BY week`, [ae_term, trial_id ? parseInt(trial_id as string) : null]
        );
        res.json({ aes: rows, trend: trend.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/site-comparison?trial_id=N (Complex Query 3) ──────────────
router.get('/site-comparison', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id } = req.query;
        if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
        const { rows } = await pool.query(
            `SELECT ss.institution_name, ss.country,
                    COUNT(DISTINCT p.patient_id) as patient_count,
                    COUNT(DISTINCT ae.ae_id) as total_ae,
                    ROUND(COUNT(DISTINCT ae.ae_id)::DECIMAL / NULLIF(COUNT(DISTINCT p.patient_id),0),2) as ae_per_patient,
                    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.severity_grade >= 3) as grade3plus,
                    COUNT(DISTINCT pd.deviation_id) as protocol_deviations,
                    COUNT(DISTINCT sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE') as active_alerts,
                    RANK() OVER (ORDER BY COUNT(DISTINCT ae.ae_id)::DECIMAL / NULLIF(COUNT(DISTINCT p.patient_id),0) DESC) as safety_risk_rank
             FROM public.study_sites ss
             LEFT JOIN public.patients p ON p.site_id = ss.site_id
             LEFT JOIN public.adverse_events ae ON ae.patient_id = p.patient_id
             LEFT JOIN public.protocol_deviations pd ON pd.patient_id = p.patient_id
             LEFT JOIN public.safety_alerts sa ON sa.patient_id = p.patient_id
             WHERE ss.trial_id = $1
             GROUP BY ss.site_id, ss.institution_name, ss.country
             ORDER BY safety_risk_rank`, [parseInt(trial_id as string)]
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/dsmb ─────────────────────────────────────────────────────
router.get('/dsmb', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT dm.*, ct.trial_title
             FROM public.dsmb_meetings dm
             JOIN public.clinical_trials ct ON ct.trial_id = dm.trial_id
             ORDER BY dm.meeting_date DESC`
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/safety/dsmb ────────────────────────────────────────────────────
router.post('/dsmb', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { trial_id, meeting_date, meeting_type, data_cutoff_date } = req.body;
        const userId = req.user?.user_id;
        await set21CFRVars(client, userId, 'DSMB meeting scheduled');
        const { rows } = await client.query(
            `INSERT INTO public.dsmb_meetings (trial_id, meeting_date, meeting_type, data_cutoff_date, created_by_user_id)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [trial_id, meeting_date, meeting_type, data_cutoff_date, userId]
        );
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── GET /api/safety/dsmb/:meetingId ──────────────────────────────────────────
router.get('/dsmb/:meetingId', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT dm.*, ct.trial_title FROM public.dsmb_meetings dm
             JOIN public.clinical_trials ct ON ct.trial_id = dm.trial_id
             WHERE dm.meeting_id = $1`, [parseInt(req.params.meetingId)]
        );
        if (!rows.length) return res.status(404).json({ error: 'Meeting not found' });

        // Safety snapshot at cutoff
        const snapshot = await pool.query(
            `SELECT * FROM public.mv_safety_overview WHERE trial_id = $1`, [rows[0].trial_id]
        );
        res.json({ ...rows[0], safetySnapshot: snapshot.rows[0] ?? null });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/safety/dsmb/:meetingId ──────────────────────────────────────────
router.put('/dsmb/:meetingId', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const meetingId = parseInt(req.params.meetingId);
        const { recommendation, meeting_minutes } = req.body;
        const userId = req.user?.user_id;
        await set21CFRVars(client, userId, 'DSMB recommendation update');
        const { rows } = await client.query(
            `UPDATE public.dsmb_meetings
             SET recommendation = COALESCE($1, recommendation),
                 meeting_minutes = COALESCE($2::jsonb, meeting_minutes),
                 updated_at = NOW()
             WHERE meeting_id = $3 RETURNING *`,
            [recommendation ?? null, meeting_minutes ? JSON.stringify(meeting_minutes) : null, meetingId]
        );
        if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Meeting not found' }); }
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── GET /api/safety/unblinding/:patientId ────────────────────────────────────
router.get('/unblinding/:patientId', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.patient_id, p.trial_patient_id, p.patient_status, p.enrollment_date,
                    p.site_id, ss.institution_name,
                    ra.is_unblinded, ra.unblinding_reason, ra.unblinded_at,
                    ta.arm_code, ta.arm_name, ta.arm_description,
                    ra.unblinded_by_user_id
             FROM public.patients p
             JOIN public.study_sites ss ON ss.site_id = p.site_id
             LEFT JOIN public.randomization_assignments ra ON ra.patient_id = p.patient_id
             LEFT JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id AND ra.is_unblinded = TRUE
             WHERE p.patient_id = $1 OR p.trial_patient_id = $1::TEXT`, [req.params.patientId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

        const history = await pool.query(
            `SELECT * FROM public.audit_trail_21cfr
             WHERE table_name='randomization_assignments' AND record_id=$1 AND action_type='UPDATE'
             ORDER BY changed_at DESC`, [rows[0].patient_id]
        );
        res.json({ patient: rows[0], history: history.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/safety/unblind ─────────────────────────────────────────────────
router.post('/unblind', requireSafetyMonitor, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { patient_id, reason, justification_category, requesting_physician } = req.body;
        const userId = req.user?.user_id;
        if (!reason || reason.length < 100) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Reason must be at least 100 characters' });
        }
        await set21CFRVars(client, userId, reason);
        // Call stored procedure
        await client.query(
            `CALL public.sp_unblind_patient($1, $2, $3)`,
            [patient_id, reason, userId]
        );
        // Record additional details in audit
        await client.query(
            `INSERT INTO public.audit_trail_21cfr (table_name,record_id,action_type,new_values,changed_by_user_id,change_reason)
             VALUES ('randomization_assignments',$1,'UPDATE',jsonb_build_object('action','UNBLINDED','justification_category',$2,'requesting_physician',$3),$4,$5)`,
            [patient_id, justification_category, requesting_physician, userId, reason]
        );
        // Fetch result
        const { rows } = await client.query(
            `SELECT ra.is_unblinded, ta.arm_code, ta.arm_name, ta.arm_description, ra.unblinded_at
             FROM public.randomization_assignments ra
             JOIN public.treatment_arms ta ON ta.arm_id = ra.arm_id
             WHERE ra.patient_id = $1`, [patient_id]
        );
        await client.query('COMMIT');
        res.json({ success: true, result: rows[0] ?? null });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// ── POST /api/safety/verify-password ─────────────────────────────────────────
router.post('/verify-password', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { password } = req.body;
        const username = req.user?.username;
        if (!password || !username) return res.status(400).json({ error: 'Missing credentials' });
        const { rows } = await pool.query(
            `SELECT user_id FROM public.users WHERE username=$1 AND password_hash=crypt($2,password_hash) AND is_active=TRUE`,
            [username, password]
        );
        if (!rows.length) return res.status(401).json({ verified: false });
        res.json({ verified: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/reports/generate ─────────────────────────────────────────
router.get('/reports/generate', requireSafetyMonitor, async (req: any, res: any) => {
    try {
        const { trial_id, cutoff_date } = req.query;
        if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
        const cutoff = (cutoff_date as string) ?? new Date().toISOString().split('T')[0];

        const { rows } = await pool.query(
            `SELECT report FROM (CALL public.sp_generate_safety_report($1, $2::DATE, NULL)) AS r`,
            [parseInt(trial_id as string), cutoff]
        );

        // Augment with AE by arm from mv_ae_by_arm
        const byArm = await pool.query(
            `SELECT arm_code, ae_term, occurrence_count, avg_severity, grade3plus_count
             FROM public.mv_ae_by_arm WHERE trial_id=$1 ORDER BY occurrence_count DESC LIMIT 20`,
            [parseInt(trial_id as string)]
        );

        // AE by severity grade
        const bySeverity = await pool.query(
            `SELECT severity_grade, COUNT(*) as count FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id=ae.patient_id
             JOIN public.study_sites ss ON ss.site_id=p.site_id
             WHERE ss.trial_id=$1 AND ae.ae_start_date<=$2::DATE
             GROUP BY severity_grade ORDER BY severity_grade`, [parseInt(trial_id as string), cutoff]
        );

        // Protocol deviations
        const deviations = await pool.query(
            `SELECT deviation_type, COUNT(*) as count FROM public.protocol_deviations pd
             JOIN public.patients p ON p.patient_id=pd.patient_id
             JOIN public.study_sites ss ON ss.site_id=p.site_id
             WHERE ss.trial_id=$1 GROUP BY deviation_type`, [parseInt(trial_id as string)]
        );

        res.json({
            report: rows[0]?.report ?? null,
            aeByArm: byArm.rows,
            aeBySeverity: bySeverity.rows,
            deviations: deviations.rows,
            cutoff_date: cutoff,
        });
    } catch (err: any) {
        console.error('Safety Report Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/trials — list all trials for selectors ───────────────────
router.get('/trials', requireSafetyMonitor, async (_req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT trial_id, trial_title, trial_status FROM public.clinical_trials ORDER BY trial_title`
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/safety/sites — list all sites for selectors ─────────────────────
router.get('/sites', requireSafetyMonitor, async (_req: any, res: any) => {
    try {
        const { rows } = await pool.query(
            `SELECT site_id, institution_name, country, trial_id FROM public.study_sites ORDER BY institution_name`
        );
        res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
