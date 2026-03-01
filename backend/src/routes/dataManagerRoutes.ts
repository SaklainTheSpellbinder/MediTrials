import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../config/db';

const router = Router();

// ── Auth helpers ─────────────────────────────────────────────────────────────
function decodeUser(req: Request): any | null {
    const header = req.headers['x-user-data'];
    if (!header) return null;
    try { return JSON.parse(Buffer.from(header as string, 'base64').toString('utf8')); }
    catch { return null; }
}

// Inject user on every request (non-blocking)
router.use((req: Request, _res: Response, next) => {
    (req as any).user = decodeUser(req);
    next();
});

const requireDataManager = (req: Request, res: Response, next: any) => {
    const u = (req as any).user;
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    if (u.role !== 'Data_Manager') return res.status(403).json({ error: 'Forbidden — Data Manager only' });
    next();
};

// ── GET /api/dashboard/data-manager ──────────────────────────────────────────
router.get('/data-manager', requireDataManager, async (req: Request, res: Response) => {
    try {
        const [queryStats, sitePerf, avgResolution, dataQuality, deviations, queryAge, lockReadiness] =
            await Promise.all([
                // Step 1: Open queries total and last-week count
                pool.query(`
                    SELECT
                        COUNT(*) FILTER (WHERE query_status = 'Open') AS open_total,
                        COUNT(*) FILTER (WHERE query_status = 'Open' AND raised_date < CURRENT_DATE - 7) AS open_last_week
                    FROM meditrials.data_queries
                `),
                // Step 2: Site query performance — USE mv_query_resolution_time
                pool.query(`
                    SELECT site_id, institution_name, total_queries, open_queries, resolved_queries,
                           COALESCE(avg_days_to_resolve, 0) AS avg_days_to_resolve
                    FROM meditrials.mv_query_resolution_time
                    ORDER BY avg_days_to_resolve DESC NULLS LAST
                `),
                // Step 3: Global avg resolution from MV
                pool.query(`
                    SELECT COALESCE(ROUND(AVG(avg_days_to_resolve)::NUMERIC, 1), 0) AS global_avg
                    FROM meditrials.mv_query_resolution_time
                    WHERE avg_days_to_resolve IS NOT NULL
                `),
                // Step 4: Missing data rate and unsigned forms — USE mv_data_quality
                pool.query(`
                    SELECT
                        COALESCE(ROUND(
                            COUNT(*) FILTER (WHERE total_forms > 0 AND signed_forms < total_forms)::DECIMAL
                            / NULLIF(COUNT(*), 0) * 100, 1
                        ), 0) AS missing_data_rate,
                        COALESCE(SUM(GREATEST(total_forms - signed_forms - locked_forms, 0)), 0) AS unsigned_forms
                    FROM meditrials.mv_data_quality
                `),
                // Step 5: Deviations this month
                pool.query(`
                    SELECT COUNT(*) AS cnt FROM meditrials.protocol_deviations
                    WHERE deviation_date >= date_trunc('month', CURRENT_DATE)
                `),
                // Step 6: Query age distribution
                pool.query(`
                    SELECT
                        COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE - 3) AS bucket_0_3,
                        COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE - 7 AND raised_date < CURRENT_DATE - 3) AS bucket_4_7,
                        COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE - 14 AND raised_date < CURRENT_DATE - 7) AS bucket_8_14,
                        COUNT(*) FILTER (WHERE raised_date < CURRENT_DATE - 14) AS bucket_14plus
                    FROM meditrials.data_queries WHERE query_status = 'Open'
                `),
                // Step 7: Lock readiness per trial
                pool.query(`
                    SELECT
                        ct.trial_id, ct.trial_title, ct.trial_status,
                        COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status = 'Open') AS open_queries,
                        COALESCE(SUM(GREATEST(dq2.total_forms - dq2.signed_forms - dq2.locked_forms, 0)), 0) AS unsigned_forms,
                        COALESCE(ROUND(
                            COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status NOT IN ('Signed','Locked','Completed'))::DECIMAL
                            / NULLIF(COUNT(DISTINCT ed.ecrf_instance_id), 0) * 100, 1
                        ), 0) AS missing_data_pct,
                        COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.corrective_action IS NULL) AS deviations_undocumented,
                        EXISTS (
                            SELECT 1 FROM meditrials.data_locks dl
                            WHERE dl.trial_id = ct.trial_id AND dl.unlock_date IS NULL
                        ) AS has_active_lock
                    FROM meditrials.clinical_trials ct
                    LEFT JOIN meditrials.study_sites ss ON ss.trial_id = ct.trial_id
                    LEFT JOIN meditrials.patients p ON p.site_id = ss.site_id
                    LEFT JOIN meditrials.ecrf_data ed ON ed.patient_id = p.patient_id
                    LEFT JOIN meditrials.data_queries dq ON dq.ecrf_instance_id = ed.ecrf_instance_id
                    LEFT JOIN meditrials.mv_data_quality dq2 ON dq2.patient_id = p.patient_id
                    LEFT JOIN meditrials.protocol_deviations pd ON pd.patient_id = p.patient_id
                    GROUP BY ct.trial_id, ct.trial_title, ct.trial_status
                `),
            ]);

        const openTotal = parseInt(queryStats.rows[0].open_total);
        const openLastWeek = parseInt(queryStats.rows[0].open_last_week);

        res.json({
            openQueriesTotal: openTotal,
            openQueriesLastWeek: openLastWeek,
            openQueriesTrend: openTotal > openLastWeek ? 'up' : openTotal < openLastWeek ? 'down' : 'flat',
            avgResolutionDays: parseFloat(avgResolution.rows[0].global_avg),
            missingDataRate: parseFloat(dataQuality.rows[0].missing_data_rate),
            unsignedFormsCount: parseInt(dataQuality.rows[0].unsigned_forms),
            deviationsThisMonth: parseInt(deviations.rows[0].cnt),
            queryAgeDistribution: {
                bucket_0_3: parseInt(queryAge.rows[0].bucket_0_3),
                bucket_4_7: parseInt(queryAge.rows[0].bucket_4_7),
                bucket_8_14: parseInt(queryAge.rows[0].bucket_8_14),
                bucket_14plus: parseInt(queryAge.rows[0].bucket_14plus),
            },
            siteQueryComparison: sitePerf.rows,
            lockReadiness: lockReadiness.rows,
        });
    } catch (err: any) {
        console.error('DM dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/data-management/queries ─────────────────────────────────────────
router.get('/queries', async (req: Request, res: Response) => {
    try {
        const { status, site_id, trial_id, date_from, date_to, page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        const filters: string[] = ['1=1'];
        const params: any[] = [];
        let pi = 1;

        if (status) { filters.push(`dq.query_status = $${pi++}`); params.push(status); }
        if (site_id) { filters.push(`ss.site_id = $${pi++}`); params.push(site_id); }
        if (trial_id) { filters.push(`ct.trial_id = $${pi++}`); params.push(trial_id); }
        if (date_from) { filters.push(`dq.raised_date >= $${pi++}`); params.push(date_from); }
        if (date_to) { filters.push(`dq.raised_date <= $${pi++}`); params.push(date_to); }

        params.push(parseInt(limit as string), offset);
        const result = await pool.query(`
            SELECT dq.query_id, p.trial_patient_id, ss.institution_name AS site_name,
                   vs.visit_name, ed.form_name AS ecrf_name, dq.field_name,
                   dq.query_text, dq.query_status, dq.raised_date,
                   EXTRACT(DAY FROM NOW() - dq.raised_date)::INT AS days_open,
                   dq.response_text
            FROM meditrials.data_queries dq
            JOIN meditrials.ecrf_data ed ON ed.ecrf_instance_id = dq.ecrf_instance_id
            JOIN meditrials.patients p ON p.patient_id = ed.patient_id
            JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
            JOIN meditrials.clinical_trials ct ON ct.trial_id = ss.trial_id
            LEFT JOIN meditrials.visit_schedules vs ON vs.visit_id = ed.visit_id
            WHERE ${filters.join(' AND ')}
            ORDER BY dq.raised_date DESC
            LIMIT $${pi++} OFFSET $${pi}
        `, params);

        res.json({ queries: result.rows, page: parseInt(page as string), limit: parseInt(limit as string) });
    } catch (err: any) {
        console.error('DM queries error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/data-management/queries ────────────────────────────────────────
router.post('/queries', async (req: Request, res: Response) => {
    const { ecrf_instance_id, field_name, query_text, priority = 'Routine' } = req.body;
    const user = (req as any).user;
    try {
        const client = await (pool as any).connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(`
                INSERT INTO meditrials.data_queries
                    (ecrf_instance_id, field_name, query_text, query_status, priority, raised_by_user_id, raised_date)
                VALUES ($1, $2, $3, 'Open', $4, $5, CURRENT_DATE)
                RETURNING *
            `, [ecrf_instance_id, field_name, query_text, priority, user.user_id]);

            await client.query(`
                UPDATE meditrials.ecrf_data
                SET query_count = COALESCE(query_count, 0) + 1
                WHERE ecrf_instance_id = $1
            `, [ecrf_instance_id]);

            await client.query('COMMIT');
            res.status(201).json(rows[0]);
        } catch (e) {
            await client.query('ROLLBACK'); throw e;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('DM raise query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/data-management/queries/:queryId ─────────────────────────────────
router.put('/queries/:queryId', async (req: Request, res: Response) => {
    const { queryId } = req.params;
    const { action, responseText } = req.body;
    const user = (req as any).user;
    try {
        if (action === 'resolve') {
            const { rows } = await pool.query(`
                UPDATE meditrials.data_queries
                SET query_status = 'Resolved', resolved_date = NOW(),
                    resolved_by_user_id = $1, response_text = $2
                WHERE query_id = $3 RETURNING *
            `, [user.user_id, responseText, queryId]);
            return res.json(rows[0]);
        } else if (action === 'reopen') {
            const { rows } = await pool.query(`
                UPDATE meditrials.data_queries
                SET query_status = 'Open', resolved_date = NULL, resolved_by_user_id = NULL
                WHERE query_id = $1 RETURNING *
            `, [queryId]);
            return res.json(rows[0]);
        }
        res.status(400).json({ error: 'action must be resolve or reopen' });
    } catch (err: any) {
        console.error('DM update query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/data-management/completeness ────────────────────────────────────
router.get('/completeness', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT p.patient_id, p.trial_patient_id, ss.institution_name AS site_name,
                   dq.total_forms, dq.completed_forms, dq.signed_forms, dq.locked_forms,
                   COALESCE(ROUND(dq.completed_forms::DECIMAL / NULLIF(dq.total_forms,0) * 100, 1), 0) AS completion_pct
            FROM meditrials.patients p
            JOIN meditrials.study_sites ss ON ss.site_id = p.site_id
            LEFT JOIN meditrials.mv_data_quality dq ON dq.patient_id = p.patient_id
            WHERE ss.trial_id = $1
            ORDER BY ss.institution_name, p.trial_patient_id
        `, [trial_id]);
        res.json({ patients: rows });
    } catch (err: any) {
        console.error('DM completeness error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/data-management/locks ───────────────────────────────────────────
router.get('/locks', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT dl.*, ct.trial_title,
                   u.full_name AS locked_by_name
            FROM meditrials.data_locks dl
            JOIN meditrials.clinical_trials ct ON ct.trial_id = dl.trial_id
            LEFT JOIN meditrials.users u ON u.user_id = dl.locked_by_user_id
            ORDER BY dl.lock_date DESC
        `);
        res.json(rows);
    } catch (err: any) {
        console.error('DM locks error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/data-management/lock ───────────────────────────────────────────
router.post('/lock', async (req: Request, res: Response) => {
    const { trial_id, lock_type, password } = req.body;
    const user = (req as any).user;
    try {
        // 21 CFR Part 11 re-authentication
        const auth = await pool.query(
            `SELECT 1 FROM meditrials.users WHERE user_id = $1 AND password_hash = $2`,
            [user.user_id, password]
        );
        if (auth.rowCount === 0) {
            return res.status(401).json({ error: 'Re-authentication failed' });
        }
        await pool.query(
            `CALL meditrials.sp_lock_database($1, $2, $3)`,
            [trial_id, lock_type, user.user_id]
        );
        res.json({ success: true, message: `${lock_type} lock applied to trial ${trial_id}` });
    } catch (err: any) {
        console.error('DM lock error:', err.message);
        if (err.message.includes('already has an active data lock')) return res.status(409).json({ error: err.message });
        if (err.message.includes('Invalid lock type')) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/data-management/export/sdtm ─────────────────────────────────────
router.get('/export/sdtm', async (req: Request, res: Response) => {
    const { trial_id, domains = 'DM,AE,VS,LB' } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT dm_data, ae_data, vs_data, lb_data
            FROM (CALL meditrials.sp_export_cdisc_sdtm($1, NULL, NULL, NULL, NULL)) AS r
        `, [trial_id]);
        const requested = (domains as string).split(',').map(d => d.trim().toLowerCase());
        const result: Record<string, any> = {};
        if (requested.includes('dm')) result.DM = rows[0]?.dm_data;
        if (requested.includes('ae')) result.AE = rows[0]?.ae_data;
        if (requested.includes('vs')) result.VS = rows[0]?.vs_data;
        if (requested.includes('lb')) result.LB = rows[0]?.lb_data;
        res.setHeader('Content-Type', 'application/json');
        res.json(result);
    } catch (err: any) {
        console.error('DM SDTM export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
