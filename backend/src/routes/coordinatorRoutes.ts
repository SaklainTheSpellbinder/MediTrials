import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// Middleware to ensure site_id is provided (can be moved to a shared middleware)
const requireSiteId = (req: any, res: any, next: any) => {
    if (!req.query.site_id) {
        return res.status(400).json({ error: 'Missing site_id' });
    }
    next();
};

// GET /api/coordinator/stats
router.get('/stats', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;

        // Using the query logic from 002_get_coordinator_stats.sql
        const query = `
            SELECT
                (SELECT COUNT(*) FROM patient_visits pv 
                 JOIN patients p ON pv.patient_id = p.patient_id 
                 WHERE p.site_id = $1 AND pv.scheduled_date = CURRENT_DATE) as today_visits,

                (SELECT COUNT(*) FROM lab_results lr
                 JOIN patients p ON lr.patient_id = p.patient_id
                 WHERE p.site_id = $1 AND lr.result_status = 'Pending') as pending_labs,

                (SELECT COUNT(*) FROM ecrf_data ed
                 JOIN patients p ON ed.patient_id = p.patient_id
                 WHERE p.site_id = $1 AND ed.form_status = 'In Progress') as incomplete_ecrfs,

                (SELECT COUNT(*) FROM data_queries dq
                 JOIN ecrf_data ed ON dq.ecrf_instance_id = ed.ecrf_instance_id
                 JOIN patients p ON ed.patient_id = p.patient_id
                 WHERE p.site_id = $1 AND dq.query_status = 'Open') as open_queries;
        `;

        const result = await pool.query(query, [siteId]);
        res.json(result.rows[0]);
    } catch (err: any) {
        console.error('Coordinator Stats Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/visits/today
router.get('/visits/today', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;

        // Logic from 001_get_todays_visits.sql
        const query = `
            SELECT 
                p.full_name,
                p.trial_patient_id,
                vs.visit_name,
                pv.scheduled_date,
                pv.visit_status,
                pv.visit_window_status,
                pv.visit_instance_id
            FROM 
                patient_visits pv
            JOIN 
                patients p ON pv.patient_id = p.patient_id
            JOIN 
                visit_schedules vs ON pv.visit_id = vs.visit_id
            WHERE 
                p.site_id = $1
                AND pv.scheduled_date = CURRENT_DATE
            ORDER BY 
                pv.scheduled_date ASC;
        `;

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

        // Logic from 003_get_pending_labs.sql
        const query = `
            SELECT
                lr.result_id,
                p.full_name,
                p.trial_patient_id,
                lt.test_name,
                lr.result_status,
                lr.created_at,
                vs.visit_name
            FROM 
                lab_results lr
            JOIN 
                patients p ON lr.patient_id = p.patient_id
            JOIN 
                laboratory_tests lt ON lr.test_id = lt.test_id
            JOIN
                patient_visits pv ON lr.visit_instance_id = pv.visit_instance_id
            JOIN
                visit_schedules vs ON pv.visit_id = vs.visit_id
            WHERE
                p.site_id = $1
                AND lr.result_status = 'Pending'
            ORDER BY
                lr.created_at DESC;
        `;

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

        const query = `
            UPDATE lab_results
        SET
        result_value = $1,
            result_status = 'Completed',
            result_date = CURRENT_TIMESTAMP
        WHERE
        result_id = $2
        RETURNING *;
        `;

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

        // Try to set status to 'Checked In' (requires DB constraint update)
        // If DB constraint fails, this will throw an error, which is expected behavior until schema is fixed.
        const query = `
            UPDATE patient_visits
        SET
        visit_status = 'Checked In',
            updated_at = CURRENT_TIMESTAMP
        WHERE
        visit_instance_id = $1
        RETURNING *;
        `;

        const result = await pool.query(query, [visit_instance_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        res.json({ message: 'Patient checked in successfully', data: result.rows[0] });
    } catch (err: any) {
        console.error('Check-In Error:', err);
        res.status(500).json({ error: 'Server Error. Ensure DB constraint allows "Checked In" status.' });
    }
});

export default router;
