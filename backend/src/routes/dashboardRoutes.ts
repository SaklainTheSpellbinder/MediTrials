import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    try {
        const role = req.user?.role;
        const tokenSiteId = req.user?.site_id;
        const querySiteId = req.query.site_id;
        const isSiteScopedRole = role === 'Principal_Investigator' || role === 'Study_Coordinator';
        const siteId = isSiteScopedRole ? tokenSiteId : querySiteId;

        if (!siteId) {
            return res.status(400).json({ error: 'Missing site_id' });
        }

        const result = await pool.query('SELECT * FROM mv_pi_dashboard_stats WHERE site_id = $1', [siteId]);

        //If view is empty or no data for this site, refresh
        if (result.rows.length === 0) {
            await pool.query('REFRESH MATERIALIZED VIEW mv_pi_dashboard_stats');
            const newResult = await pool.query('SELECT * FROM mv_pi_dashboard_stats WHERE site_id = $1', [siteId]);

            if (newResult.rows.length === 0) {
                // Still no data, return default structure with 0s
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
            return res.json(newResult.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (err: any) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: 'Error Fetching Data from view' });
    }
});

// POST /api/dashboard/refresh
// This is called when a new patient is added
router.post('/refresh', async (req, res) => {
    try {
        await pool.query('REFRESH MATERIALIZED VIEW mv_pi_dashboard_stats');
        res.json({ message: 'Dashboard stats updated' });
    } catch (err: any) {
        res.status(500).json({ error: 'PI_Dashboard_MV Refresh failed' });
    }
});

export default router;