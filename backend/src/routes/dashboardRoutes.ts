import { Router } from 'express';
import { pool } from '../config/db'; // The file you created in Step 1

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    try {
        // 1. Query the Materialized View (Super fast)
        const result = await pool.query('SELECT * FROM mv_dashboard_stats');
        
        // 2. If view is empty (first run), try to refresh it
        if (result.rows.length === 0) {
            await pool.query('REFRESH MATERIALIZED VIEW mv_dashboard_stats');
            const newResult = await pool.query('SELECT * FROM mv_dashboard_stats');
            return res.json(newResult.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/dashboard/refresh
// Call this when a new patient is added!
router.post('/refresh', async (req, res) => {
    try {
        await pool.query('REFRESH MATERIALIZED VIEW mv_dashboard_stats');
        res.json({ message: 'Dashboard stats updated' });
    } catch (err: any) {
        res.status(500).json({ error: 'Refresh failed' });
    }
});

export default router;