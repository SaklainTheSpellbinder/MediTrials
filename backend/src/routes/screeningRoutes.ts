import { Router } from 'express';
import { pool } from '../config/db';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();
router.use(requireRole(['Principal_Investigator', 'Study_Coordinator']));

const PI_QUEUE_PREFIX = '[PI_QUEUE]';

async function verifyUserPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  if (storedHash === inputPassword) return true;
  if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    return await bcrypt.compare(inputPassword, storedHash);
  }
  const sha256Hash = crypto.createHash('sha256').update(inputPassword).digest('hex');
  if (storedHash === sha256Hash) return true;
  return false;
}

function isQueuedForPiReview(overrideReason: string | null | undefined): boolean {
  return !!overrideReason && overrideReason.startsWith(PI_QUEUE_PREFIX);
}

function packOverrideReason(screening_data: any, justification: string | null, queued: boolean): string {
  const payload = JSON.stringify({ screening_data: screening_data || {}, justification: justification || '' });
  return queued ? `${PI_QUEUE_PREFIX}${payload}` : payload;
}

function unpackOverrideReason(raw: string | null | undefined): { screening_data: any; justification: string } {
  if (!raw) return { screening_data: {}, justification: '' };
  let jsonStr = raw;
  if (jsonStr.startsWith(PI_QUEUE_PREFIX)) jsonStr = jsonStr.slice(PI_QUEUE_PREFIX.length);
  try {
    const parsed = JSON.parse(jsonStr);
    return { screening_data: parsed.screening_data || {}, justification: parsed.justification || '' };
  } catch {
    return { screening_data: {}, justification: raw.replace(PI_QUEUE_PREFIX, '').trim() };
  }
}

async function ensureScreeningRow(client: any, patientId: number): Promise<number> {
  const r = await client.query(
    `SELECT screening_id FROM patient_screening WHERE patient_id = $1 ORDER BY screening_id DESC LIMIT 1`,
    [patientId]
  );
  if (r.rows.length > 0) return r.rows[0].screening_id;
  const ins = await client.query(
    `INSERT INTO patient_screening (patient_id, screening_status, eligibility_score)
     VALUES ($1, 'Pending Review', 0) RETURNING screening_id`,
    [patientId]
  );
  return ins.rows[0].screening_id;
}

function replaceFailuresPlaceholder(failures: any[]): { criterion_id: number; failure_reason: string; override_approved: boolean }[] {
  if (!Array.isArray(failures)) return [];
  return failures.map((f) => ({
    criterion_id: f.criterion_id,
    failure_reason: f.failure_reason || '',
    override_approved: f.override_approved ?? false,
  }));
}


// GET /api/screening/criteria

router.get('/criteria', async (req: Request, res: Response) => {
  const siteId = req.user?.site_id || parseInt(req.query.site_id as string);
  if (!siteId) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `SELECT ec.criterion_id, ec.criterion_type, ec.criterion_text, ec.is_mandatory, ec.criterion_logic
       FROM eligibility_criteria ec
       INNER JOIN study_sites ss ON ss.trial_id = ec.trial_id
       WHERE ss.site_id = $1
       ORDER BY ec.criterion_type DESC, ec.criterion_id ASC`,
      [siteId]
    );
    res.json({ success: true, criteria: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error fetching eligibility criteria' });
  }
});


// GET /api/screening/protocol-versions

router.get('/protocol-versions', async (req: Request, res: Response) => {
  const siteId = req.user?.site_id || parseInt(req.query.site_id as string);
  if (!siteId) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `SELECT sp.protocol_id, sp.version_number, sp.approval_date, sp.valid_from, sp.valid_to, sp.amendment_number
       FROM study_protocols sp
       INNER JOIN study_sites ss ON ss.trial_id = sp.trial_id
       WHERE ss.site_id = $1 AND (sp.valid_to IS NULL OR sp.valid_to >= CURRENT_DATE)
       ORDER BY sp.valid_from DESC`,
      [siteId]
    );
    res.json({ success: true, versions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error fetching protocol versions' });
  }
});

// PUT /api/screening/checklist/:patient_id — Save eligibility draft

