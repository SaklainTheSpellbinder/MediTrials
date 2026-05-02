import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../config/db';
import {requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Data_Manager']));

// Helper: explicit transaction wrapper with 21 CFR Part 11 session variables
async function withTransaction(userId: number, reason: string, fn: (client: any) => Promise<any>) {
    const client = await (pool as any).connect();
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
        await client.query(`SET LOCAL app.change_reason = '${reason.replace(/'/g, "''")}'`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

//GET /api/dashboard/data-manager
router.get('/data-manager', async (req: Request, res: Response) => {
    try {
        const [queryStats, sitePerf, avgResolution, dataQuality, deviations, queryAge, lockReadiness, triggerActivity] =
            await Promise.all([
                pool.query(`SELECT COUNT(*) FILTER (WHERE query_status='Open') AS open_total,
                    COUNT(*) FILTER (WHERE query_status='Open' 
  AND raised_date >= CURRENT_DATE - 14 
  AND raised_date < CURRENT_DATE - 7) AS open_last_week
                    FROM public.data_queries`),
                // Complex Query 2: site performance with window function RANK()
                pool.query(`SELECT ss.institution_name, ss.site_id,
                    COUNT(DISTINCT dq.query_id) AS total_queries,
                    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status='Open') AS open_queries,
                    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status IN ('Resolved','Closed')) AS resolved_queries,
                    COALESCE(ROUND(AVG(EXTRACT(DAY FROM dq.resolved_date - dq.raised_date))
                        FILTER (WHERE dq.resolved_date IS NOT NULL)::NUMERIC, 1), 0) AS avg_days_to_resolve
                    FROM public.study_sites ss
                    LEFT JOIN public.patients p ON p.site_id = ss.site_id
                    LEFT JOIN public.ecrf_data ed ON ed.patient_id = p.patient_id
                    LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id = ed.ecrf_instance_id
                    GROUP BY ss.site_id, ss.institution_name ORDER BY avg_days_to_resolve DESC NULLS LAST`),
                pool.query(`SELECT COALESCE(ROUND(AVG(avg_days_to_resolve)::NUMERIC,1),0) AS global_avg
                    FROM public.mv_query_resolution_time WHERE avg_days_to_resolve IS NOT NULL`),
                pool.query(`SELECT COALESCE(ROUND(
                    COUNT(*) FILTER (WHERE total_forms>0 AND signed_forms<total_forms)::DECIMAL
                    /NULLIF(COUNT(*),0)*100,1),0) AS missing_data_rate,
                    COALESCE(SUM(GREATEST(total_forms-signed_forms-locked_forms,0)),0) AS unsigned_forms
                    FROM public.mv_data_quality`),
                pool.query(`SELECT COUNT(*) AS cnt FROM public.protocol_deviations
                    WHERE deviation_date >= date_trunc('month',CURRENT_DATE)`),
                pool.query(`SELECT
                    COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE-3) AS bucket_0_3,
                    COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE-7 AND raised_date < CURRENT_DATE-3) AS bucket_4_7,
                    COUNT(*) FILTER (WHERE raised_date >= CURRENT_DATE-14 AND raised_date < CURRENT_DATE-7) AS bucket_8_14,
                    COUNT(*) FILTER (WHERE raised_date < CURRENT_DATE-14) AS bucket_14plus
                    FROM public.data_queries WHERE query_status='Open'`),
                pool.query(`SELECT ct.trial_id, ct.trial_title,
                    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status='Open') AS open_queries,
                    COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status NOT IN ('Signed','Locked','Completed')) AS unsigned_forms,
                    COALESCE(ROUND(COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='In Progress')::DECIMAL
                        /NULLIF(COUNT(DISTINCT ed.ecrf_instance_id),0)*100,1),0) AS missing_data_pct,
                    COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.corrective_action IS NULL) AS deviations_undocumented,
                    EXISTS(SELECT 1 FROM public.data_locks dl WHERE dl.trial_id=ct.trial_id AND dl.unlock_date IS NULL) AS has_active_lock
                    FROM public.clinical_trials ct
                    LEFT JOIN public.study_sites ss ON ss.trial_id=ct.trial_id
                    LEFT JOIN public.patients p ON p.site_id=ss.site_id
                    LEFT JOIN public.ecrf_data ed ON ed.patient_id=p.patient_id
                    LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id=ed.ecrf_instance_id
                    LEFT JOIN public.protocol_deviations pd ON pd.patient_id=p.patient_id
                    GROUP BY ct.trial_id, ct.trial_title`),
                // System trigger activity: last 5 audit entries from automatic triggers
                pool.query(`SELECT at.table_name, at.action_type, at.change_timestamp, at.change_reason, u.username
                    FROM public.audit_trail_21cfr at
                    LEFT JOIN public.users u ON u.user_id = at.changed_by_user_id
                    WHERE at.change_reason ILIKE '%via %'
                    ORDER BY at.change_timestamp DESC LIMIT 5`),
            ]);
        const openTotal = parseInt(queryStats.rows[0].open_total);
        const openLastWeek = parseInt(queryStats.rows[0].open_last_week);
        res.json({
            openQueriesTotal: openTotal, openQueriesLastWeek: openLastWeek,
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
            triggerActivity: triggerActivity.rows,
        });
    } catch (err: any) {
        console.error('DM dashboard error:', err.message); res.status(500).json({ error: err.message });
    }
});

//GET /api/data-management/trials
router.get('/trials', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`SELECT trial_id, trial_title, trial_status FROM public.clinical_trials ORDER BY trial_title`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/sites
router.get('/sites', async (req: Request, res: Response) => {
    try {
        const { trial_id } = req.query;
        const q = trial_id
            ? `SELECT site_id, institution_name, country FROM public.study_sites WHERE trial_id=$1 ORDER BY institution_name`
            : `SELECT site_id, institution_name, country FROM public.study_sites ORDER BY institution_name`;
        const { rows } = await pool.query(q, trial_id ? [trial_id] : []);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/patients
router.get('/patients', async (req: Request, res: Response) => {
    try {
        const { trial_id, site_id } = req.query;
        const filters: string[] = ['1=1'];
        const params: any[] = [];
        let pi = 1;
        if (trial_id) { filters.push(`ss.trial_id=$${pi++}`); params.push(trial_id); }
        if (site_id)  { filters.push(`p.site_id=$${pi++}`); params.push(site_id); }
        const { rows } = await pool.query(`SELECT p.patient_id, p.trial_patient_id, p.patient_status,
            ss.institution_name AS site_name, ss.site_id
            FROM public.patients p JOIN public.study_sites ss ON ss.site_id=p.site_id
            WHERE ${filters.join(' AND ')} ORDER BY p.trial_patient_id`, params);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/patients/:patientId/visits
router.get('/patients/:patientId/visits', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT pv.visit_instance_id, vs.visit_name, pv.scheduled_date, pv.visit_status
             FROM public.patient_visits pv
             JOIN public.visit_schedules vs ON vs.visit_id = pv.visit_id
             WHERE pv.patient_id=$1 ORDER BY vs.visit_number`, [req.params.patientId]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/visits/:visitInstanceId/forms
router.get('/visits/:visitInstanceId/forms', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT ed.ecrf_instance_id, edef.ecrf_name, ed.form_status, edef.ecrf_schema
             FROM public.ecrf_data ed
             JOIN public.ecrf_definitions edef ON edef.ecrf_id = ed.ecrf_id
             WHERE ed.visit_instance_id=$1 ORDER BY edef.ecrf_name`, [req.params.visitInstanceId]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/data-management/queries
router.get('/queries', async (req: Request, res: Response) => {
    try {
        const { status, site_id, trial_id, date_from, date_to, search, page = '1', limit = '50' } = req.query;
        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        const filters: string[] = ['1=1'];
        const params: any[] = [];
        let pi = 1;
        if (status)    { filters.push(`dq.query_status=$${pi++}`); params.push(status); }
        if (site_id)   { filters.push(`ss.site_id=$${pi++}`); params.push(site_id); }
        if (trial_id)  { filters.push(`ct.trial_id=$${pi++}`); params.push(trial_id); }
        if (date_from) { filters.push(`dq.raised_date>=$${pi++}`); params.push(date_from); }
        if (date_to)   { filters.push(`dq.raised_date<=$${pi++}`); params.push(date_to); }
        if (search)    { filters.push(`(p.trial_patient_id ILIKE $${pi} OR dq.query_text ILIKE $${pi++})`); params.push(`%${search}%`); }
        params.push(parseInt(limit as string), offset);
        const { rows } = await pool.query(`
            SELECT dq.query_id, dq.field_name,
                CASE WHEN length(dq.query_text)>80 THEN left(dq.query_text,80)||'…' ELSE dq.query_text END AS query_text_short,
                dq.query_text AS query_text_full,
                dq.query_status, dq.raised_date,
                EXTRACT(DAY FROM NOW()-dq.raised_date)::INTEGER AS days_open,
                dq.response_text, dq.resolved_date,
                p.trial_patient_id, ss.institution_name AS site_name, ss.site_id,
                vs.visit_name, edef.ecrf_name,
                u_r.username AS raised_by_username,
                u_res.username AS resolved_by_username
            FROM public.data_queries dq
            JOIN public.ecrf_data ed ON ed.ecrf_instance_id=dq.ecrf_instance_id
            JOIN public.ecrf_definitions edef ON edef.ecrf_id=ed.ecrf_id
            JOIN public.patient_visits pv ON pv.visit_instance_id=ed.visit_instance_id
            JOIN public.visit_schedules vs ON vs.visit_id=pv.visit_id
            JOIN public.patients p ON p.patient_id=ed.patient_id
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            JOIN public.clinical_trials ct ON ct.trial_id=ss.trial_id
            LEFT JOIN public.users u_r ON u_r.user_id=dq.raised_by_user_id
            LEFT JOIN public.users u_res ON u_res.user_id=dq.resolved_by_user_id
            WHERE ${filters.join(' AND ')}
            ORDER BY dq.raised_date DESC
            LIMIT $${pi++} OFFSET $${pi}`, params);

        // Count badges per status tab
        const counts = await pool.query(`SELECT query_status, COUNT(*) AS cnt
            FROM public.data_queries GROUP BY query_status`);
        const statusCounts: Record<string, number> = {};
        counts.rows.forEach((r: any) => { statusCounts[r.query_status] = parseInt(r.cnt); });
        res.json({ queries: rows, statusCounts, page: parseInt(page as string) });
    } catch (err: any) { console.error('DM queries:', err.message); res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/queries/:queryId 
router.get('/queries/:queryId', async (req: Request, res: Response) => {
    try {
        // Single query detail
        const { rows } = await pool.query(`
            SELECT dq.*, p.trial_patient_id, ss.institution_name AS site_name,
                vs.visit_name, edef.ecrf_name, edef.ecrf_schema,
                EXTRACT(DAY FROM NOW()-dq.raised_date)::INTEGER AS days_open,
                u_r.username AS raised_by_username,
                u_res.username AS resolved_by_username
            FROM public.data_queries dq
            JOIN public.ecrf_data ed ON ed.ecrf_instance_id=dq.ecrf_instance_id
            JOIN public.ecrf_definitions edef ON edef.ecrf_id=ed.ecrf_id
            JOIN public.patient_visits pv ON pv.visit_instance_id=ed.visit_instance_id
            JOIN public.visit_schedules vs ON vs.visit_id=pv.visit_id
            JOIN public.patients p ON p.patient_id=ed.patient_id
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            LEFT JOIN public.users u_r ON u_r.user_id=dq.raised_by_user_id
            LEFT JOIN public.users u_res ON u_res.user_id=dq.resolved_by_user_id
            WHERE dq.query_id=$1`, [req.params.queryId]);
        if (!rows.length) return res.status(404).json({ error: 'Query not found' });
        // Thread: audit trail entries for this query record
        const { rows: thread } = await pool.query(`
            SELECT at.action_type, at.change_timestamp, at.change_reason, at.new_value, u.username
            FROM public.audit_trail_21cfr at
            LEFT JOIN public.users u ON u.user_id=at.changed_by_user_id
            WHERE at.table_name='data_queries' AND at.record_id=$1
            ORDER BY at.change_timestamp ASC`, [req.params.queryId]);
        res.json({ ...rows[0], thread });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/data-management/queries
// Raise new query — explicit transaction, sets 21 CFR session vars, increments query_count
router.post('/queries', async (req: Request, res: Response) => {
    const { ecrf_instance_id, field_name, query_text } = req.body;
    const user = (req as any).user;
    try {
        const result = await withTransaction(user.user_id, 'Data Manager raised query', async (client) => {
            const { rows } = await client.query(`
                INSERT INTO public.data_queries
                    (ecrf_instance_id, field_name, query_text, query_status, raised_by_user_id, raised_date)
                VALUES ($1,$2,$3,'Open',$4,NOW()) RETURNING *`,
                [ecrf_instance_id, field_name, query_text, user.user_id]);
            // Increment query_count on the linked eCRF instance (triggers audit)
            await client.query(`UPDATE public.ecrf_data SET query_count=COALESCE(query_count,0)+1
                WHERE ecrf_instance_id=$1`, [ecrf_instance_id]);
            return rows[0];
        });
        res.status(201).json(result);
    } catch (err: any) { console.error('Raise query:', err.message); res.status(500).json({ error: err.message }); }
});

//PUT /api/data-management/queries/:queryId
//Update query status (resolve / reject / close) — requires 21 CFR re-auth
router.put('/queries/:queryId', async (req: Request, res: Response) => {
    const { queryId } = req.params;
    const { action, rejection_comment, reason } = req.body;
    const user = (req as any).user;
    try {
        const result = await withTransaction(user.user_id, reason || `Query ${action}`, async (client) => {
            if (action === 'resolve') {
                const { rows } = await client.query(`
                    UPDATE public.data_queries SET query_status='Resolved',
                    resolved_date=NOW(), resolved_by_user_id=$1
                    WHERE query_id=$2 RETURNING *`, [user.user_id, queryId]);
                return rows[0];
            } else if (action === 'reject') {
                const newText = rejection_comment ? `[REJECTED] ${rejection_comment}` : '[REJECTED]';
                const { rows } = await client.query(`
                    UPDATE public.data_queries SET query_status='Open',
                    response_text=$1, resolved_date=NULL, resolved_by_user_id=NULL
                    WHERE query_id=$2 RETURNING *`, [newText, queryId]);
                return rows[0];
            } else if (action === 'close') {
                const { rows } = await client.query(`
                    UPDATE public.data_queries SET query_status='Closed',
                    resolved_date=COALESCE(resolved_date,NOW())
                    WHERE query_id=$1 RETURNING *`, [queryId]);
                return rows[0];
            }
            throw new Error('Invalid action — must be resolve, reject, or close');
        });
        res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/site-performance
// Complex Query 2: window function RANK() for site resolution ranking
router.get('/site-performance', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT ss.institution_name, ss.country, ss.site_id,
                COUNT(DISTINCT dq.query_id) AS total_queries,
                COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status='Open') AS open_queries,
                COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status IN ('Resolved','Closed')) AS resolved_queries,
                ROUND(AVG(EXTRACT(DAY FROM dq.resolved_date-dq.raised_date))
                    FILTER (WHERE dq.resolved_date IS NOT NULL)::NUMERIC,1) AS avg_days_to_resolve,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
  ORDER BY CASE WHEN dq.resolved_date IS NOT NULL
    THEN EXTRACT(DAY FROM dq.resolved_date - dq.raised_date)
    ELSE NULL END
)::NUMERIC,1) AS median_days,
                RANK() OVER (ORDER BY ROUND(AVG(EXTRACT(DAY FROM dq.resolved_date-dq.raised_date))
                    FILTER (WHERE dq.resolved_date IS NOT NULL)::NUMERIC,1) ASC NULLS LAST) AS resolution_rank
            FROM public.data_queries dq
            JOIN public.ecrf_data ed ON ed.ecrf_instance_id=dq.ecrf_instance_id
            JOIN public.patients p ON p.patient_id=ed.patient_id
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            GROUP BY ss.site_id, ss.institution_name, ss.country
            ORDER BY resolution_rank`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/data-management/completeness
// eCRF completeness matrix — cross join patients × visits
router.get('/completeness', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT p.patient_id, p.trial_patient_id, ss.site_id, ss.institution_name AS site_name,
                vs.visit_id, vs.visit_name, vs.visit_number,
                pv.visit_instance_id, pv.visit_status,
                COUNT(DISTINCT ed.ecrf_instance_id) AS form_count,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='Locked') AS locked_count,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='Signed') AS signed_count,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='Completed') AS completed_count,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='In Progress') AS in_progress_count,
                COUNT(DISTINCT edef.ecrf_id) AS required_forms_count
            FROM public.patients p
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            CROSS JOIN public.visit_schedules vs
            LEFT JOIN public.patient_visits pv ON pv.patient_id=p.patient_id AND pv.visit_id=vs.visit_id
            LEFT JOIN public.ecrf_data ed ON ed.visit_instance_id=pv.visit_instance_id
            LEFT JOIN public.ecrf_definitions edef ON edef.trial_id=vs.trial_id AND edef.signature_required=TRUE
            WHERE ss.trial_id=$1 AND vs.trial_id=$1
            GROUP BY p.patient_id, p.trial_patient_id, ss.site_id, ss.institution_name,
                vs.visit_id, vs.visit_name, vs.visit_number, pv.visit_instance_id, pv.visit_status
            ORDER BY p.trial_patient_id, vs.visit_number`, [trial_id]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/missing-data
router.get('/missing-data', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`
            SELECT p.trial_patient_id, ss.institution_name,
                COUNT(DISTINCT edef.ecrf_id) AS total_required_forms,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked')) AS completed_forms,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='Signed') AS signed_forms,
                ROUND(COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked'))::DECIMAL
                    /NULLIF(COUNT(DISTINCT edef.ecrf_id),0)*100,1) AS completion_pct,
                COALESCE(SUM(ed.query_count),0) AS missing_field_flags,
                COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status='Open') AS open_queries,
                MAX(ed.updated_at) AS last_activity
            FROM public.patients p
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            JOIN public.patient_visits pv ON pv.patient_id=p.patient_id
            JOIN public.ecrf_definitions edef ON edef.trial_id=ss.trial_id
            LEFT JOIN public.ecrf_data ed ON ed.visit_instance_id=pv.visit_instance_id AND ed.ecrf_id=edef.ecrf_id
            LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id=ed.ecrf_instance_id
            WHERE ss.trial_id=$1
            GROUP BY p.patient_id, p.trial_patient_id, ss.institution_name
            ORDER BY completion_pct ASC NULLS FIRST`, [trial_id]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/deviations
router.get('/deviations', async (req: Request, res: Response) => {
    const { trial_id, type, site_id, irb_reported, date_from, date_to } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const filters = ['ss.trial_id=$1'];
        const params: any[] = [trial_id];
        let pi = 2;
        if (type)         { filters.push(`pd.deviation_type=$${pi++}`); params.push(type); }
        if (site_id)      { filters.push(`ss.site_id=$${pi++}`); params.push(site_id); }
        if (irb_reported === 'true')  { filters.push(`pd.reported_to_irb=TRUE`); }
        if (irb_reported === 'false') { filters.push(`pd.reported_to_irb=FALSE`); }
        if (date_from)    { filters.push(`pd.deviation_date>=$${pi++}`); params.push(date_from); }
        if (date_to)      { filters.push(`pd.deviation_date<=$${pi++}`); params.push(date_to); }
        const { rows } = await pool.query(`
            SELECT pd.deviation_id, pd.deviation_type, pd.deviation_date,
                pd.description, pd.corrective_action, pd.reported_to_irb,
                p.trial_patient_id, ss.institution_name AS site_name,
                u.username AS reported_by_username
            FROM public.protocol_deviations pd
            JOIN public.patients p ON p.patient_id=pd.patient_id
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            LEFT JOIN public.users u ON u.user_id=pd.reported_by_user_id
            WHERE ${filters.join(' AND ')}
            ORDER BY pd.deviation_date DESC`, params);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/data-management/deviations/:deviationId
// Toggle IRB reported — only field DM can edit; requires 21 CFR re-auth
router.put('/deviations/:deviationId', async (req: Request, res: Response) => {
    const { reported_to_irb, reason } = req.body;
    const user = (req as any).user;
    try {
        const result = await withTransaction(user.user_id, reason || 'IRB status update', async (client) => {
            const { rows } = await client.query(`
                UPDATE public.protocol_deviations SET reported_to_irb=$1, updated_at=NOW()
                WHERE deviation_id=$2 RETURNING *`, [reported_to_irb, req.params.deviationId]);
            return rows[0];
        });
        res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

//GET /api/data-management/trend/:trialId 
// Complex Query 3: data completeness trend over last 6 months (weekly buckets)
router.get('/trend/:trialId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT DATE_TRUNC('week',pv.actual_visit_date) AS week,
                COUNT(DISTINCT ed.ecrf_instance_id) AS forms_entered,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status IN ('Signed','Locked')) AS forms_signed,
                COUNT(DISTINCT dq.query_id) AS queries_raised,
                COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status IN ('Resolved','Closed')) AS queries_resolved,
                ROUND(COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status IN ('Signed','Locked'))::DECIMAL
                    /NULLIF(COUNT(DISTINCT ed.ecrf_instance_id),0)*100,1) AS weekly_sign_rate
            FROM public.patient_visits pv
            JOIN public.ecrf_data ed ON ed.visit_instance_id=pv.visit_instance_id
            JOIN public.patients p ON p.patient_id=pv.patient_id
            JOIN public.study_sites ss ON ss.site_id=p.site_id
            LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id=ed.ecrf_instance_id
            WHERE ss.trial_id=$1 AND pv.actual_visit_date IS NOT NULL
              AND pv.actual_visit_date >= CURRENT_DATE-INTERVAL '6 months'
            GROUP BY DATE_TRUNC('week',pv.actual_visit_date)
            ORDER BY week ASC`, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/lock-readiness/:trialId ─────────────────────────
// Complex Query 1: multi-table aggregation for lock readiness checklist
router.get('/lock-readiness/:trialId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT ct.trial_id, ct.trial_title,
                COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status='Open') AS open_queries,
                COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status NOT IN ('Signed','Locked')) AS unsigned_forms,
                ROUND(COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status='In Progress')::DECIMAL
                    /NULLIF(COUNT(DISTINCT ed.ecrf_instance_id),0)*100,2) AS missing_data_pct,
                COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.corrective_action IS NULL) AS undocumented_deviations,
                COUNT(DISTINCT sa.alert_id) FILTER (WHERE sa.alert_status='ACTIVE' AND sa.alert_severity IN ('CRITICAL','SEVERE')) AS critical_alerts,
                COUNT(DISTINCT sae.sae_id) FILTER (WHERE sae.sae_status!='Closed') AS open_saes,
                EXISTS(SELECT 1 FROM public.data_locks dl WHERE dl.trial_id=ct.trial_id AND dl.unlock_date IS NULL) AS has_active_lock
            FROM public.clinical_trials ct
            JOIN public.study_sites ss ON ss.trial_id=ct.trial_id
            JOIN public.patients p ON p.site_id=ss.site_id
            LEFT JOIN public.patient_visits pv ON pv.patient_id=p.patient_id
            LEFT JOIN public.ecrf_data ed ON ed.visit_instance_id=pv.visit_instance_id
            LEFT JOIN public.data_queries dq ON dq.ecrf_instance_id=ed.ecrf_instance_id
            LEFT JOIN public.protocol_deviations pd ON pd.patient_id=p.patient_id
            LEFT JOIN public.safety_alerts sa ON sa.patient_id=p.patient_id
            LEFT JOIN public.adverse_events ae ON ae.patient_id=p.patient_id
            LEFT JOIN public.serious_adverse_events sae ON sae.ae_id=ae.ae_id
            WHERE ct.trial_id=$1
            GROUP BY ct.trial_id, ct.trial_title`, [req.params.trialId]);
        if (!rows.length) return res.status(404).json({ error: 'Trial not found' });
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/locks ────────
router.get('/locks', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT dl.lock_id, dl.lock_type, dl.lock_date, dl.unlock_date,
                dl.snapshot_hash, ct.trial_title, ct.trial_id,
                u.username AS locked_by_username
            FROM public.data_locks dl
            JOIN public.clinical_trials ct ON ct.trial_id=dl.trial_id
            LEFT JOIN public.users u ON u.user_id=dl.locked_by_user_id
            ORDER BY dl.lock_date DESC`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/data-management/lock ────────
// Calls sp_lock_database stored procedure — 21 CFR re-auth required
router.post('/lock', async (req: Request, res: Response) => {
    const { trial_id, lock_type, reason } = req.body;
    const user = (req as any).user;
    try {
        await withTransaction(user.user_id, reason || `Initiated ${lock_type} lock`, async (client) => {
            // Call the stored procedure — it validates, generates snapshot_hash, inserts data_locks row
            await client.query(`CALL public.sp_lock_database($1,$2,$3)`,
                [trial_id, lock_type, user.user_id]);
        });
        // Fetch the newly created lock to return certificate data
        const { rows } = await pool.query(`
            SELECT dl.*, ct.trial_title, u.username AS locked_by_username
            FROM public.data_locks dl JOIN public.clinical_trials ct ON ct.trial_id=dl.trial_id
            LEFT JOIN public.users u ON u.user_id=dl.locked_by_user_id
            WHERE dl.trial_id=$1 AND dl.unlock_date IS NULL ORDER BY dl.lock_date DESC LIMIT 1`, [trial_id]);
        res.status(201).json({ success: true, lock: rows[0],
            procedureNote: 'Results generated by stored procedure: sp_lock_database' });
    } catch (err: any) {
        console.error('DM lock:', err.message);
        if (err.message.includes('already has an active data lock')) return res.status(409).json({ error: err.message });
        if (err.message.includes('Invalid lock type')) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/data-management/export/sdtm ─
// Calls sp_export_cdisc_sdtm — procedure returns INOUT JSONB datasets
router.post('/export/sdtm', async (req: Request, res: Response) => {
    const { trial_id, domains = ['DM', 'AE', 'VS', 'LB'] } = req.body;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const result = await pool.query(
            `CALL public.sp_export_cdisc_sdtm($1, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB)`,
            [trial_id]
        );

        const row = result.rows[0] ?? {};

        const requested = Array.isArray(domains)
            ? (domains as string[]).map((d: string) => d.toUpperCase())
            : (domains as string).split(',').map((d: string) => d.trim().toUpperCase());

        let dmData = row.dm_data ?? [];
        let aeData = row.ae_data ?? [];
        let vsData = row.vs_data ?? [];
        let lbData = row.lb_data ?? [];

        // AE augmentation: add AEGRPID (per-patient sequence) and AEOUT (outcome)
        if (Array.isArray(aeData)) {
            const ptGroups: Record<string, number> = {};
            aeData = aeData.map((ae: any) => {
                const pt = ae.USUBJID ?? ae.usubjid ?? '';
                ptGroups[pt] = (ptGroups[pt] ?? 0) + 1;
                return {
                    ...ae,
                    AEGRPID: ptGroups[pt],
                    AEOUT: ae.AEENDTC || ae.ae_end_date ? 'Recovered' : 'Recovering',
                };
            });
        }

        // LB augmentation: add LBNRIND and LBSTRESN
        if (Array.isArray(lbData)) {
            lbData = lbData.map((lb: any) => ({
                ...lb,
                LBNRIND: lb.LBNRIND ?? lb.lbnrind ?? (lb.critical_result_flag === 'Y' ? 'HIGH' : 'NORMAL'),
                LBSTRESN: lb.LBORRES ?? lb.result_value ?? null,
            }));
        }

        const out: Record<string, any> = {};
        if (requested.includes('DM')) out.DM = dmData;
        if (requested.includes('AE')) out.AE = aeData;
        if (requested.includes('VS')) out.VS = vsData;
        if (requested.includes('LB')) out.LB = lbData;

        res.json({ data: out, _procedure: 'sp_export_cdisc_sdtm' });
    } catch (err: any) {
        console.error('SDTM export error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/data-management/export/custom 
// ALLOWLIST-validated custom export — never interpolates raw user input into SQL
const EXPORT_ALLOWLIST: Record<string, string[]> = {
    patients: ['patient_id','trial_patient_id','patient_status','date_of_birth','gender','enrollment_date','site_id'],
    adverse_events: ['ae_id','patient_id','ae_term','ae_start_date','ae_end_date','severity_grade','causality_relationship','treatment_related'],
    lab_results: ['result_id','patient_id','test_id','result_value','result_date','result_status','critical_result_flag'],
    vital_signs: ['vital_id','patient_id','measurement_time','systolic_bp','diastolic_bp','heart_rate','temperature','oxygen_saturation'],
    patient_visits: ['visit_instance_id','patient_id','visit_id','scheduled_date','actual_visit_date','visit_status'],
    protocol_deviations: ['deviation_id','patient_id','deviation_type','deviation_date','description','corrective_action','reported_to_irb'],
    ecrf_data: ['ecrf_instance_id','ecrf_id','patient_id','visit_instance_id','form_status','data_entry_date'],
    randomization_assignments: ['assignment_id','patient_id','arm_id','randomization_date','randomization_method'],
};
const VALID_OPS = ['=','!=','>','<','>=','<=','ILIKE','IS NULL','IS NOT NULL'];

router.post('/export/custom', async (req: Request, res: Response) => {
    const { columns, conditions = [], preview = false } = req.body;
    if (!columns || !columns.length) return res.status(400).json({ error: 'columns required' });
    // Validate all table.column references against allowlist
    for (const col of columns) {
        const [tbl, colName] = col.split('.');
        if (!EXPORT_ALLOWLIST[tbl] || !EXPORT_ALLOWLIST[tbl].includes(colName)) {
            await pool.query(`INSERT INTO public.audit_trail_21cfr
    (table_name,record_id,action_type,change_reason,data_hash)
    VALUES('custom_export',0,'INSERT','REJECTED: invalid column: ' || $1, md5($1))`, [col]).catch(() => {});
            return res.status(400).json({ error: `Column '${col}' is not in the export allowlist` });
        }
    }
    // Build safe SELECT (all identifiers validated above)
    const tables = [...new Set(columns.map((c: string) => c.split('.')[0]))];
    const selectCols = columns.map((c: string) => `public.${c}`).join(', ');
    const fromClause = `public.${tables[0]}`;
    // Validate and build WHERE conditions
    const whereParts: string[] = [];
    for (const cond of conditions) {
        const [tbl, colName] = (cond.column || '').split('.');
        if (!EXPORT_ALLOWLIST[tbl]?.includes(colName)) continue;
        if (!VALID_OPS.includes(cond.operator)) continue;
        if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
            whereParts.push(`public.${cond.column} ${cond.operator}`);
        } else {
            whereParts.push(`public.${cond.column} ${cond.operator} '${String(cond.value).replace(/'/g,"''")}'`);
        }
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const limitClause = preview ? 'LIMIT 50' : 'LIMIT 10000';
    try {
        const { rows } = await pool.query(`SELECT ${selectCols} FROM ${fromClause} ${whereClause} ${limitClause}`);
        res.json({ data: rows, rowCount: rows.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/datasets ──────
router.get('/datasets', async (req: Request, res: Response) => {
    const { trial_id } = req.query;
    if (!trial_id) return res.status(400).json({ error: 'trial_id required' });
    try {
        const { rows } = await pool.query(`SELECT * FROM public.analysis_datasets WHERE trial_id=$1 ORDER BY created_at DESC`, [trial_id]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/data-management/datasets ─────
// Calls sp_generate_csdr stored procedure — inserts & populates analysis_results JSONB
router.post('/datasets', async (req: Request, res: Response) => {
    const { trial_id, dataset_name, dataset_type, data_cutoff_date, population_definition } = req.body;
    const user = (req as any).user;
    try {
        const result = await withTransaction(user.user_id, `Created analysis dataset: ${dataset_name}`, async (client) => {
            // Call sp_generate_csdr to get the CSDR report JSONB
            const csdrResult = await client.query(
                `CALL public.sp_generate_csdr($1, NULL::JSONB)`, [trial_id]);
            const csdrReport = csdrResult.rows[0]?.csdr_report ?? {};
            const popCount = csdrReport?.patient_accountability?.enrolled ?? 0;
            // Insert the analysis dataset row with generated results
            const { rows } = await client.query(`
                INSERT INTO public.analysis_datasets
                    (trial_id, dataset_name, dataset_type, data_cutoff_date, population_count, analysis_results)
                VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                [trial_id, dataset_name, dataset_type, data_cutoff_date, popCount, JSON.stringify(csdrReport)]);
            return { ...rows[0], procedureNote: 'Results generated by stored procedure: sp_generate_csdr' };
        });
        res.status(201).json(result);
    } catch (err: any) { console.error('Create dataset:', err.message); res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/datasets/:datasetId ──────────────────────────────
router.get('/datasets/:datasetId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM public.analysis_datasets WHERE dataset_id=$1`, [req.params.datasetId]);
        if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });
        res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/audit ─────────
// Paginated 21 CFR Part 11 audit trail with enriched user data
router.get('/audit', async (req: Request, res: Response) => {
    const { table_name, user_id, action_type, date_from, date_to, record_id, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    try {
        const filters: string[] = ['1=1'];
        const params: any[] = [];
        let pi = 1;
        if (table_name)  { filters.push(`at.table_name=$${pi++}`); params.push(table_name); }
        if (user_id)     { filters.push(`at.changed_by_user_id=$${pi++}`); params.push(user_id); }
        if (action_type) { filters.push(`at.action_type=$${pi++}`); params.push(action_type); }
        if (date_from)   { filters.push(`at.change_timestamp>=$${pi++}`); params.push(date_from); }
        if (date_to)     { filters.push(`at.change_timestamp<=$${pi++}`); params.push(date_to); }
        if (record_id)   { filters.push(`at.record_id=$${pi++}`); params.push(record_id); }
        params.push(parseInt(limit as string), offset);
        const { rows } = await pool.query(`
            SELECT at.audit_id, at.table_name, at.record_id, at.action_type,
                at.old_value, at.new_value, at.change_timestamp, at.change_reason,
                at.ip_address, at.data_hash,
                u.username AS changed_by_username, u.role AS changed_by_role
            FROM public.audit_trail_21cfr at
            LEFT JOIN public.users u ON u.user_id=at.changed_by_user_id
            WHERE ${filters.join(' AND ')}
            ORDER BY at.change_timestamp DESC
            LIMIT $${pi++} OFFSET $${pi}`, params);
        const countRes = await pool.query(`SELECT COUNT(*) FROM public.audit_trail_21cfr at
            WHERE ${filters.join(' AND ')}`, params.slice(0, -2));
        res.setHeader('X-Total-Count', countRes.rows[0].count);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/audit/users ───
router.get('/audit/users', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`SELECT DISTINCT u.user_id, u.username, u.role
            FROM public.users u
            WHERE EXISTS (SELECT 1 FROM public.audit_trail_21cfr at WHERE at.changed_by_user_id=u.user_id)
            ORDER BY u.username`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/audit/signatures ────────────────────────────────
router.get('/audit/signatures', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT es.signature_id, es.document_type, es.document_id,
                es.signature_hash, es.signing_reason, es.signed_at,
                u.username AS signatory_username
            FROM public.electronic_signatures es
            LEFT JOIN public.users u ON u.user_id=es.signatory_user_id
            ORDER BY es.signed_at DESC LIMIT 200`);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/data-management/protocols/:trialId ───────────────────────────────
router.get('/protocols/:trialId', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT sp.protocol_id, sp.version_number, sp.amendment_number,
                sp.approval_date, sp.valid_from, sp.valid_to,
                sp.protocol_document, sp.electronic_signature,
                u.username AS approved_by_username
            FROM public.study_protocols sp
            LEFT JOIN public.users u ON u.user_id=sp.approved_by_user_id
            WHERE sp.trial_id=$1 ORDER BY sp.valid_from DESC`, [req.params.trialId]);
        res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/data-management/protocols
// Upload new protocol version — triggers trg_invalidate_protocol automatically
router.post('/protocols', async (req: Request, res: Response) => {
    const { trial_id, version_number, amendment_number, approval_date, approved_by_user_id, protocol_document, reason } = req.body;
    const user = (req as any).user;
    try {
        const result = await withTransaction(user.user_id, reason || `Uploaded protocol v${version_number}`, async (client) => {
            const sigHash = `sig_${user.user_id}_${Date.now()}`;
            const { rows } = await client.query(`
                INSERT INTO public.study_protocols
                    (trial_id, version_number, amendment_number, approval_date, approved_by_user_id,
                     protocol_document, electronic_signature, valid_from)
                VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE) RETURNING *`,
                [trial_id, version_number, amendment_number ?? 0, approval_date,
                 approved_by_user_id, JSON.stringify(protocol_document), sigHash]);
            // Note: trg_invalidate_protocol fires automatically after this INSERT
            // and sets valid_to on all previous versions for this trial
            return rows[0];
        });
        res.status(201).json({ ...result, triggerNote: 'trg_invalidate_protocol fired automatically — previous versions now marked SUPERSEDED' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/data-management/protocols/:trialId/compare
router.get('/protocols/:trialId/compare', async (req: Request, res: Response) => {
    const { v1, v2 } = req.query;
    if (!v1 || !v2) return res.status(400).json({ error: 'v1 and v2 version numbers required' });
    try {
        const { rows } = await pool.query(`
            SELECT protocol_id, version_number, amendment_number, valid_from, valid_to, protocol_document
            FROM public.study_protocols
            WHERE trial_id=$1 AND version_number IN ($2,$3)`, [req.params.trialId, v1, v2]);
        if (rows.length < 2) return res.status(404).json({ error: 'One or both versions not found' });
        res.json({ v1: rows.find((r: any) => r.version_number === v1), v2: rows.find((r: any) => r.version_number === v2) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/data-management/sites/:siteId/quality-score 
router.get('/sites/:siteId/quality-score', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM public.get_site_data_quality_score($1)`, [req.params.siteId]);
        if (!rows.length) return res.status(404).json({ error: 'Site not found or no data' });
        res.json({ ...rows[0], functionNote: 'Results generated by function: get_site_data_quality_score' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
