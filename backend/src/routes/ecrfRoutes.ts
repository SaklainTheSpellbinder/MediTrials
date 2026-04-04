import { Router } from 'express';
import { pool } from '../config/db';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator','Study_Coordinator']));

// POST /api/ecrf/submit
router.post('/submit', async (req: any, res: any) => {
    const requestUser = req.user;
    
    // 1. Extract the snake_case payload we built in ClinicalForm.tsx
    const {
        patient_id,
        visit_instance_id: providedVisitInstanceId, // explicit visit from visit-gated workflow
        measurement_time,
        systolic_bp,
        diastolic_bp,
        heart_rate,
        temperature
    } = req.body;

    if (!patient_id) {
        return res.status(400).json({ error: 'Missing patient_id' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // START TRANSACTION

        // 2. Set 21 CFR Part 11 Audit Context
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [requestUser?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Entered eCRF Vital Signs data']);

        let visit_instance_id: number;

        if (providedVisitInstanceId) {
            // Use the explicitly provided visit_instance_id (visit-gated workflow)
            visit_instance_id = parseInt(providedVisitInstanceId);
        } else {
            // 3. Fallback: Get the most recent visit (legacy / backward-compat)
            const visitQuery = `
                SELECT visit_instance_id 
                FROM public.patient_visits 
                WHERE patient_id = $1 
                ORDER BY scheduled_date DESC 
                LIMIT 1;
            `;
            const visitResult = await client.query(visitQuery, [patient_id]);

            if (visitResult.rows.length === 0) {
                throw new Error('No visit found for this patient. Please schedule and check in a visit first.');
            }
            visit_instance_id = visitResult.rows[0].visit_instance_id;
        }

        const timestamp = measurement_time ? new Date(measurement_time).toISOString() : new Date().toISOString();

        // 4. Insert into ecrf_data (The Audit Wrap)
        const ecrfDataQuery = `
            INSERT INTO public.ecrf_data (
                ecrf_id,
                patient_id, 
                visit_instance_id, 
                form_status, 
                form_data
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING ecrf_instance_id;
        `;

        const rawFormData = JSON.stringify({
            systolic_bp,
            diastolic_bp,
            heart_rate,
            temperature,
            measurement_time
        });

        await client.query(ecrfDataQuery, [
            1, // Assuming ecrf_id 1 is 'Vital Signs'
            patient_id,
            visit_instance_id,
            'Locked', 
            rawFormData
        ]);

        // 5. Insert into vital_sign
        const insertQuery = `
            INSERT INTO public.vital_signs (
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

        const newVitals = await client.query(insertQuery, [
            patient_id,
            visit_instance_id,
            timestamp,
            systolic_bp,
            diastolic_bp,
            heart_rate,
            temperature
        ]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'eCRF clinical data saved successfully to both audit and vitals tables',
            data: newVitals.rows[0]
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error submitting eCRF data:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error while saving eCRF data' });
    } finally {
        client.release();
    }
});

export default router;