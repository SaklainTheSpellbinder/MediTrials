import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator', 'Study_Coordinator']));

// GET /api/labs
router.get('/', async (req: Request, res: Response) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) {
            return res.status(403).json({ error: 'User is not assigned to a site' });
        }
        const patientId = req.query.patient_id ? parseInt(req.query.patient_id as string) : null;

        let query = `
            SELECT 
                lr.result_id,
                p.trial_patient_id,
                p.full_name AS full_name,
                lt.test_name,
                lr.result_value,
                lr.result_date,
                lr.result_status,
                (lr.critical_result_flag = 'Y') as critical_result_flag,
                -- FIX: Use ->> for both to guarantee text output
                COALESCE(lt.reference_ranges->>LOWER(p.gender), lt.reference_ranges->>'all') as reference_range_text,
                lt.unit_of_measure,
                -- FIX: Handle NULL values so pending labs don't show as 'Normal'
                CASE 
                    WHEN lr.result_value IS NULL THEN 'Pending'
                    WHEN lr.result_value <= lt.critical_low_value THEN 'Low'
                    WHEN lr.result_value >= lt.critical_high_value THEN 'High'
                    ELSE 'Normal'
                END as range_flag
            FROM lab_results lr
            JOIN laboratory_tests lt ON lr.test_id = lt.test_id
            JOIN patients p ON lr.patient_id = p.patient_id
            WHERE p.site_id = $1
        `;

        const params: any[] = [siteId];

        // Safe check for valid number instead of truthiness
        if (patientId !== null && !isNaN(patientId)) {
            params.push(patientId);
            query += ` AND p.patient_id = $${params.length}`;
        }

        query += ` ORDER BY lr.result_date DESC;`;

        const result = await pool.query(query, params);

        // Optional but recommended: Log this "VIEW" action to your user_access_log!
        // Because viewing patient lab results is PHI, HIPAA usually requires tracking this read access.

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
