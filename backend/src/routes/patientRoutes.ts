// backend/routes/patientRoutes.ts
import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
const router = Router();

// GET /api/patients
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.institution_name 
      FROM patients p
      LEFT JOIN study_sites s ON p.site_id = s.id
      ORDER BY p.id
    `);
    res.json({ success: true, patients: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients (Register new)
router.post('/', async (req, res) => {
  const { full_name, trial_patient_id, site_id, status } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO patients (full_name, trial_patient_id, site_id, patient_status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [full_name, trial_patient_id, site_id, status]
    );
    res.status(201).json({ success: true, patient: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;