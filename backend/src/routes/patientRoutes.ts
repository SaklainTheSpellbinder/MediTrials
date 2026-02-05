// backend/routes/patientRoutes.ts
import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
const router = Router();

// GET /api/patients - Filter by user's site_id
router.get('/', async (req, res) => {
  try {
    const userSiteId = req.query.site_id ? parseInt(req.query.site_id as string) : null;

    let query = `
      SELECT p.*, s.institution_name 
      FROM patients p
      LEFT JOIN study_sites s ON p.site_id = s.site_id
    `;

    const params: any[] = [];

    // Filter by site if site_id is provided
    if (userSiteId) {
      query += ` WHERE p.site_id = $1`;
      params.push(userSiteId);
    }

    query += ` ORDER BY p.patient_id`;

    const result = await pool.query(query, params);
    res.json({ success: true, patients: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients - Create a new patient
router.post('/', async (req: Request, res: Response) => {
  const { trial_patient_id, full_name, date_of_birth, gender, patient_status, site_id, enrollment_date } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO patients 
      (trial_patient_id, full_name, date_of_birth, gender, patient_status, site_id, enrollment_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [trial_patient_id, full_name, date_of_birth, gender, patient_status, site_id || null, enrollment_date]
    );

    res.status(201).json({ success: true, patient: result.rows[0] });
  } catch (err: any) {
    console.error('Error creating patient:', err);
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Patient ID already exists' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;