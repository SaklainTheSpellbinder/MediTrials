import { Router } from 'express';
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';
import { requireRole } from '../middleware/authMiddleware';
import type { Request, Response } from 'express';
import '../middleware/authMiddleware';
const router = Router();
router.use(requireRole(['Study_Coordinator', 'Principal_Investigator']));

const queriesDir = path.join(__dirname, '../../../database/study_coordinator_queries');
const getQuery = (filename: string) => fs.readFileSync(path.join(queriesDir, filename), 'utf8');

// GET /api/coordinator/stats
router.get('/stats', async (req, res) => {
    try {
        const siteId = req.user?.site_id; 
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

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
router.get('/visits/today', async (req, res) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const query = getQuery('001_get_todays_visits.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Visits Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/labs/pending
router.get('/labs/pending', async (req, res) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const query = getQuery('003_get_pending_labs.sql');
        const result = await pool.query(query, [siteId]);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Labs Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/labs/update
router.post('/labs/update', async (req: Request, res: Response) => {
    const { result_id, result_value, change_reason } = req.body;
    
    if (!result_id || result_value === undefined) {
        return res.status(400).json({ error: 'Missing result_id or result_value' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // ADD THESE TWO LINES:
        const reason = change_reason || 'Lab result updated by coordinator';
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, [reason]);
        
        // 1. Update the lab result
        const query = getQuery('004_update_lab_result.sql');
        const result = await client.query(query, [result_value, result_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Lab result not found' });
        }

        

        await client.query('COMMIT');
        res.json({ message: 'Lab result updated successfully', data: result.rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Update Lab Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// POST /api/coordinator/visits/checkin
router.post('/visits/checkin', async (req: Request, res: Response) => {
    const { visit_instance_id, change_reason } = req.body;
    
    if (!visit_instance_id) {
        return res.status(400).json({ error: 'Missing visit_instance_id' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ADD THESE TWO LINES:
        const reason = change_reason || 'Patient checked in for visit';
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, [reason]);

        // 1. Update visit check-in status
        const query = getQuery('005_update_visit_checkin.sql');
        const result = await client.query(query, [visit_instance_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }

        

        await client.query('COMMIT');
        res.json({ message: 'Patient checked in successfully', data: result.rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Check-In Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// POST /api/coordinator/visits/complete
// Marks a Checked-In visit as Completed and stamps actual_visit_date = today.
// Body: { visit_instance_id }
router.post('/visits/complete', async (req: Request, res: Response) => {
    const { visit_instance_id } = req.body;

    if (!visit_instance_id) {
        return res.status(400).json({ error: 'Missing visit_instance_id' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Set audit context for trigger-based audit log
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Visit completed by coordinator/PI']);

        const query = getQuery('007_complete_visit.sql');
        const result = await client.query(query, [visit_instance_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found or not in Checked-In status' });
        }

        await client.query('COMMIT');
        res.json({ message: 'Visit marked as completed', data: result.rows[0] });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Complete Visit Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// GET /api/coordinator/patients — enrolled patients at SC's site (for scheduling / data entry dropdown)
router.get('/patients', async (req: any, res: any) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const result = await pool.query(
            `SELECT p.patient_id, p.trial_patient_id, p.full_name
             FROM public.patients p
             WHERE p.site_id = $1
               AND p.patient_status IN ('Active', 'Enrolled', 'Screened')
             ORDER BY p.trial_patient_id ASC`,
            [siteId]
        );
        res.json(result.rows);
    } catch (err: any) {
        console.error('Coordinator Patients Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/visit-schedules — all visit schedule templates for the site's trial
router.get('/visit-schedules', async (req: any, res: any) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const result = await pool.query(
            `SELECT vs.visit_id, vs.visit_name, vs.visit_number, vs.day_offset,
                    vs.visit_window_before_days, vs.visit_window_after_days
             FROM public.visit_schedules vs
             JOIN public.study_sites ss ON vs.trial_id = ss.trial_id
             WHERE ss.site_id = $1
             ORDER BY vs.visit_number ASC`,
            [siteId]
        );
        res.json(result.rows);
    } catch (err: any) {
        console.error('Visit Schedules Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/coordinator/visits/active — visits that are scheduled/checked-in (data entry gate)
// Accepts optional ?patient_id=N query param to filter by patient
router.get('/visits/active', async (req: any, res: any) => {
    try {
        const siteId = req.user?.site_id;
        if (!siteId) return res.status(403).json({ error: 'User is not assigned to a site' });

        const patientId = req.query.patient_id ? parseInt(req.query.patient_id as string) : null;

        let query = `
            SELECT pv.visit_instance_id, pv.scheduled_date, pv.actual_visit_date, pv.visit_status,
                   vs.visit_name, vs.visit_number,
                   p.trial_patient_id, p.patient_id, p.full_name
            FROM public.patient_visits pv
            JOIN public.visit_schedules vs ON pv.visit_id = vs.visit_id
            JOIN public.patients p ON pv.patient_id = p.patient_id
            WHERE p.site_id = $1
              AND pv.visit_status IN ('Checked In', 'In Progress', 'Scheduled')
        `;
        const params: any[] = [siteId];

        if (patientId) {
            params.push(patientId);
            query += ` AND pv.patient_id = $${params.length}`;
        }

        query += ` ORDER BY pv.scheduled_date DESC LIMIT 50`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err: any) {
        console.error('Active Visits Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/visits/schedule — schedule a new patient visit
router.post('/visits/schedule', async (req: any, res: any) => {
    const { patient_id, visit_id, scheduled_date } = req.body;

    if (!patient_id || !visit_id || !scheduled_date) {
        return res.status(400).json({ error: 'patient_id, visit_id, and scheduled_date are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ADD THESE TWO LINES:
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Visit scheduled by coordinator']);

        const result = await client.query(
            `INSERT INTO public.patient_visits (patient_id, visit_id, scheduled_date, visit_status)
             VALUES ($1, $2, $3, 'Scheduled')
             RETURNING visit_instance_id, scheduled_date, visit_status`,
            [patient_id, visit_id, scheduled_date]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Schedule Visit Error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This visit type is already scheduled for this patient.' });
        }
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// GET /api/coordinator/lab-tests — all rows from laboratory_tests table (for SC lab entry list)
router.get('/lab-tests', async (req: any, res: any) => {
    try {
        const result = await pool.query(
            `SELECT test_id, test_name, test_code_loinc, unit_of_measure,
                    reference_ranges, critical_low_value, critical_high_value
             FROM public.laboratory_tests
             ORDER BY test_name ASC`
        );
        res.json(result.rows);
    } catch (err: any) {
        console.error('Lab Tests Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/coordinator/lab-results/submit — insert a new lab result for a visit
// Body: { patient_id, visit_instance_id, test_id, result_value }
router.post('/lab-results/submit', async (req: any, res: any) => {
    const { patient_id, visit_instance_id, test_id, result_value } = req.body;
    if (!patient_id || !visit_instance_id || !test_id || result_value === undefined) {
        return res.status(400).json({ error: 'patient_id, visit_instance_id, test_id, and result_value are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ADD THESE TWO LINES:
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Lab result entered by coordinator during visit']);

        // Look up reference range to set critical flag
        const testRef = await client.query(
            `SELECT critical_low_value, critical_high_value FROM public.laboratory_tests WHERE test_id = $1`,
            [test_id]
        );
        const { critical_low_value, critical_high_value } = testRef.rows[0] || {};
        const isCritical = (critical_low_value != null && result_value <= critical_low_value)
                        || (critical_high_value != null && result_value >= critical_high_value);

        const insertResult = await client.query(
            `INSERT INTO public.lab_results
                (patient_id, test_id, visit_instance_id, result_value, result_status, critical_result_flag)
             VALUES ($1, $2, $3, $4, 'Pending', $5)
             RETURNING result_id, result_date`,
            [patient_id, test_id, visit_instance_id, result_value, isCritical ? 'Y' : 'N']
        );

        

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: insertResult.rows[0], critical: isCritical });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Submit Lab Result Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// POST /api/coordinator/adverse-events/submit
// Inserts a new adverse event linked to a patient visit.
// Body: { patient_id, visit_instance_id, ae_term, ae_start_date, ae_end_date?,
//         severity_grade, causality_relationship, treatment_related,
//         results_in_death, life_threatening, requires_hospitalization,
//         ae_description?, ae_status }
router.post('/adverse-events/submit', async (req: any, res: any) => {
    const {
        patient_id, visit_instance_id,
        ae_term, ae_start_date, ae_end_date,
        severity_grade, causality_relationship,
        treatment_related, results_in_death, life_threatening,
        requires_hospitalization, ae_description,
        ae_status = 'Active',
    } = req.body;

    if (!patient_id || !ae_term || !ae_start_date || !severity_grade) {
        return res.status(400).json({ error: 'patient_id, ae_term, ae_start_date, and severity_grade are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Set audit context (trigger-based audit logging)
        await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [req.user?.user_id]);
        await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Adverse event entered by coordinator during visit']);

        const result = await client.query(
            `INSERT INTO public.adverse_events
                (patient_id, visit_instance_id, ae_term, ae_start_date, ae_end_date,
                 severity_grade, causality_relationship, treatment_related,
                 results_in_death, life_threatening, requires_hospitalization,
                 ae_description, ae_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING ae_id, ae_term, severity_grade, ae_status`,
            [
                patient_id, visit_instance_id || null,
                ae_term, ae_start_date, ae_end_date || null,
                severity_grade, causality_relationship || null,
                treatment_related ?? null, results_in_death ?? false,
                life_threatening ?? false, requires_hospitalization ?? false,
                ae_description || null, ae_status,
            ]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Submit AE Error:', err);
        res.status(500).json({ error: err.message || 'Server Error' });
    } finally {
        client.release();
    }
});

export default router;