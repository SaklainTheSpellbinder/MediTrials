import { Router } from 'express';
import { pool } from '../config/db';
import * as crypto from 'crypto';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────
// GET /api/screening/criteria?site_id=X
// Returns all inclusion & exclusion criteria for the trial at this site
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
// Returns available protocol/consent versions for the site's trial
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

// ─────────────────────────────────────────────────────────────────────────
// POST /api/screening/submit
// Submits a full screening + consent record in a single DB transaction
// Body: { demographics, screening, failures, consent }
// ─────────────────────────────────────────────────────────────────────────
router.post('/submit', async (req: any, res: any) => {
    const {
        // Step 1 – Demographics
        full_name,
        date_of_birth,
        gender,
        site_id,
        // Step 2 – Screening
        screening_status,      // 'Passed' | 'Failed' | 'Pending Review'
        eligibility_score,
        manual_override,
        override_reason,
        failures,              // [{ criterion_id, failure_reason, override_approved }]
        // Step 3 – Consent
        consent_version,
        consent_date,
        e_signature_password,  // raw password used to generate signature hash
        submitted_by_user_id,
    } = req.body;

    if (!full_name || !date_of_birth || !gender || !site_id) {
        return res.status(400).json({ error: 'Missing required demographics fields' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Generate trial_patient_id & screening_number
        const today = new Date();
        const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const screeningNumber = `SCR-${yyyymmdd}-${rand}`;
        const trialPatientId = `PT-${yyyymmdd}-${rand}`;

        // 2. Insert patient
        const patientResult = await client.query(
            `INSERT INTO patients (
                trial_patient_id,
                full_name,
                site_id,
                screening_number,
                patient_status,
                date_of_birth,
                gender
            ) VALUES ($1, $2, $3, $4, 'Screened', $5, $6)
            RETURNING patient_id, trial_patient_id, screening_number`,
            [trialPatientId, full_name, site_id, screeningNumber, date_of_birth, gender]
        );
        const { patient_id, trial_patient_id: newTrialId, screening_number: newScreeningNum } = patientResult.rows[0];

        // 3. Insert patient_screening
        const screeningResult = await client.query(
            `INSERT INTO patient_screening (
                patient_id,
                screening_date,
                screening_status,
                eligibility_score,
                manual_override,
                override_reason
            ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
            RETURNING screening_id`,
            [
                patient_id,
                screening_status || 'Pending Review',
                eligibility_score ?? 0,
                manual_override ?? false,
                override_reason || null,
            ]
        );
        const { screening_id } = screeningResult.rows[0];

        // 4. Insert screening_failures (for each failed criterion)
        if (Array.isArray(failures) && failures.length > 0) {
            for (const failure of failures) {
                await client.query(
                    `INSERT INTO screening_failures (
                        screening_id,
                        criterion_id,
                        failure_reason,
                        override_approved
                    ) VALUES ($1, $2, $3, $4)`,
                    [
                        screening_id,
                        failure.criterion_id,
                        failure.failure_reason || '',
                        failure.override_approved ?? false,
                    ]
                );
            }
        }

        let consent_id: number | null = null;

        // 5. Insert informed_consent only if Passed (or override)
        if (consent_version && consent_date && e_signature_password) {
            // Simulate 21 CFR Part 11 e-signature: SHA-256 of userId+timestamp+password
            const sigPayload = `${submitted_by_user_id}|${new Date().toISOString()}|${e_signature_password}`;
            const signatureHash = crypto.createHash('sha256').update(sigPayload).digest('hex');

            const consentResult = await client.query(
                `INSERT INTO informed_consent (
                    patient_id,
                    consent_version,
                    consent_date,
                    digital_signature_hash
                ) VALUES ($1, $2, $3, $4)
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

export default router;
