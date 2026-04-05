import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator','Study_Coordinator']));

// Multi-tier password verification (Exact Match -> Bcrypt -> SHA256)
async function verifyUserPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  // Check 1: Exact match (Handles Quick-Fill buttons which send the raw hash)
  if (storedHash === inputPassword) return true;

  // Check 2: Bcrypt (Handles newly created users via Admin Dashboard)
  if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    return await bcrypt.compare(inputPassword, storedHash);
  }

  // Check 3: SHA-256 (Handles original seeded users if user types the plaintext password)
  const sha256Hash = crypto.createHash('sha256').update(inputPassword).digest('hex');
  if (storedHash === sha256Hash) return true;

  return false;
}

// GET /api/patients - Filter by user's site_id
router.get('/', async (req, res) => {
  try {
    const requestedSiteId = req.query.site_id ? parseInt(req.query.site_id as string) : null;
    const requestUser = req.user;
    
    // If user is a PI or Coordinator, force their site_id. Otherwise, allow filtering.
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
      params.push(effectiveSiteId);
      query += ` WHERE p.site_id = $1`;
    }

    query += ` ORDER BY p.patient_id`;

    const result = await pool.query(query, params);
    res.json(result.rows); 
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients
router.post('/', async (req: Request, res: Response) => {
  const requestUser = (req as any).user;
  const effectiveSiteId = requestUser?.site_id;
  
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
    await client.query(`SELECT set_config('app.current_user_id', $1::text, true)`, [requestUser?.user_id]);
    await client.query(`SELECT set_config('app.change_reason', $1::text, true)`, ['Registered new patient into screening']);
    const status = patient_status || 'Screened';
    
    // Passing NULL to trial_patient_id relies safely on BEFORE INSERT trigger to catch it.
    const result = await client.query(
      `INSERT INTO public.patients (
        trial_patient_id, full_name, site_id, patient_status, date_of_birth, gender, enrollment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [clientTrialId || null, full_name || null, effectiveSiteId, status, date_of_birth, gender, enrollment_date ?? null]
    );
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error creating patient:', err);
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'Patient ID already exists' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ success: false, error: 'Invalid patient_status for database constraint' });
    }
    if (err.code === '23502' && err.message.includes('trial_patient_id')) {
      return res.status(500).json({ success: false, error: 'Database trigger failed to auto-generate trial_patient_id (Null violation)' });
    }
    
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/patients/:patientId/record-consent — Coordinator attests eConsent
router.post('/:patientId/record-consent', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patientId, 10);
  const { consent_version, consent_date, e_signature_password } = req.body;
  const userId = req.user?.user_id;

  if (isNaN(patientId) || !consent_version || !consent_date || !e_signature_password || !userId) {
    return res.status(400).json({ error: 'patientId, consent_version, consent_date, and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify the User's Password using Multi-Tier Logic (21 CFR Part 11 Requirement)
    const userQuery = await client.query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
    if (userQuery.rows.length === 0) throw new Error('User not found');
    
    const isValidPassword = await verifyUserPassword(e_signature_password, userQuery.rows[0].password_hash);
    if (!isValidPassword) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid electronic signature password' });
    }

    // Validate Patient Status
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
      return res.status(409).json({ error: 'Consent can only be recorded for patients in screening.' });
    }

    // Ensure no duplicate consent
    const existing = await client.query(`SELECT consent_id FROM informed_consent WHERE patient_id = $1`, [patientId]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Informed consent is already on file for this patient.' });
    }

    // Generate cryptographic hash for the signature
    const sigPayload = `${userId}|${patientId}|${consent_version}|${new Date().toISOString()}`;
    const signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');

    // Insert Consent Record
    const consentResult = await client.query(
      `INSERT INTO informed_consent (patient_id, consent_version, consent_date, digital_signature_hash)
       VALUES ($1, $2, $3, $4) RETURNING consent_id`,
      [patientId, consent_version, consent_date, signatureHash]
    );
    const consentId = consentResult.rows[0].consent_id;

    // Record in global electronic_signatures table
    await client.query(
      `INSERT INTO electronic_signatures (signatory_user_id, document_type, document_id, signature_hash, signing_reason)
       VALUES ($1, 'Consent', $2, $3, 'Coordinator attested patient consent')`,
      [userId, consentId, signatureHash]
    );

    // Update Screening Status
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