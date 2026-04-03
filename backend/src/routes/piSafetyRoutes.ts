import { Router } from 'express';
import { pool } from '../config/db';
import { requireRole } from '../middleware/authMiddleware'; 

const router = Router();
router.use(requireRole(['Principal_Investigator']));


const requirePI = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'Principal_Investigator') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

//GET /api/pi-safety/dashboard 
router.get('/dashboard', requirePI, async (req: any, res: any) => {
    try {
        const siteId = req.user.site_id;
        if (!siteId) {
            return res.status(400).json({ error: 'Missing site_id' });
        }

        // 1. KPIs
        const kpiQuery = `
            SELECT 
                COUNT(sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE') as active_alerts,
                COUNT(ae.ae_id) FILTER (WHERE ae.ae_start_date >= date_trunc('month', CURRENT_DATE)) as ae_this_month,
                COUNT(sae.sae_id) FILTER (WHERE sae.sae_status = 'Open') as open_saes,
                COUNT(sae.sae_id) FILTER (WHERE sae.report_deadline_date < CURRENT_DATE AND sae.report_submitted_date IS NULL) as overdue_saes
            FROM public.patients p
            LEFT JOIN public.safety_alerts sa ON sa.patient_id = p.patient_id AND sa.alert_severity IN ('CRITICAL', 'SEVERE')
            LEFT JOIN public.adverse_events ae ON ae.patient_id = p.patient_id
            LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
            WHERE p.site_id = $1
        `;
        const kpiRes = await pool.query(kpiQuery, [siteId]);

        // 2. Active Alerts Feed
        const alertsQuery = `
            SELECT sa.alert_id, sa.alert_code, sa.alert_message, sa.alert_severity, sa.created_at,
                   p.trial_patient_id,
                   FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.created_at)) / 60)::INT AS minutes_open
            FROM public.safety_alerts sa
            JOIN public.patients p ON p.patient_id = sa.patient_id
            WHERE p.site_id = $1 AND sa.alert_status = 'ACTIVE'
            ORDER BY sa.created_at DESC LIMIT 10
        `;
        const alertsRes = await pool.query(alertsQuery, [siteId]);

        // 3. Recent AEs
        const aeQuery = `
            SELECT ae.ae_id, ae.ae_term, ae.severity_grade, ae.ae_start_date, ae.causality_relationship, ae.treatment_related,
                   p.trial_patient_id,
                   sae.sae_report_number
            FROM public.adverse_events ae
            JOIN public.patients p ON p.patient_id = ae.patient_id
            LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
            WHERE p.site_id = $1
            ORDER BY ae.ae_start_date DESC LIMIT 10
        `;
        const aeRes = await pool.query(aeQuery, [siteId]);

        // 4. Overdue and Pending SAEs
        const saeQuery = `
            SELECT sae.sae_report_number, p.trial_patient_id,
                   ae.ae_term, ae.severity_grade, sae.report_deadline_date, sae.sae_status,
                   (CURRENT_DATE - sae.report_deadline_date) AS days_overdue,
                   EXTRACT(EPOCH FROM (sae.report_deadline_date::TIMESTAMPTZ - NOW())) / 3600 AS hours_until_deadline
            FROM public.serious_adverse_events sae
            JOIN public.adverse_events ae ON ae.ae_id = sae.ae_id
            JOIN public.patients p ON p.patient_id = ae.patient_id
            WHERE p.site_id = $1 
              AND sae.sae_status NOT IN ('Reported','Closed')
              AND sae.report_submitted_date IS NULL
            ORDER BY sae.report_deadline_date ASC LIMIT 5
        `;
        const saeRes = await pool.query(saeQuery, [siteId]);

        // 5. AE Category Trend for Site (Last 30 days)
        const gradeTrend = await pool.query(
            `SELECT 
               COUNT(*) FILTER (WHERE ae.severity_grade = 1) AS grade1,
               COUNT(*) FILTER (WHERE ae.severity_grade = 2) AS grade2,
               COUNT(*) FILTER (WHERE ae.severity_grade = 3) AS grade3,
               COUNT(*) FILTER (WHERE ae.severity_grade = 4) AS grade4,
               COUNT(*) FILTER (WHERE ae.severity_grade = 5) AS grade5
             FROM public.adverse_events ae
             JOIN public.patients p ON p.patient_id = ae.patient_id
             WHERE p.site_id = $1 AND ae.ae_start_date >= NOW() - INTERVAL '30 days'`,
            [siteId]
        );

        res.json({
            kpis: kpiRes.rows[0],
            alerts: alertsRes.rows,
            aes: aeRes.rows,
            saes: saeRes.rows,
            gradeTrend: gradeTrend.rows[0],
        });

    } catch (err: any) {
        console.error('PI Safety Dashboard Error:', err);
        res.status(500).json({ error: err.message });
    }
});

//GET /api/pi-safety/site-overview
router.get('/site-overview', requirePI, async (req: any, res: any) => {
    try {
        const siteId = req.user.site_id;
        if (!siteId) return res.status(400).json({ error: 'Missing site_id' });

        const result = await pool.query(
            `SELECT ss.institution_name,
                    COUNT(DISTINCT p.patient_id) as patient_count,
                    COUNT(DISTINCT ae.ae_id) as total_ae,
                    COUNT(DISTINCT sae.sae_id) as total_sae
             FROM public.study_sites ss
             LEFT JOIN public.patients p ON p.site_id = ss.site_id
             LEFT JOIN public.adverse_events ae ON ae.patient_id = p.patient_id
             LEFT JOIN public.serious_adverse_events sae ON sae.ae_id = ae.ae_id
             WHERE ss.site_id = $1
             GROUP BY ss.site_id, ss.institution_name`,
            [siteId]
        );

        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/pi-safety/alerts/:alertId/acknowledge ────────────────────────────
// PI can acknowledge alerts directly from the safety monitoring page.
router.put('/alerts/:alertId/acknowledge', requirePI, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const alertId = parseInt(req.params.alertId);
        const { reason } = req.body;
        const userId = req.user?.user_id;
        const siteId = req.user?.site_id;

        if (!reason) { 
            await client.query('ROLLBACK'); 
            return res.status(400).json({ error: 'reason required' }); 
        }

        // Verify the alert belongs to PI's site
        const verify = await client.query(
            `SELECT p.site_id FROM public.safety_alerts sa JOIN public.patients p ON sa.patient_id = p.patient_id WHERE sa.alert_id = $1`, [alertId]
        );
        if (verify.rows.length === 0 || verify.rows[0].site_id !== siteId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access denied to this alert' });
        }

        await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
        await client.query(`SET LOCAL app.change_reason = '${reason.replace(/'/g, "''")}'`);

        await client.query(
            `UPDATE public.safety_alerts SET alert_status='ACKNOWLEDGED', acknowledged_by_user_id=$1 WHERE alert_id=$2`,
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

export default router;
