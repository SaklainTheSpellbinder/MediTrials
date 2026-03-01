import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function decodeUser(req: Request, res: Response): any | null {
    const header = req.headers['x-user-data'];
    if (!header) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    try { return JSON.parse(Buffer.from(header as string, 'base64').toString('utf8')); }
    catch { res.status(401).json({ error: 'Unauthorized' }); return null; }
}

async function auditLog(tableName: string, recordId: number, action: string, newValues: any, userId: number, reason: string) {
    try {
        await pool.query(`
            INSERT INTO meditrials.audit_trail_21cfr
                (table_name, record_id, column_name, action_type, new_value, changed_by_user_id, change_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [tableName, recordId, '__json__', action, JSON.stringify(newValues), userId, reason]);
    } catch (e: any) {
        console.warn('audit log warning:', e.message);
    }
}

async function refreshMVs() {
    await pool.query(`SELECT meditrials.refresh_all_materialized_views()`);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
// Inject req.user from X-User-Data header — non-blocking (just extracts user)
router.use((req: Request, _res: Response, next) => {
    const header = req.headers['x-user-data'];
    if (header) {
        try { (req as any).user = JSON.parse(Buffer.from(header as string, 'base64').toString('utf8')); }
        catch { /* ignore malformed */ }
    }
    next();
});

// Per-route guard: only System_Admin passes
const requireAdmin = (req: Request, res: Response, next: any) => {
    const u = (req as any).user;
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    if (u.role !== 'System_Admin') return res.status(403).json({ error: 'Forbidden — System Admin only' });
    next();
};

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
    try {
        // Step 1: Trial portfolio
        const trialsRaw = await pool.query(`
            SELECT ct.trial_id, ct.trial_nct_id, ct.trial_title, ct.trial_phase,
                   ct.trial_status, ct.therapeutic_area, ct.start_date,
                   ct.estimated_completion_date, ct.target_enrollment,
                   COUNT(DISTINCT ss.site_id) AS site_count
            FROM meditrials.clinical_trials ct
            LEFT JOIN meditrials.study_sites ss ON ss.trial_id = ct.trial_id
            GROUP BY ct.trial_id, ct.trial_nct_id, ct.trial_title, ct.trial_phase,
                     ct.trial_status, ct.therapeutic_area, ct.start_date,
                     ct.estimated_completion_date, ct.target_enrollment
            ORDER BY ct.trial_id
        `);

        const enrollmentByTrial = await pool.query(`
            SELECT trial_id,
                   SUM(current_enrollment)  AS current_enrollment,
                   SUM(target_enrollment)   AS target_enrollment,
                   ROUND(SUM(current_enrollment)::DECIMAL / NULLIF(SUM(target_enrollment),0) * 100, 1) AS enrollment_pct
            FROM meditrials.mv_site_enrollment GROUP BY trial_id
        `);
        const enrollMap: Record<number, any> = Object.fromEntries(enrollmentByTrial.rows.map((r: any) => [r.trial_id, r]));

        // mv_safety_overview — graceful fallback if MV doesn't exist yet
        let safetyOverviewRows: any[] = [];
        try {
            const sovRes = await pool.query(`SELECT * FROM meditrials.mv_safety_overview`);
            safetyOverviewRows = sovRes.rows;
        } catch { /* MV may not exist or be empty */ }
        const safetyMap: Record<number, any> = Object.fromEntries(safetyOverviewRows.map((r: any) => [r.trial_id, r]));

        // sp_calculate_enrollment_metrics — only for active/recruiting
        const activeTrials = trialsRaw.rows.filter((t: any) => ['Active', 'Recruiting'].includes(t.trial_status));
        const metricsMap: Record<number, any> = {};
        for (const trial of activeTrials) {
            try {
                const { rows: mr } = await pool.query(`
                    SELECT total_enrolled, screening_failure_rate, enrollment_velocity, projected_completion
                    FROM (CALL meditrials.sp_calculate_enrollment_metrics($1, NULL, NULL, NULL, NULL, NULL)) AS r
                `, [trial.trial_id]);
                metricsMap[trial.trial_id] = mr[0] ?? {};
            } catch { metricsMap[trial.trial_id] = {}; }
        }

        const trialPortfolio = trialsRaw.rows.map((t: any) => ({
            ...t,
            currentEnrollment: parseInt(enrollMap[t.trial_id]?.current_enrollment ?? 0),
            enrollmentPct: parseFloat(enrollMap[t.trial_id]?.enrollment_pct ?? 0),
            enrollmentVelocity: metricsMap[t.trial_id]?.enrollment_velocity ?? null,
            projectedCompletion: metricsMap[t.trial_id]?.projected_completion ?? null,
            screenFailureRate: metricsMap[t.trial_id]?.screening_failure_rate ?? null,
            activeAlerts: parseInt(safetyMap[t.trial_id]?.active_alerts ?? 0),
            totalSae: parseInt(safetyMap[t.trial_id]?.total_sae ?? 0),
            criticalDeviations: parseInt(safetyMap[t.trial_id]?.critical_deviations ?? 0),
        }));

        // Step 2: System health KPIs
        const [systemHealth, userActivity, recentAudit, dataQuality] = await Promise.all([
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM meditrials.clinical_trials WHERE trial_status IN ('Active','Recruiting')) AS active_trials,
                    (SELECT COUNT(*) FROM meditrials.users WHERE is_active = TRUE) AS active_users,
                    (SELECT COUNT(*) FROM meditrials.patients) AS total_patients,
                    (SELECT COUNT(*) FROM meditrials.safety_alerts
                     WHERE alert_severity IN ('CRITICAL','SEVERE')
                       AND alert_status = 'ACTIVE') AS unacknowledged_critical_alerts,
                    (SELECT COUNT(*) FROM meditrials.data_locks WHERE unlock_date IS NULL) AS active_locks
            `),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE last_login::DATE = CURRENT_DATE)                    AS logged_in_today,
                    COUNT(*) FILTER (WHERE last_login >= CURRENT_DATE - 7)                     AS logged_in_7d,
                    COUNT(*) FILTER (WHERE last_login IS NULL OR last_login < CURRENT_DATE - 90) AS inactive_users,
                    0 AS failed_logins_24h
                FROM meditrials.users WHERE is_active = TRUE
            `),
            pool.query(`
                SELECT at.audit_id, at.table_name, at.record_id, at.action_type,
                       at.new_value AS new_values, at.change_reason, at.change_timestamp, u.username AS changed_by
                FROM meditrials.audit_trail_21cfr at
                LEFT JOIN meditrials.users u ON u.user_id = at.changed_by_user_id
                WHERE at.table_name IN ('users','clinical_trials','study_sites','data_locks','study_protocols')
                ORDER BY at.change_timestamp DESC LIMIT 20
            `),
            pool.query(`
                SELECT trial_id,
                    COUNT(*) AS total_patients,
                    ROUND(SUM(signed_forms)::DECIMAL / NULLIF(SUM(total_forms),0) * 100, 1) AS signed_pct,
                    COALESCE(SUM(open_queries),0) AS total_open_queries
                FROM meditrials.mv_data_quality GROUP BY trial_id ORDER BY trial_id
            `),
        ]);

        const h = systemHealth.rows[0];
        res.json({
            activeTrials: parseInt(h.active_trials),
            activeUsers: parseInt(h.active_users),
            totalPatients: parseInt(h.total_patients),
            unacknowledgedCritical: parseInt(h.unacknowledged_critical_alerts),
            activeLocks: parseInt(h.active_locks),
            trialPortfolio,
            userActivity: userActivity.rows[0],
            recentAdminActivity: recentAudit.rows,
            dataQualitySummary: dataQuality.rows,
        });
    } catch (err: any) {
        console.error('Admin dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════
// TRIAL MANAGEMENT
// ═══════════════════════════════════════════════════════
router.get('/trials', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT ct.*, COUNT(DISTINCT ss.site_id) AS site_count,
                   COALESCE(SUM(mse.current_enrollment),0) AS current_enrollment
            FROM meditrials.clinical_trials ct
            LEFT JOIN meditrials.study_sites ss ON ss.trial_id = ct.trial_id
            LEFT JOIN meditrials.mv_site_enrollment mse ON mse.trial_id = ct.trial_id
            GROUP BY ct.trial_id ORDER BY ct.trial_id
        `);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { trial_nct_id, trial_title, trial_phase, therapeutic_area, trial_status, start_date, estimated_completion_date, target_enrollment } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.clinical_trials
                (trial_nct_id, trial_title, trial_phase, therapeutic_area, trial_status, start_date, estimated_completion_date, target_enrollment)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [trial_nct_id, trial_title, trial_phase, therapeutic_area, trial_status, start_date, estimated_completion_date, target_enrollment]);
        await auditLog('clinical_trials', rows[0].trial_id, 'INSERT', rows[0], user.user_id, 'Admin created trial');
        await refreshMVs();
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/trials/:trialId', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    try {
        const [trial, sites, protocols, arms, eligibility, visits, ecrfDefs, labTests] = await Promise.all([
            pool.query(`SELECT * FROM meditrials.clinical_trials WHERE trial_id = $1`, [trialId]),
            pool.query(`SELECT * FROM meditrials.mv_site_enrollment WHERE trial_id = $1 ORDER BY enrollment_pct DESC`, [trialId]),
            pool.query(`SELECT * FROM meditrials.study_protocols WHERE trial_id = $1 ORDER BY version_number DESC`, [trialId]),
            pool.query(`SELECT * FROM meditrials.treatment_arms WHERE trial_id = $1`, [trialId]),
            pool.query(`SELECT * FROM meditrials.eligibility_criteria WHERE trial_id = $1 ORDER BY criterion_order`, [trialId]),
            pool.query(`SELECT * FROM meditrials.visit_schedules WHERE trial_id = $1 ORDER BY visit_day`, [trialId]),
            pool.query(`SELECT * FROM meditrials.ecrf_definitions WHERE trial_id = $1`, [trialId]),
            pool.query(`SELECT * FROM meditrials.laboratory_tests WHERE trial_id = $1`, [trialId]),
        ]);
        if (!trial.rows[0]) return res.status(404).json({ error: 'Trial not found' });
        res.json({ trial: trial.rows[0], sites: sites.rows, protocols: protocols.rows, arms: arms.rows, eligibility: eligibility.rows, visits: visits.rows, ecrfDefs: ecrfDefs.rows, labTests: labTests.rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/trials/:trialId', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { trialId } = req.params;
    const { trial_nct_id, trial_title, trial_phase, therapeutic_area, trial_status, start_date, estimated_completion_date, target_enrollment } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE meditrials.clinical_trials SET
                trial_nct_id=$1, trial_title=$2, trial_phase=$3, therapeutic_area=$4,
                trial_status=$5, start_date=$6, estimated_completion_date=$7, target_enrollment=$8
            WHERE trial_id=$9 RETURNING *
        `, [trial_nct_id, trial_title, trial_phase, therapeutic_area, trial_status, start_date, estimated_completion_date, target_enrollment, trialId]);
        await auditLog('clinical_trials', parseInt(trialId), 'UPDATE', rows[0], user.user_id, 'Admin updated trial');
        await refreshMVs();
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/trials/:trialId', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { trialId } = req.params;
    try {
        await pool.query(`UPDATE meditrials.clinical_trials SET trial_status='Archived' WHERE trial_id=$1`, [trialId]);
        await auditLog('clinical_trials', parseInt(trialId), 'UPDATE', { trial_status: 'Archived' }, user.user_id, 'Admin archived trial');
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Trial child endpoints ──────────────────────────────────────────────────────
router.post('/trials/:trialId/sites', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { trialId } = req.params;
    const { institution_name, country, target_enrollment, initiation_date } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.study_sites (trial_id, institution_name, country, target_enrollment, initiation_date)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [trialId, institution_name, country, target_enrollment, initiation_date]);
        await auditLog('study_sites', rows[0].site_id, 'INSERT', rows[0], user.user_id, 'Admin added site to trial');
        await refreshMVs();
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials/:trialId/protocols', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    const { version_number, amendment_number, effective_date, protocol_document } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.study_protocols (trial_id, version_number, amendment_number, effective_date, protocol_document)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [trialId, version_number, amendment_number, effective_date, protocol_document ?? null]);
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials/:trialId/arms', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    const { arm_code, arm_description, blinding_level } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.treatment_arms (trial_id, arm_code, arm_description, blinding_level)
            VALUES ($1,$2,$3,$4) RETURNING *
        `, [trialId, arm_code, arm_description, blinding_level]);
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/trials/:trialId/arms/:armId', requireAdmin, async (req: Request, res: Response) => {
    const { armId } = req.params;
    const { arm_description, blinding_level } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE meditrials.treatment_arms SET arm_description=$1, blinding_level=$2 WHERE arm_id=$3 RETURNING *
        `, [arm_description, blinding_level, armId]);
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials/:trialId/eligibility', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    const { criterion_text, criterion_type, criterion_order } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.eligibility_criteria (trial_id, criterion_text, criterion_type, criterion_order)
            VALUES ($1,$2,$3,$4) RETURNING *
        `, [trialId, criterion_text, criterion_type, criterion_order]);
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/trials/:trialId/eligibility/:criterionId', requireAdmin, async (req: Request, res: Response) => {
    const { trialId, criterionId } = req.params;
    try {
        await pool.query(`DELETE FROM meditrials.eligibility_criteria WHERE criterion_id=$1 AND trial_id=$2`, [criterionId, trialId]);
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials/:trialId/visits', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    const { visit_name, visit_day, window_before_days, window_after_days, is_required } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.visit_schedules (trial_id, visit_name, visit_day, window_before_days, window_after_days, is_required)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
        `, [trialId, visit_name, visit_day, window_before_days, window_after_days, is_required]);
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trials/:trialId/lab-tests', requireAdmin, async (req: Request, res: Response) => {
    const { trialId } = req.params;
    const { test_name, test_code_loinc, unit_of_measure, reference_low, reference_high, critical_low_value, critical_high_value } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO meditrials.laboratory_tests
                (trial_id, test_name, test_code_loinc, unit_of_measure, reference_low, reference_high, critical_low_value, critical_high_value)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [trialId, test_name, test_code_loinc, unit_of_measure, reference_low, reference_high, critical_low_value, critical_high_value]);
        res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// SITE MANAGEMENT
// ═══════════════════════════════════════════════════════
router.get('/sites', requireAdmin, async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    try {
        const filter = trial_id ? 'WHERE mse.trial_id = $1' : '';
        const params = trial_id ? [trial_id] : [];
        const { rows } = await pool.query(`
            SELECT mse.*, ss.site_status, u.username AS pi_name
            FROM meditrials.mv_site_enrollment mse
            JOIN meditrials.study_sites ss ON ss.site_id = mse.site_id
            LEFT JOIN meditrials.users u ON u.site_id = mse.site_id AND u.role = 'Principal_Investigator'
            ${filter}
            ORDER BY mse.trial_id, mse.enrollment_pct DESC
        `, params);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/sites/:siteId', requireAdmin, async (req: Request, res: Response) => {
    const { siteId } = req.params;
    try {
        const [site, enrollment, siteUsers, queryRes] = await Promise.all([
            pool.query(`SELECT * FROM meditrials.study_sites WHERE site_id = $1`, [siteId]),
            pool.query(`SELECT * FROM meditrials.mv_site_enrollment WHERE site_id = $1`, [siteId]),
            pool.query(`SELECT user_id, username, email, role, last_login, is_active FROM meditrials.users WHERE site_id = $1`, [siteId]),
            pool.query(`SELECT * FROM meditrials.mv_query_resolution_time WHERE site_id = $1`, [siteId]),
        ]);
        let perf: any = null;
        try {
            const perfRes = await pool.query(`SELECT * FROM meditrials.mv_site_performance WHERE site_id = $1 ORDER BY period_end_date DESC LIMIT 1`, [siteId]);
            perf = perfRes.rows[0] ?? null;
        } catch { /* MV may not exist */ }
        res.json({ site: site.rows[0], enrollment: enrollment.rows[0], performance: perf, users: siteUsers.rows, queryResolution: queryRes.rows[0] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/sites/:siteId', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { siteId } = req.params;
    const { institution_name, country, target_enrollment, site_status, initiation_date } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE meditrials.study_sites SET institution_name=$1, country=$2, target_enrollment=$3, site_status=$4, initiation_date=$5
            WHERE site_id=$6 RETURNING *
        `, [institution_name, country, target_enrollment, site_status, initiation_date, siteId]);
        await auditLog('study_sites', parseInt(siteId), 'UPDATE', rows[0], user.user_id, 'Admin updated site');
        await refreshMVs();
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/sites/:siteId/suspend', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { siteId } = req.params;
    const { reason } = req.body;
    try {
        await pool.query(`UPDATE meditrials.study_sites SET site_status='Suspended' WHERE site_id=$1`, [siteId]);
        await auditLog('study_sites', parseInt(siteId), 'UPDATE', { site_status: 'Suspended', reason }, user.user_id, reason || 'Admin suspended site');
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
    const { role, is_active, site_id, page = '1', limit = '25' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    try {
        const { rows } = await pool.query(`
            SELECT u.user_id, u.username, u.email, u.role, u.site_id,
                   ss.institution_name AS site_name, u.is_active, u.mfa_enabled,
                   u.last_login, u.created_at, 0 AS failed_login_attempts
            FROM meditrials.users u
            LEFT JOIN meditrials.study_sites ss ON ss.site_id = u.site_id
            WHERE (NULLIF($1,'') IS NULL OR u.role = $1)
              AND ($2::BOOLEAN IS NULL OR u.is_active = $2)
              AND ($3::INT IS NULL OR u.site_id = $3)
            ORDER BY u.created_at DESC
            LIMIT $4 OFFSET $5
        `, [role || null, is_active === 'true' ? true : is_active === 'false' ? false : null, site_id || null, parseInt(limit as string), offset]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/users', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { username, email, role, site_id, password, mfa_enabled } = req.body;
    try {
        const siteRequired = ['Principal_Investigator', 'Study_Coordinator'].includes(role);
        if (siteRequired && !site_id) return res.status(400).json({ error: `site_id required for role ${role}` });
        if (!siteRequired && site_id) return res.status(400).json({ error: `site_id must be null for role ${role}` });

        const passwordHash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(`
            INSERT INTO meditrials.users
                (username, email, role, site_id, password_hash, mfa_enabled, is_active, force_password_change)
            VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE)
            RETURNING user_id, username, email, role, site_id, is_active, mfa_enabled
        `, [username, email, role, site_id ?? null, passwordHash, mfa_enabled ?? false]);
        await auditLog('users', rows[0].user_id, 'INSERT', { username, email, role, site_id: site_id ?? null }, user.user_id, 'Admin created user');
        res.status(201).json(rows[0]);
    } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
        res.status(500).json({ error: err.message });
    }
});

router.put('/users/:userId', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { userId } = req.params;
    const { username, email, role, site_id, is_active, mfa_enabled } = req.body;
    try {
        const siteRequired = ['Principal_Investigator', 'Study_Coordinator'].includes(role);
        if (siteRequired && !site_id) return res.status(400).json({ error: `site_id required for role ${role}` });
        if (!siteRequired && site_id) return res.status(400).json({ error: `site_id must be null for role ${role}` });

        const { rows } = await pool.query(`
            UPDATE meditrials.users SET username=$1, email=$2, role=$3, site_id=$4, is_active=$5, mfa_enabled=$6
            WHERE user_id=$7
            RETURNING user_id, username, email, role, site_id, is_active, mfa_enabled
        `, [username, email, role, site_id ?? null, is_active, mfa_enabled, userId]);
        await auditLog('users', parseInt(userId), 'UPDATE', { username, email, role, is_active }, user.user_id, 'Admin updated user');
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:userId/activate', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { userId } = req.params;
    try {
        await pool.query(`UPDATE meditrials.users SET is_active=TRUE WHERE user_id=$1`, [userId]);
        await auditLog('users', parseInt(userId), 'UPDATE', { is_active: true }, user.user_id, 'Admin activated user');
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:userId/deactivate', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { userId } = req.params;
    try {
        await pool.query(`UPDATE meditrials.users SET is_active=FALSE WHERE user_id=$1`, [userId]);
        await auditLog('users', parseInt(userId), 'UPDATE', { is_active: false }, user.user_id, 'Admin deactivated user');
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:userId/reset-password', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { userId } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    try {
        const hash = await bcrypt.hash(new_password, 12);
        await pool.query(`
            UPDATE meditrials.users SET password_hash=$1, force_password_change=TRUE,
                password_reset_token=NULL, password_reset_expires=NULL
            WHERE user_id=$2
        `, [hash, userId]);
        await auditLog('users', parseInt(userId), 'UPDATE', { action: 'password_reset' }, user.user_id, 'Admin reset user password');
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:userId/access-log', requireAdmin, async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const { rows } = await pool.query(`
            SELECT * FROM meditrials.user_access_log WHERE user_id=$1 ORDER BY access_time DESC LIMIT 100
        `, [userId]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// LOCK MANAGEMENT
// ═══════════════════════════════════════════════════════
router.get('/locks', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT dl.lock_id, ct.trial_title, dl.lock_type, dl.lock_date, dl.unlock_date,
                   dl.snapshot_hash, u.username AS locked_by
            FROM meditrials.data_locks dl
            JOIN meditrials.clinical_trials ct ON ct.trial_id = dl.trial_id
            LEFT JOIN meditrials.users u ON u.user_id = dl.locked_by_user_id
            ORDER BY dl.lock_date DESC
        `);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/locks', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { trial_id, lock_type } = req.body;
    try {
        await pool.query(`CALL meditrials.sp_lock_database($1, $2, $3)`, [trial_id, lock_type, user.user_id]);
        await auditLog('data_locks', trial_id, 'INSERT', { trial_id, lock_type }, user.user_id, `Admin applied ${lock_type} lock`);
        res.json({ success: true });
    } catch (err: any) {
        if (err.message?.includes('already has an active data lock')) return res.status(409).json({ error: 'Trial already locked' });
        if (err.message?.includes('Invalid lock type')) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

router.put('/locks/:lockId/unlock', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { lockId } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Unlock reason is required (21 CFR Part 11)' });
    try {
        await pool.query(`UPDATE meditrials.data_locks SET unlock_date=NOW() WHERE lock_id=$1 AND unlock_date IS NULL`, [lockId]);
        await pool.query(`
            INSERT INTO meditrials.audit_trail_21cfr (table_name, record_id, action_type, new_values, changed_by_user_id, change_reason)
            VALUES ('data_locks', $1, 'UPDATE', '{"unlock_date":"now"}'::JSONB, $2, $3)
        `, [lockId, user.user_id, reason]);
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/locks/:lockId/verify', requireAdmin, async (req: Request, res: Response) => {
    const { lockId } = req.params;
    try {
        const { rows } = await pool.query(`
            SELECT dl.snapshot_hash, dl.trial_id,
                   MD5(COALESCE(p.patient_data::TEXT,'')) AS computed_hash
            FROM meditrials.data_locks dl
            LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json(p.*) ORDER BY p.patient_id) AS patient_data
                FROM meditrials.patients p
                JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
                WHERE ss.trial_id = dl.trial_id
            ) p ON TRUE
            WHERE dl.lock_id = $1
        `, [lockId]);
        if (!rows[0]) return res.status(404).json({ error: 'Lock not found' });
        const { snapshot_hash, computed_hash } = rows[0];
        const matches = snapshot_hash === computed_hash;
        res.json({ matches, storedHash: snapshot_hash, computedHash: computed_hash });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════════════
router.get('/audit', requireAdmin, async (req: Request, res: Response) => {
    const { table_name, user_id, action_type, record_id, date_from, date_to, admin_only, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    try {
        const { rows } = await pool.query(`
            SELECT at.*, u.username AS changed_by
            FROM meditrials.audit_trail_21cfr at
            LEFT JOIN meditrials.users u ON u.user_id = at.changed_by_user_id
            WHERE (NULLIF($1,'') IS NULL OR at.table_name = $1)
              AND ($2::INT IS NULL OR at.changed_by_user_id = $2)
              AND (NULLIF($3,'') IS NULL OR at.action_type = $3)
              AND ($4::INT IS NULL OR at.record_id = $4)
              AND ($5::DATE IS NULL OR at.change_timestamp::DATE >= $5)
              AND ($6::DATE IS NULL OR at.change_timestamp::DATE <= $6)
              AND (NOT $7::BOOLEAN OR at.table_name IN ('users','clinical_trials','study_sites','data_locks','study_protocols'))
            ORDER BY at.change_timestamp DESC
            LIMIT $8 OFFSET $9
        `, [table_name || null, user_id || null, action_type || null, record_id || null, date_from || null, date_to || null, admin_only === 'true', parseInt(limit as string), offset]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// MATERIALIZED VIEW REFRESH
// ═══════════════════════════════════════════════════════
router.post('/mv/refresh', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        await refreshMVs();
        await auditLog('system', 0, 'UPDATE', { action: 'refresh_all_materialized_views' }, user.user_id, 'Admin manual MV refresh');
        res.json({ success: true, refreshedAt: new Date().toISOString() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// SYSTEM SETTINGS
// ═══════════════════════════════════════════════════════
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
    try {
        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meditrials.system_settings (
                key VARCHAR PRIMARY KEY, value JSONB,
                updated_by INTEGER, updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        const { rows } = await pool.query(`SELECT key, value, updated_at FROM meditrials.system_settings ORDER BY key`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { key, value } = req.body;
    try {
        await pool.query(`
            INSERT INTO meditrials.system_settings (key, value, updated_by, updated_at)
            VALUES ($1, $2::JSONB, $3, NOW())
            ON CONFLICT (key) DO UPDATE SET value=$2::JSONB, updated_by=$3, updated_at=NOW()
        `, [key, JSON.stringify(value), user.user_id]);
        await auditLog('system', 0, 'UPDATE', { key, value }, user.user_id, `Admin updated setting: ${key}`);
        res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