router.put('/checklist/:patient_id', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patient_id);
  const siteId = req.user?.site_id;
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  const { eligibility_score, manual_override, override_reason, failures, screening_data } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query(`SELECT patient_status, enrollment_date, site_id FROM patients WHERE patient_id = $1`, [patientId]);
    if (p.rows.length === 0) throw new Error('NOT_FOUND');
    if (siteId && p.rows[0].site_id !== siteId) throw new Error('UNAUTHORIZED');
    if (p.rows[0].patient_status !== 'Screened' || p.rows[0].enrollment_date != null) {
        throw new Error('STATUS_CONFLICT');
    }

    const cc = await client.query(`SELECT 1 FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`, [patientId]);
    if (cc.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Record informed consent before saving the eligibility checklist.' });
    }

    const latestScr = await client.query(`SELECT screening_id, override_reason FROM patient_screening WHERE patient_id = $1 ORDER BY screening_id DESC LIMIT 1`, [patientId]);
    if (latestScr.rows.length && isQueuedForPiReview(latestScr.rows[0].override_reason)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This checklist has been submitted for PI review and is no longer editable.' });
    }

    const screening_id = latestScr.rows.length ? latestScr.rows[0].screening_id : await ensureScreeningRow(client, patientId);
    const packedReason = packOverrideReason(screening_data, override_reason, false);

    await client.query(
      `UPDATE patient_screening SET eligibility_score = $2, manual_override = $3, override_reason = $4, screening_date = CURRENT_DATE WHERE screening_id = $1`,
      [screening_id, eligibility_score ?? 0, manual_override ?? false, packedReason]
    );

    await client.query(`DELETE FROM screening_failures WHERE screening_id = $1`, [screening_id]);
    for (const failure of replaceFailuresPlaceholder(failures)) {
      await client.query(
        `INSERT INTO screening_failures (screening_id, criterion_id, failure_reason, override_approved) VALUES ($1, $2, $3, $4)`,
        [screening_id, failure.criterion_id, failure.failure_reason, failure.override_approved]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, screening_id, message: 'Checklist draft saved.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Patient not found' });
    if (err.message === 'UNAUTHORIZED') return res.status(403).json({ error: 'Unauthorized access to patient' });
    if (err.message === 'STATUS_CONFLICT') return res.status(409).json({ error: 'Checklist drafts are only editable while in screening.' });
    res.status(500).json({ error: 'Failed to save checklist' });
  } finally {
    client.release();
  }
});


// POST /api/screening/submit-for-review/:patient_id — Coordinator sends to PI
router.post('/submit-for-review/:patient_id', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patient_id);
  const siteId = req.user?.site_id;
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  const { eligibility_score, manual_override, override_reason, failures, screening_data } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query(`SELECT patient_status, site_id, enrollment_date FROM patients WHERE patient_id = $1`, [patientId]);
    if (p.rows.length === 0) throw new Error('NOT_FOUND');
    if (siteId && p.rows[0].site_id !== siteId) throw new Error('UNAUTHORIZED');
    if (p.rows[0].patient_status !== 'Screened' || p.rows[0].enrollment_date != null) throw new Error('STATUS_CONFLICT');

    const consent = await client.query(`SELECT consent_id FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`, [patientId]);
    if (consent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Informed consent must be recorded before submitting for PI review.' });
    }

    const patientSiteId = p.rows[0].site_id;
    const crit = await client.query(
      `SELECT ec.criterion_id, ec.is_mandatory FROM eligibility_criteria ec INNER JOIN study_sites ss ON ss.trial_id = ec.trial_id WHERE ss.site_id = $1`,
      [patientSiteId]
    );
    const mandatoryIds = new Set(crit.rows.filter((c: any) => c.is_mandatory).map((c: any) => c.criterion_id));
    const failed = new Set((replaceFailuresPlaceholder(failures)).map((f) => f.criterion_id));
    
    let hasMandatoryFail = false;
    for (const cid of failed) { if (mandatoryIds.has(cid)) hasMandatoryFail = true; }

    if (hasMandatoryFail && !manual_override) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more mandatory criteria are not met. Enable PI manual override with justification.' });
    }
    if (manual_override && (!override_reason || String(override_reason).trim().length < 20)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Manual override requires a justification of at least 20 characters.' });
    }

    const screening_id = await ensureScreeningRow(client, patientId);
    const latestOr = await client.query(`SELECT override_reason FROM patient_screening WHERE screening_id = $1`, [screening_id]);
    if (latestOr.rows.length && isQueuedForPiReview(latestOr.rows[0].override_reason)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This patient is already in the PI review queue.' });
    }

    const queuedReason = packOverrideReason(screening_data, override_reason, true);

    await client.query(
      `UPDATE patient_screening SET eligibility_score = $2, manual_override = $3, override_reason = $4, screening_status = 'Pending Review', screening_date = CURRENT_DATE WHERE screening_id = $1`,
      [screening_id, eligibility_score ?? 0, manual_override ?? false, queuedReason]
    );

    await client.query(`DELETE FROM screening_failures WHERE screening_id = $1`, [screening_id]);
    for (const failure of replaceFailuresPlaceholder(failures)) {
      await client.query(
        `INSERT INTO screening_failures (screening_id, criterion_id, failure_reason, override_approved) VALUES ($1, $2, $3, $4)`,
        [screening_id, failure.criterion_id, failure.failure_reason, failure.override_approved]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Submitted for PI review.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Patient not found' });
    if (err.message === 'UNAUTHORIZED') return res.status(403).json({ error: 'Unauthorized access to patient' });
    if (err.message === 'STATUS_CONFLICT') return res.status(409).json({ error: 'Patient must be in screening to submit.' });
    res.status(500).json({ error: 'Failed to submit for review' });
  } finally {
    client.release();
  }
});

