import { Router } from 'express';
import { pool } from '../config/db';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();

// GET /api/dashboard/stats
// GET /api/dashboard/stats
router.get('/stats', async (req: any, res: any) => {
    try {
        const role = req.user?.role;
        const tokenSiteId = req.user?.site_id;
        const querySiteId = req.query.site_id;
        
        const isSiteScopedRole = role === 'Principal_Investigator' || role === 'Study_Coordinator';
        const siteId = isSiteScopedRole ? tokenSiteId : querySiteId;

        if (!siteId) {
            return res.status(400).json({ error: 'Missing site_id' });
        }

        // Live calculation query written directly in the route
        const query = `
            WITH site_counts AS (
                SELECT 
                    site_id,
                    COUNT(patient_id) AS total_patients,
                    COUNT(CASE WHEN patient_status IN ('Active', 'Enrolled') THEN 1 END) AS active_patients,
                    COUNT(CASE WHEN patient_status = 'Screen Failure' THEN 1 END) AS screen_failures,
                    COUNT(CASE WHEN patient_status = 'Completed' THEN 1 END) AS completed_patients,
                    COUNT(CASE WHEN patient_status = 'Withdrawn' THEN 1 END) AS withdrawn_patients
                FROM public.patients
                WHERE site_id = $1
                GROUP BY site_id
            ),
            site_targets AS (
                SELECT site_id, target_enrollment 
                FROM public.study_sites
                WHERE site_id = $1
            )
            SELECT 
                st.site_id,
                COALESCE(sc.total_patients, 0)::INTEGER AS total_patients,
                COALESCE(sc.active_patients, 0)::INTEGER AS active_patients,
                COALESCE(sc.screen_failures, 0)::INTEGER AS screen_failures,
                
                -- Retention Rate
                CASE 
                    WHEN (COALESCE(sc.total_patients, 0) - COALESCE(sc.screen_failures, 0)) > 0 
                    THEN ROUND(
                        ((COALESCE(sc.active_patients, 0) + COALESCE(sc.completed_patients, 0))::DECIMAL / 
                        (sc.total_patients - sc.screen_failures) * 100), 
                        1
                    )
                    ELSE 0 
                END AS retention_rate,

                -- Enrollment Progress
                COALESCE(sc.total_patients, 0)::INTEGER AS enrollment_current,
                COALESCE(st.target_enrollment, 0)::INTEGER AS enrollment_target,
                
                -- Progress Percentage
                CASE 
                    WHEN COALESCE(st.target_enrollment, 0) > 0 
                    THEN ROUND((COALESCE(sc.total_patients, 0)::DECIMAL / st.target_enrollment * 100), 1)
                    ELSE 0 
                END AS enrollment_percentage
            FROM site_targets st
            LEFT JOIN site_counts sc ON st.site_id = sc.site_id;
        `;

        const result = await pool.query(query, [siteId]);

        // If the site exists but has NO patients yet, provide safe fallbacks
        if (result.rows.length === 0) {
            return res.json({
                site_id: siteId,
                total_patients: 0,
                active_patients: 0,
                screen_failures: 0,
                retention_rate: 0,
                enrollment_current: 0,
                enrollment_target: 0,
                enrollment_percentage: 0
            });
        }

        res.json(result.rows[0]);
    } catch (err: any) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: 'Error Fetching Live Stats' });
    }
});

export default router;