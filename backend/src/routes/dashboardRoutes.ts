import { Router } from 'express';
import { pool } from '../config/db'; // The file you created in Step 1

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    try {
        const siteId = req.query.site_id;

        if (!siteId) {
            return res.status(400).json({ error: 'Missing site_id' });
        }

        // 1. Query the Materialized View (Super fast)
        const result = await pool.query('SELECT * FROM mv_pi_dashboard_stats WHERE site_id = $1', [siteId]);

        // 2. If view is empty (first run) or no data for this site, try to refresh it
        if (result.rows.length === 0) {
            // Note: In production, refreshing on every miss might be heavy if many sites are missing. 
            // Better to have a scheduled job. For now, we refresh if empty.
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
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/dashboard/refresh
// Call this when a new patient is added!
router.post('/refresh', async (req, res) => {
    try {
        await pool.query('REFRESH MATERIALIZED VIEW mv_pi_dashboard_stats');
        res.json({ message: 'Dashboard stats updated' });
    } catch (err: any) {
        res.status(500).json({ error: 'Refresh failed' });
    }
});

export default router;