// POST /api/screening/pi-enroll/:patient_id — PI e-sign enrollment
router.post('/pi-enroll/:patient_id', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patient_id);
  const userId = req.user?.user_id;
  const userRole = req.user?.role;
  const { e_signature_password, attestation_acknowledged, action } = req.body;
  const piAction = action === 'deny' ? 'deny' : 'approve';

  if (userRole !== 'Principal_Investigator') {
      return res.status(403).json({ error: 'Only the Principal Investigator can enroll patients.' });
  }

  if (isNaN(patientId) || !e_signature_password || !attestation_acknowledged || !userId) {
    return res.status(400).json({ error: 'e_signature_password and attestation are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userQuery = await client.query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
    const isValidPassword = await verifyUserPassword(e_signature_password, userQuery.rows[0].password_hash);
    
    if (!isValidPassword) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid electronic signature password' });
    }

    const p = await client.query(`
    SELECT p.patient_status, p.trial_patient_id, p.enrollment_date, ss.trial_id 
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE p.patient_id = $1
`, [patientId]);
    if (p.rows.length === 0) throw new Error('NOT_FOUND');
    if (p.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Patient is already enrolled.' });
    }
    if (p.rows[0].patient_status !== 'Screened') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Patient is not in screening / pending PI enrollment.' });
    }

    const consent = await client.query(`SELECT consent_id FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`, [patientId]);
    if (consent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No informed consent on file; cannot proceed.' });
    }

    const scr = await client.query(`SELECT screening_id, manual_override FROM patient_screening WHERE patient_id = $1 ORDER BY screening_id DESC LIMIT 1`, [patientId]);
    if (scr.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No screening record found.' });
    }
    const { screening_id, manual_override } = scr.rows[0];

    const attestationHash = crypto.createHash('sha256').update(`${userId}|PI_${piAction.toUpperCase()}|${new Date().toISOString()}`).digest('hex');

    await client.query(
      `INSERT INTO electronic_signatures (signatory_user_id, document_type, document_id, signature_hash, signing_reason)
       VALUES ($1, 'eCRF', $2, $3, $4)`,
      [userId, screening_id, attestationHash, `PI ${piAction} enrollment`]
    );

    if (piAction === 'deny') {
      await client.query(`UPDATE patient_screening SET screening_status = 'Failed' WHERE screening_id = $1`, [screening_id]);
      await client.query(`UPDATE patients SET patient_status = 'Screen Failure', updated_at = CURRENT_TIMESTAMP WHERE patient_id = $1`, [patientId]);
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Patient screening denied.', trial_patient_id: p.rows[0].trial_patient_id });
    }

    const failCount = await client.query(`SELECT COUNT(*)::int AS c FROM screening_failures WHERE screening_id = $1`, [screening_id]);
    if (failCount.rows[0].c > 0 && !manual_override) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Eligibility failures are present without PI override; enrollment is not allowed.' });
    }

    const changeReason = `PI ${piAction} enrollment and randomization`;
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    await client.query(`SET LOCAL app.change_reason = '${changeReason.replace(/'/g, "''")}'`);

    await client.query(`UPDATE patient_screening SET screening_status = 'Passed' WHERE screening_id = $1`, [screening_id]);

    const trialId = p.rows[0].trial_id;

    await client.query(`CALL public.sp_randomize_patient($1, $2, 'Simple')`, [patientId, trialId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Patient enrolled successfully.', trial_patient_id: p.rows[0].trial_patient_id });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Patient not found' });
    res.status(500).json({ error: 'Enrollment failed' });
  } finally {
    client.release();
  }
});

