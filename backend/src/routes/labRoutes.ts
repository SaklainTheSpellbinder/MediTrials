import { Router } from 'express';
import { pool } from '../config/db';

const router = Router();

// Middleware to ensure site_id is provided
const requireSiteId = (req: any, res: any, next: any) => {
    if (!req.query.site_id) {
        return res.status(400).json({ error: 'Missing site_id' });
    }
    next();
};

// GET /api/labs
// Retrieves all lab results for patients at the specified site
router.get('/', requireSiteId, async (req, res) => {
    try {
        const siteId = req.query.site_id;

        // Query logic from 008_get_site_lab_results.sql
        const query = `
            SELECT 
                lr.result_id,
                p.trial_patient_id,
                p.trial_patient_id AS full_name,
                lt.test_name,
                lr.result_value,
                lr.result_date,
                lr.result_status,
                (lr.critical_result_flag = 'Y') as critical_result_flag,
                COALESCE(lt.reference_ranges->>LOWER(p.gender), lt.reference_ranges->>'all') as reference_range_text,
                lt.unit_of_measure,
                CASE 
                    WHEN lr.result_value <= lt.critical_low_value THEN 'Low'
                    WHEN lr.result_value >= lt.critical_high_value THEN 'High'
                    ELSE 'Normal'
                END as range_flag
            FROM lab_results lr
            JOIN laboratory_tests lt ON lr.test_id = lt.test_id
            JOIN patients p ON lr.patient_id = p.patient_id
            WHERE p.site_id = $1
            ORDER BY lr.result_date DESC;
        `;

        const result = await pool.query(query, [siteId]);
        res.json({ success: true, labs: result.rows });
    } catch (err: any) {
        console.error('Lab Results Error:', err);
        res.status(500).json({ error: 'Server Error fetching lab results' });
    }
});

// POST /api/labs/:result_id/review
// PI signs off / marks the lab result as Completed
router.post('/:result_id/review', async (req: any, res: any) => {
    try {
        const resultId = req.params.result_id;

        const query = `
            UPDATE lab_results 
            SET result_status = 'Completed'
            WHERE result_id = $1
            RETURNING *;
        `;

        const result = await pool.query(query, [resultId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lab result not found' });
        }
        res.json({ success: true, message: 'Lab result reviewed successfully', result: result.rows[0] });
    } catch (err: any) {
        console.error('Lab Review Error:', err);
        res.status(500).json({ error: 'Server Error reviewing lab result' });
    }
});

export default router;
