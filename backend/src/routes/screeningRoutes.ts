import { Router } from 'express';
import { pool } from '../config/db';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/** Without new DB columns: coordinator "send to PI" sets override_reason to this prefix + optional justification text. */
const PI_QUEUE_PREFIX = '[PI_QUEUE]';

function isQueuedForPiReview(overrideReason: string | null | undefined): boolean {
  return !!overrideReason && overrideReason.startsWith(PI_QUEUE_PREFIX);
}

/**
 * Pack screening form data + justification into a single override_reason string.
 * Format: [PI_QUEUE]{"screening_data":{...}, "justification": "..."}  (when queued)
 * or just {"screening_data":{...}, "justification": "..."}            (draft)
 */
function packOverrideReason(screening_data: any, justification: string | null, queued: boolean): string {
  const payload = JSON.stringify({
    screening_data: screening_data || {},
    justification: justification || '',
  });
  return queued ? `${PI_QUEUE_PREFIX}${payload}` : payload;
}

function unpackOverrideReason(raw: string | null | undefined): { screening_data: any; justification: string } {
  if (!raw) return { screening_data: {}, justification: '' };
  let jsonStr = raw;
  if (jsonStr.startsWith(PI_QUEUE_PREFIX)) jsonStr = jsonStr.slice(PI_QUEUE_PREFIX.length);
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      screening_data: parsed.screening_data || {},
      justification: parsed.justification || '',
    };
  } catch {
    // Legacy plain-text override_reason
    return { screening_data: {}, justification: raw.replace(PI_QUEUE_PREFIX, '').trim() };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/screening/criteria?site_id=X
// ─────────────────────────────────────────────────────────────────────────
router.get('/criteria', async (req: any, res: any) => {
  const siteId = parseInt(req.query.site_id as string);
  if (isNaN(siteId)) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `SELECT
                ec.criterion_id,
                ec.criterion_type,
                ec.criterion_text,
                ec.is_mandatory,
                ec.criterion_logic
            FROM eligibility_criteria ec
            INNER JOIN study_sites ss ON ss.trial_id = ec.trial_id
            WHERE ss.site_id = $1
            ORDER BY ec.criterion_type DESC, ec.criterion_id ASC`,
      [siteId]
    );
    res.json({ success: true, criteria: result.rows });
  } catch (err: any) {
    console.error('Error fetching eligibility criteria:', err);
    res.status(500).json({ error: 'Server error fetching eligibility criteria' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/screening/protocol-versions?site_id=X
// ─────────────────────────────────────────────────────────────────────────
router.get('/protocol-versions', async (req: any, res: any) => {
  const siteId = parseInt(req.query.site_id as string);
  if (isNaN(siteId)) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `SELECT
                sp.protocol_id,
                sp.version_number,
                sp.approval_date,
                sp.valid_from,
                sp.valid_to,
                sp.amendment_number
            FROM study_protocols sp
            INNER JOIN study_sites ss ON ss.trial_id = sp.trial_id
            WHERE ss.site_id = $1
              AND (sp.valid_to IS NULL OR sp.valid_to >= CURRENT_DATE)
            ORDER BY sp.valid_from DESC`,
      [siteId]
    );
    res.json({ success: true, versions: result.rows });
  } catch (err: any) {
    console.error('Error fetching protocol versions:', err);
    res.status(500).json({ error: 'Server error fetching protocol versions' });
  }
});

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

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/screening/checklist/:patient_id — Save eligibility draft (In Screening)
// ─────────────────────────────────────────────────────────────────────────
router.put('/checklist/:patient_id', async (req: any, res: any) => {
  const patientId = parseInt(req.params.patient_id);
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  const { eligibility_score, manual_override, override_reason, failures, screening_data } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query(`SELECT patient_id, patient_status, enrollment_date FROM patients WHERE patient_id = $1`, [patientId]);
    if (p.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (p.rows[0].patient_status !== 'Screened' || p.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res
        .status(409)
        .json({ error: 'Checklist drafts are only editable while the patient is in screening and not yet enrolled.' });
    }

    const cc = await client.query(
      `SELECT 1 FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`,
      [patientId]
    );
    if (cc.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Record informed consent before saving the eligibility checklist.' });
    }

    const latestScr = await client.query(
      `SELECT screening_id, override_reason FROM patient_screening WHERE patient_id = $1 ORDER BY screening_id DESC LIMIT 1`,
      [patientId]
    );
    if (latestScr.rows.length && isQueuedForPiReview(latestScr.rows[0].override_reason)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This checklist has been submitted for PI review and is no longer editable.' });
    }

    const screening_id = latestScr.rows.length ? latestScr.rows[0].screening_id : await ensureScreeningRow(client, patientId);

    const packedReason = packOverrideReason(screening_data, override_reason, false);

    await client.query(
      `UPDATE patient_screening SET
        eligibility_score = $2,
        manual_override = $3,
        override_reason = $4,
        screening_date = CURRENT_DATE
       WHERE screening_id = $1`,
      [screening_id, eligibility_score ?? 0, manual_override ?? false, packedReason]
    );

    await client.query(`DELETE FROM screening_failures WHERE screening_id = $1`, [screening_id]);
    const failureRows = replaceFailuresPlaceholder(failures);
    for (const failure of failureRows) {
      await client.query(
        `INSERT INTO screening_failures (screening_id, criterion_id, failure_reason, override_approved)
         VALUES ($1, $2, $3, $4)`,
        [screening_id, failure.criterion_id, failure.failure_reason, failure.override_approved]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, screening_id, message: 'Checklist draft saved.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('checklist save error:', err);
    res.status(500).json({ error: 'Failed to save checklist' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/screening/submit-for-review/:patient_id — Coordinator sends to PI
// ─────────────────────────────────────────────────────────────────────────
router.post('/submit-for-review/:patient_id', async (req: any, res: any) => {
  const patientId = parseInt(req.params.patient_id);
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  const { eligibility_score, manual_override, override_reason, failures, screening_data } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query(
      `SELECT p.patient_id, p.patient_status, p.site_id, p.enrollment_date
       FROM patients p WHERE p.patient_id = $1`,
      [patientId]
    );
    if (p.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (p.rows[0].patient_status !== 'Screened' || p.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only patients still in screening (not enrolled) can be submitted for PI review.' });
    }

    const consent = await client.query(
      `SELECT consent_id FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`,
      [patientId]
    );
    if (consent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Informed consent must be recorded before submitting for PI review.' });
    }

    const siteId = p.rows[0].site_id;
    const crit = await client.query(
      `SELECT ec.criterion_id, ec.is_mandatory
       FROM eligibility_criteria ec
       INNER JOIN study_sites ss ON ss.trial_id = ec.trial_id
       WHERE ss.site_id = $1`,
      [siteId]
    );
    const mandatoryIds = new Set(
      crit.rows.filter((c: any) => c.is_mandatory).map((c: any) => c.criterion_id)
    );
    const failed = new Set((replaceFailuresPlaceholder(failures)).map((f) => f.criterion_id));
    let hasMandatoryFail = false;
    for (const cid of failed) {
      if (mandatoryIds.has(cid)) hasMandatoryFail = true;
    }

    if (hasMandatoryFail && !manual_override) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'One or more mandatory criteria are not met. Enable PI manual override with justification, or correct the checklist.',
      });
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
      `UPDATE patient_screening SET
        eligibility_score = $2,
        manual_override = $3,
        override_reason = $4,
        screening_status = 'Pending Review',
        screening_date = CURRENT_DATE
       WHERE screening_id = $1`,
      [screening_id, eligibility_score ?? 0, manual_override ?? false, queuedReason]
    );

    await client.query(`DELETE FROM screening_failures WHERE screening_id = $1`, [screening_id]);
    for (const failure of replaceFailuresPlaceholder(failures)) {
      await client.query(
        `INSERT INTO screening_failures (screening_id, criterion_id, failure_reason, override_approved)
         VALUES ($1, $2, $3, $4)`,
        [screening_id, failure.criterion_id, failure.failure_reason, failure.override_approved]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Submitted for PI review.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('submit-for-review error:', err);
    res.status(500).json({ error: 'Failed to submit for review' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/screening/pi-enroll/:patient_id — PI e-sign enrollment (after checklist review)
// ─────────────────────────────────────────────────────────────────────────
router.post('/pi-enroll/:patient_id', async (req: any, res: any) => {
  const patientId = parseInt(req.params.patient_id);
  const { e_signature_password, submitted_by_user_id, attestation_acknowledged, action } = req.body;

  // action = 'approve' (default) or 'deny'
  const piAction = action === 'deny' ? 'deny' : 'approve';

  if (isNaN(patientId) || !e_signature_password || !attestation_acknowledged) {
    return res.status(400).json({ error: 'e_signature_password and attestation are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const p = await client.query(
      `SELECT patient_id, patient_status, trial_patient_id, enrollment_date FROM patients WHERE patient_id = $1`,
      [patientId]
    );
    if (p.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    const st = p.rows[0].patient_status;
    if (p.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Patient is already enrolled.' });
    }
    if (st !== 'Screened') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Patient is not in screening / pending PI enrollment.' });
    }

    const consent = await client.query(
      `SELECT consent_id FROM informed_consent WHERE patient_id = $1 AND is_withdrawn = FALSE`,
      [patientId]
    );
    if (consent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No informed consent on file; cannot proceed.' });
    }

    const scr = await client.query(
      `SELECT screening_id, manual_override FROM patient_screening WHERE patient_id = $1 ORDER BY screening_id DESC LIMIT 1`,
      [patientId]
    );
    if (scr.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No screening record found.' });
    }
    const { screening_id, manual_override } = scr.rows[0];

    const attestationHash = crypto
      .createHash('sha256')
      .update(`${submitted_by_user_id}|PI_${piAction.toUpperCase()}|${new Date().toISOString()}|${e_signature_password}`)
      .digest('hex');

    if (piAction === 'deny') {
      // ── DENY: Screen Failure ────────────────────────────────────
      await client.query(`UPDATE patient_screening SET screening_status = 'Failed' WHERE screening_id = $1`, [screening_id]);
      await client.query(
        `UPDATE patients SET
          patient_status = 'Screen Failure',
          updated_at = CURRENT_TIMESTAMP
         WHERE patient_id = $1`,
        [patientId]
      );
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Patient screening denied. Status set to Screen Failure.',
        trial_patient_id: p.rows[0].trial_patient_id,
        attestation_hash: attestationHash,
      });
    }

    // ── APPROVE: Enroll ─────────────────────────────────────────
    const failCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM screening_failures WHERE screening_id = $1`,
      [screening_id]
    );
    const fc = failCount.rows[0].c;
    if (fc > 0 && !manual_override) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Eligibility failures are present without PI override; enrollment is not allowed.' });
    }

    await client.query(`UPDATE patient_screening SET screening_status = 'Passed' WHERE screening_id = $1`, [screening_id]);

    await client.query(
      `UPDATE patients SET
        patient_status = 'Enrolled',
        enrollment_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
       WHERE patient_id = $1`,
      [patientId]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Patient enrolled.',
      trial_patient_id: p.rows[0].trial_patient_id,
      attestation_hash: attestationHash,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('pi-enroll error:', err);
    res.status(500).json({ error: 'Enrollment failed' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/screening/submit — Legacy: single-session screening (optional)
// ─────────────────────────────────────────────────────────────────────────
router.post('/submit', async (req: any, res: any) => {
  const {
    date_of_birth,
    gender,
    site_id,
    screening_status,
    eligibility_score,
    manual_override,
    override_reason,
    failures,
    consent_version,
    consent_date,
    e_signature_password,
    submitted_by_user_id,
  } = req.body;

  if (!date_of_birth || !gender || !site_id) {
    return res.status(400).json({ error: 'Missing required demographics fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const screeningNumber = `SCR-${yyyymmdd}-${rand}`;

    const maxIdResult = await client.query(`
            SELECT trial_patient_id 
            FROM patients 
            WHERE trial_patient_id ~ '^PT-\\d+$'
        `);
    let maxNum = 0;
    for (const row of maxIdResult.rows) {
      const numStr = row.trial_patient_id.split('-')[1];
      if (numStr) {
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const trialPatientId = `PT-${String(maxNum > 0 ? maxNum + 1 : 1).padStart(5, '0')}`;

    const isDraft = !consent_version;
    const initialPatientStatus = isDraft ? 'Screened' : 'Enrolled';

    const patientResult = await client.query(
      `INSERT INTO patients(
            trial_patient_id,
            site_id,
            screening_number,
            patient_status,
            date_of_birth,
            gender,
            enrollment_date
        ) VALUES($1, $2, $3, $4, $5, $6, $7)
            RETURNING patient_id, trial_patient_id, screening_number`,
      [
        trialPatientId,
        site_id,
        screeningNumber,
        initialPatientStatus,
        date_of_birth,
        gender,
        isDraft ? null : new Date(),
      ]
    );
    const { patient_id, trial_patient_id: newTrialId, screening_number: newScreeningNum } = patientResult.rows[0];

    const scrStatus = screening_status || (isDraft ? 'Pending Review' : 'Passed');
    const orReason = override_reason || null;
    const screeningResult = await client.query(
      `INSERT INTO patient_screening(
            patient_id,
            screening_date,
            screening_status,
            eligibility_score,
            manual_override,
            override_reason
        ) VALUES($1, CURRENT_DATE, $2, $3, $4, $5)
            RETURNING screening_id`,
      [patient_id, scrStatus, eligibility_score ?? 0, manual_override ?? false, orReason]
    );
    const { screening_id } = screeningResult.rows[0];

    if (Array.isArray(failures) && failures.length > 0) {
      for (const failure of failures) {
        await client.query(
          `INSERT INTO screening_failures(
            screening_id,
            criterion_id,
            failure_reason,
            override_approved
        ) VALUES($1, $2, $3, $4)`,
          [screening_id, failure.criterion_id, failure.failure_reason || '', failure.override_approved ?? false]
        );
      }
    }

    let consent_id: number | null = null;

    if (consent_version && consent_date && e_signature_password) {
      const sigPayload = `${submitted_by_user_id}| ${new Date().toISOString()}| ${e_signature_password} `;
      const signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');

      const consentResult = await client.query(
        `INSERT INTO informed_consent(
            patient_id,
            consent_version,
            consent_date,
            digital_signature_hash
        ) VALUES($1, $2, $3, $4)
                RETURNING consent_id`,
        [patient_id, consent_version, consent_date, signatureHash]
      );
      consent_id = consentResult.rows[0].consent_id;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      patient_id,
      trial_patient_id: newTrialId,
      screening_number: newScreeningNum,
      screening_id,
      consent_id,
      message: `Patient ${newTrialId} successfully screened.`,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error submitting screening:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate patient or consent record. Please try again.' });
    }
    res.status(500).json({ error: 'Server error during screening submission' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/screening/pending-pi-review?site_id=
// Subjects awaiting PI: (1) coordinator submitted checklist [PI_QUEUE] after consent, or (2) legacy wizard draft without consent on file
// ─────────────────────────────────────────────────────────────────────────
router.get('/pending-pi-review', async (req: any, res: any) => {
  const siteId = parseInt(req.query.site_id as string);
  if (isNaN(siteId)) return res.status(400).json({ error: 'site_id is required' });

  try {
    const result = await pool.query(
      `
      SELECT p.*, s.institution_name
      FROM patients p
      INNER JOIN LATERAL (
        SELECT * FROM patient_screening ps
        WHERE ps.patient_id = p.patient_id
        ORDER BY screening_id DESC
        LIMIT 1
      ) ps ON true
      LEFT JOIN study_sites s ON p.site_id = s.site_id
      WHERE p.site_id = $1
        AND p.patient_status = 'Screened'
        AND p.enrollment_date IS NULL
        AND ps.screening_status = 'Pending Review'
        AND (
          (ps.override_reason LIKE $2 AND EXISTS (
            SELECT 1 FROM informed_consent ic
            WHERE ic.patient_id = p.patient_id AND ic.is_withdrawn = FALSE
          ))
          OR
          (NOT EXISTS (
            SELECT 1 FROM informed_consent ic
            WHERE ic.patient_id = p.patient_id AND ic.is_withdrawn = FALSE
          ))
        )
      ORDER BY p.patient_id
      `,
      [siteId, `${PI_QUEUE_PREFIX}%`]
    );
    res.json({ success: true, patients: result.rows });
  } catch (err: any) {
    console.error('pending-pi-review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/screening/:patient_id
// ─────────────────────────────────────────────────────────────────────────
router.get('/:patient_id', async (req: any, res: any) => {
  const patientId = parseInt(req.params.patient_id);
  if (isNaN(patientId)) return res.status(400).json({ error: 'Valid patient_id is required' });

  try {
    const queryPath = path.join(__dirname, '../../../database/pi_queries/009_get_patient_screening.sql');
    const sql = fs.readFileSync(queryPath, 'utf8');

    const result = await pool.query(sql, [patientId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Screening not found for this patient' });
    }

    // Unpack screening_data from override_reason for the frontend
    const row = result.rows[0];
    const unpacked = unpackOverrideReason(row.override_reason);
    row.screening_data = unpacked.screening_data;
    row.parsed_justification = unpacked.justification;

    res.json({ success: true, screening: row });
  } catch (err: any) {
    console.error('Error fetching patient screening:', err);
    res.status(500).json({ error: 'Server error retrieving draft screening' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/screening/:patient_id/consent — Legacy wizard: PI records consent + enrollment when no consent row exists yet.
// New workflow: coordinator uses /record-consent first, then PI uses /pi-enroll/:patient_id after [PI_QUEUE] submit.
// ─────────────────────────────────────────────────────────────────────────
router.post('/:patient_id/consent', async (req: any, res: any) => {
  const patientId = parseInt(req.params.patient_id);
  const { consent_version, consent_date, e_signature_password, submitted_by_user_id } = req.body;

  if (isNaN(patientId) || !consent_version || !consent_date || !e_signature_password) {
    return res.status(400).json({ error: 'Missing required consent fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT patient_id, patient_status, trial_patient_id, enrollment_date FROM patients WHERE patient_id = $1',
      [patientId]
    );
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (checkResult.rows[0].enrollment_date != null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Patient is already enrolled.' });
    }

    const existing = await client.query(`SELECT consent_id FROM informed_consent WHERE patient_id = $1`, [patientId]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error:
          'Consent is already on file. If the coordinator submitted the eligibility checklist, use POST /api/screening/pi-enroll/:patient_id instead.',
      });
    }

    const sigPayload = `${submitted_by_user_id}| ${new Date().toISOString()}| ${e_signature_password} `;
    const signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');

    const consentResult = await client.query(
      `INSERT INTO informed_consent(
            patient_id, consent_version, consent_date, digital_signature_hash
        ) VALUES($1, $2, $3, $4) RETURNING consent_id`,
      [patientId, consent_version, consent_date, signatureHash]
    );
    const consent_id = consentResult.rows[0].consent_id;

    await client.query(
      `UPDATE patients SET patient_status = 'Enrolled', enrollment_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE patient_id = $1`,
      [patientId]
    );

    await client.query(`UPDATE patient_screening SET screening_status = 'Passed' WHERE patient_id = $1`, [patientId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Informed consent recorded and patient enrolled (legacy flow).',
      consent_id,
      trial_patient_id: checkResult.rows[0].trial_patient_id,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error finalizing consent:', err);
    res.status(500).json({ error: 'Failed to finalize screening consent' });
  } finally {
    client.release();
  }
});

export default router;
