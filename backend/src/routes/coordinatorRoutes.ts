import { Router } from 'express';
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

const router = Router();

const queriesDir = path.join(__dirname, '../../../database/study_coordinator_queries');
const getQuery = (filename: string) => fs.readFileSync(path.join(queriesDir, filename), 'utf8');

// Middleware to ensure site_id is provided (can be moved to a shared middleware)
const requireSiteId = (req: any, res: any, next: any) => {
    if (!req.query.site_id && req.method === 'GET') {
        return res.status(400).json({ error: 'Missing site_id' });
    }
    // For POST check req.body.site_id or req.query.site_id
    if (req.method === 'POST' && !req.query.site_id && !req.body.site_id) {
         // allow pass if site_id is implicitly not needed for specific updates, but standard is pass site_id
    }
    next();
};

// GET /api/coordinator/stats
router.get('/stats', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;
        const query = getQuery('002_get_coordinator_stats.sql');

        const result = await pool.query(query, [siteId]);
        const stats = result.rows[0] || {};
        res.json({
            today_visits: parseInt(stats.today_visits || '0'),
            pending_labs: parseInt(stats.pending_labs || '0'),
            incomplete_ecrfs: parseInt(stats.incomplete_ecrfs || '0'),
            open_queries: parseInt(stats.open_queries || '0')
        });
    } catch (err: any) {
        console.error('Coordinator Stats Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/visits/today
router.get('/visits/today', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;
        const query = getQuery('001_get_todays_visits.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Visits Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/labs/pending
router.get('/labs/pending', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;
        const query = getQuery('003_get_pending_labs.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Labs Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/labs/update
router.post('/labs/update', requireSiteId, async (req, res) => {
    try {
        const { result_id, result_value } = req.body;
        if (!result_id || result_value === undefined) {
            return res.status(400).json({ error: 'Missing result_id or result_value' });
        }
        
        const query = getQuery('004_update_lab_result.sql');
        const result = await pool.query(query, [result_value, result_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lab result not found' });
        }

        res.json({ message: 'Lab result updated successfully', data: result.rows[0] });
    } catch (err: any) {
        console.error('Update Lab Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/visits/checkin
router.post('/visits/checkin', requireSiteId, async (req, res) => {
    try {
        const { visit_instance_id } = req.body;
        if (!visit_instance_id) {
            return res.status(400).json({ error: 'Missing visit_instance_id' });
        }

        const query = getQuery('005_update_visit_checkin.sql');
        const result = await pool.query(query, [visit_instance_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        res.json({ message: 'Patient checked in successfully', data: result.rows[0] });
    } catch (err: any) {
        console.error('Check-In Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

export default router;
