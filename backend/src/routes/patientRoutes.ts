import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator','Study_Coordinator']));

async function nextTrialPatientId(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }): Promise<string> {
  const maxIdResult = await client.query(`
    SELECT trial_patient_id FROM patients WHERE trial_patient_id ~ '^PT-\\d+$'
  `);
  let maxNum = 0;
  for (const row of maxIdResult.rows) {
    const numStr = row.trial_patient_id.split('-')[1];
    if (numStr) {
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `PT-${String(maxNum > 0 ? maxNum + 1 : 1).padStart(5, '0')}`;
}

// GET /api/patients - Filter by user's site_id
router.get('/', async (req, res) => {
  try {
    const requestedSiteId = req.query.site_id ? parseInt(req.query.site_id as string) : null;
    const requestUser = (req as Request).user;
    const isSiteScopedRole = ['Principal_Investigator', 'Study_Coordinator'].includes(requestUser?.role || '');
    const effectiveSiteId = isSiteScopedRole ? (requestUser?.site_id ?? null) : requestedSiteId;


    let query = `
      SELECT p.*, s.institution_name,
      (
        SELECT COALESCE(actual_visit_date, scheduled_date)
        FROM patient_visits pv
        WHERE pv.patient_id = p.patient_id AND pv.visit_status IN ('Completed', 'Checked In')
        ORDER BY COALESCE(actual_visit_date, scheduled_date) DESC 
        LIMIT 1
      ) as last_visit_date
      FROM patients p
      LEFT JOIN study_sites s ON p.site_id = s.site_id
    `;

    const params: any[] = [];

    if (effectiveSiteId) {
      query += ` WHERE p.site_id = $1`;
      params.push(effectiveSiteId);
    }

    query += ` ORDER BY p.patient_id`;

    const result = await pool.query(query, params);
    res.json({ success: true, patients: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients — Register a subject pre-enrollment (canonical schema: status Screened, not enrolled until PI signs off)
router.post('/', async (req: Request, res: Response) => {
  const requestUser = req.user;
  const isSiteScopedRole = ['Principal_Investigator', 'Study_Coordinator'].includes(requestUser?.role || '');
  const effectiveSiteId = isSiteScopedRole ? requestUser?.site_id : req.body.site_id;
  const {
    trial_patient_id: clientTrialId,
    full_name,
    date_of_birth,
    gender,
    patient_status,
    enrollment_date,
  } = req.body;

  if (!date_of_birth || !gender || !effectiveSiteId) {
    return res.status(400).json({
      success: false,
      error: 'date_of_birth, gender, and site_id are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trial_patient_id = clientTrialId || (await nextTrialPatientId(client));
    const status = patient_status || 'Screened';

    const result = await client.query(
      `INSERT INTO patients (
        trial_patient_id, full_name, site_id, patient_status, date_of_birth, gender, enrollment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [trial_patient_id, full_name || null, effectiveSiteId, status, date_of_birth, gender, enrollment_date ?? null]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, patient: result.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error creating patient:', err);
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Patient ID already exists' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ success: false, error: 'Invalid patient_status for database constraint' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/patients/:patientId/record-consent — Coordinator attests paper/eConsent (after Candidate)
router.post('/:patientId/record-consent', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patientId, 10);
  const { consent_version, consent_date, e_signature_password, recorded_by_user_id } = req.body;

  if (isNaN(patientId) || !consent_version || !consent_date || !e_signature_password) {
    return res.status(400).json({ error: 'patientId, consent_version, consent_date, and e_signature_password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRow = await client.query(
      `SELECT patient_id, patient_status, trial_patient_id, enrollment_date FROM patients WHERE patient_id = $1`,
      [patientId]
    );
    if (pRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (pRow.rows[0].patient_status !== 'Screened' || pRow.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Consent can only be recorded for patients in screening (status Screened, not yet enrolled).',
      });
    }

    const existing = await client.query(`SELECT consent_id FROM informed_consent WHERE patient_id = $1`, [patientId]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Informed consent is already on file for this patient.' });
    }

    const sigPayload = `${recorded_by_user_id}|${new Date().toISOString()}|${e_signature_password}`;
    const signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');

    await client.query(
      `INSERT INTO informed_consent (patient_id, consent_version, consent_date, digital_signature_hash)
       VALUES ($1, $2, $3, $4)`,
      [patientId, consent_version, consent_date, signatureHash]
    );

    const scr = await client.query(`SELECT screening_id FROM patient_screening WHERE patient_id = $1`, [patientId]);
    if (scr.rows.length === 0) {
      await client.query(
        `INSERT INTO patient_screening (patient_id, screening_status, eligibility_score)
         VALUES ($1, 'Pending Review', 0)`,
        [patientId]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Informed consent recorded. Patient is now in screening.',
      trial_patient_id: pRow.rows[0].trial_patient_id,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('record-consent error:', err);
    res.status(500).json({ error: 'Failed to record consent' });
  } finally {
    client.release();
  }
});

export default router;