// GET /api/screening/pending-pi-review
router.get('/pending-pi-review', async (req: Request, res: Response) => {
  const siteId = req.user?.site_id || parseInt(req.query.site_id as string);
  if (!siteId) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `SELECT p.*, s.institution_name
      FROM patients p
      INNER JOIN LATERAL (
        SELECT * FROM patient_screening ps WHERE ps.patient_id = p.patient_id ORDER BY screening_id DESC LIMIT 1
      ) ps ON true
      LEFT JOIN study_sites s ON p.site_id = s.site_id
      WHERE p.site_id = $1 
        AND p.patient_status = 'Screened' 
        AND p.enrollment_date IS NULL
        AND ps.screening_status = 'Pending Review'
        AND ps.override_reason LIKE $2
        AND EXISTS (
          SELECT 1 FROM informed_consent ic WHERE ic.patient_id = p.patient_id AND ic.is_withdrawn = FALSE
        )
      ORDER BY p.patient_id`,
      [siteId, `${PI_QUEUE_PREFIX}%`]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Server error' });
  }
});


// GET /api/screening/:patient_id

router.get('/:patient_id', async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.patient_id);
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  try {
    const queryPath = path.join(__dirname, '../../../database/pi_queries/009_get_patient_screening.sql');
    const sql = fs.readFileSync(queryPath, 'utf8');

    const result = await pool.query(sql, [patientId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Screening not found for this patient' });
    }

    const row = result.rows[0];
    const unpacked = unpackOverrideReason(row.override_reason);
    row.screening_data = unpacked.screening_data;
    row.parsed_justification = unpacked.justification;

    res.json({ success: true, screening: row });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error retrieving draft screening' });
  }
});


// POST /api/screening/submit — Legacy: single-session screening

router.post('/submit', async (req: Request, res: Response) => {
  const userId = req.user?.user_id;
  const siteId = req.user?.site_id || req.body.site_id;
  const {
    date_of_birth, gender, screening_status, eligibility_score, manual_override, override_reason, failures,
    consent_version, consent_date, e_signature_password
  } = req.body;

  if (!date_of_birth || !gender || !siteId || !userId) {
    return res.status(400).json({ error: 'Missing required fields or authorization' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let signatureHash = null;
    if (consent_version && e_signature_password) {
        const userQuery = await client.query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
        const isValidPassword = await verifyUserPassword(e_signature_password, userQuery.rows[0].password_hash);
        
        if (!isValidPassword) {
          await client.query('ROLLBACK');
          return res.status(401).json({ error: 'Invalid electronic signature password' });
        }
        const sigPayload = `${userId}|${new Date().toISOString()}`;
        signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');
    }

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const screeningNumber = `SCR-${yyyymmdd}-${rand}`;

    const isDraft = !consent_version;
    const initialPatientStatus = isDraft ? 'Screened' : 'Enrolled';

    // passing NULL for `trial_patient_id`, and the database trigger will create it
    const patientResult = await client.query(
      `INSERT INTO patients (trial_patient_id, site_id, screening_number, patient_status, date_of_birth, gender, enrollment_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING patient_id, trial_patient_id, screening_number`,
      [null, siteId, screeningNumber, initialPatientStatus, date_of_birth, gender, isDraft ? null : new Date()]
    );
    const { patient_id, trial_patient_id: newTrialId, screening_number: newScreeningNum } = patientResult.rows[0];

    const scrStatus = screening_status || (isDraft ? 'Pending Review' : 'Passed');
    const screeningResult = await client.query(
      `INSERT INTO patient_screening (patient_id, screening_date, screening_status, eligibility_score, manual_override, override_reason)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5) RETURNING screening_id`,
      [patient_id, scrStatus, eligibility_score ?? 0, manual_override ?? false, override_reason || null]
    );
    const { screening_id } = screeningResult.rows[0];

    if (Array.isArray(failures) && failures.length > 0) {
      for (const failure of failures) {
        await client.query(
          `INSERT INTO screening_failures(screening_id, criterion_id, failure_reason, override_approved) VALUES ($1, $2, $3, $4)`,
          [screening_id, failure.criterion_id, failure.failure_reason || '', failure.override_approved ?? false]
        );
      }
    }

    let consent_id: number | null = null;
    if (signatureHash) {
      const consentResult = await client.query(
        `INSERT INTO informed_consent (patient_id, consent_version, consent_date, digital_signature_hash)
         VALUES ($1, $2, $3, $4) RETURNING consent_id`,
        [patient_id, consent_version, consent_date, signatureHash]
      );
      consent_id = consentResult.rows[0].consent_id;

      await client.query(
        `INSERT INTO electronic_signatures (signatory_user_id, document_type, document_id, signature_hash, signing_reason)
         VALUES ($1, 'Consent', $2, $3, 'Legacy PI direct consent')`,
        [userId, consent_id, signatureHash]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true, patient_id, trial_patient_id: newTrialId, screening_number: newScreeningNum, screening_id, consent_id,
      message: `Patient ${newTrialId} successfully screened.`,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error during screening submission' });
  } finally {
    client.release();
  }
});

export default router;