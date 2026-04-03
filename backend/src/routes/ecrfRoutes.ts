import { Router } from 'express';
import { pool } from '../config/db';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator','Study_Coordinator']));
// POST /api/ecrf/submit
router.post('/submit', async (req, res) => {
    try {
        const {
            patient_id,
            visitDate,
            systolicBP,
            diastolicBP,
            heartRate,
            temp
        } = req.body;

        if (!patient_id) {
            return res.status(400).json({ error: 'Missing patient_id' });
        }

        // 1. Get the most recent visit for the patient to attach vitals to
        const visitQuery = `
            SELECT visit_instance_id 
            FROM patient_visits 
            WHERE patient_id = $1 
            ORDER BY scheduled_date DESC 
            LIMIT 1;
        `;
        const visitResult = await pool.query(visitQuery, [patient_id]);

        let visit_instance_id;

        if (visitResult.rows.length > 0) {
            visit_instance_id = visitResult.rows[0].visit_instance_id;
        } else {
            return res.status(400).json({ error: 'No visit found for this patient to attach clinical data.' });
        }

        const timestamp = visitDate ? new Date(visitDate).toISOString() : new Date().toISOString();

        // 2. Insert into ecrf_data (The Audit Wrap)
        const ecrfDataQuery = `
            INSERT INTO ecrf_data (
                ecrf_id,
                patient_id, 
                visit_instance_id, 
                form_status, 
                form_data
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING ecrf_instance_id;
        `;

        const rawFormData = JSON.stringify({
            systolicBP,
            diastolicBP,
            heartRate,
            temp,
            visitDate
        });

        await pool.query(ecrfDataQuery, [
            1, // Assuming ecrf_id 1 is 'Vital Signs' based on setup scripts
            patient_id,
            visit_instance_id,
            'Locked', // Or 'Signed' depending on protocol
            rawFormData
        ]);

        // 3. Insert into vital_signs (The Extracted Data)
        const insertQuery = `
            INSERT INTO vital_signs (
                patient_id, 
                visit_instance_id, 
                measurement_time, 
                systolic_bp, 
                diastolic_bp, 
                heart_rate, 
                temperature
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        const newVitals = await pool.query(insertQuery, [
            patient_id,
            visit_instance_id,
            timestamp,
            systolicBP ? parseInt(systolicBP) : null,
            diastolicBP ? parseInt(diastolicBP) : null,
            heartRate ? parseInt(heartRate) : null,
            temp ? parseFloat(temp) : null
        ]);

        res.json({
            success: true,
            message: 'eCRF clinical data saved successfully to both audit and vitals tables',
            data: newVitals.rows[0]
        });

    } catch (error) {
        console.error('Error submitting eCRF data:', error);
        res.status(500).json({ error: 'Internal Server Error while saving eCRF data' });
    }
});

export default router;
