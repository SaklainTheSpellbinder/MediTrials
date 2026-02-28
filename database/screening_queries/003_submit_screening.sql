-- 003_submit_screening.sql
-- Documents the screening submission flow executed as a transaction.
-- This logic is implemented in screeningRoutes.ts as parameterized queries.
-- Shown here for reference and manual testing.

-- STEP 1: Insert patient (returns patient_id)
INSERT INTO patients (
    trial_patient_id,
    full_name,
    site_id,
    screening_number,
    patient_status,
    date_of_birth,
    gender
) VALUES (
    $1,   -- trial_patient_id (auto-generated SCR-YYYYMMDD-XXXX)
    $2,   -- full_name
    $3,   -- site_id (from user session)
    $4,   -- screening_number
    'Screened',
    $5,   -- date_of_birth
    $6    -- gender
)
RETURNING patient_id;

-- STEP 2: Insert patient_screening record
INSERT INTO patient_screening (
    patient_id,
    screening_date,
    screening_status,
    eligibility_score,
    manual_override,
    override_reason
) VALUES (
    $1,   -- patient_id (from step 1)
    CURRENT_DATE,
    $2,   -- screening_status: 'Passed' | 'Failed' | 'Pending Review'
    $3,   -- eligibility_score (calculated on frontend)
    $4,   -- manual_override (boolean)
    $5    -- override_reason (text or null)
)
RETURNING screening_id;

-- STEP 3: Insert screening_failures for each failed criterion
-- (repeated per failure)
INSERT INTO screening_failures (
    screening_id,
    criterion_id,
    failure_reason,
    override_approved
) VALUES (
    $1,   -- screening_id (from step 2)
    $2,   -- criterion_id
    $3,   -- failure_reason
    $4    -- override_approved (true if manual override enabled)
);

-- STEP 4: Insert informed_consent (only if screening_status = 'Passed')
INSERT INTO informed_consent (
    patient_id,
    consent_version,
    consent_date,
    digital_signature_hash
) VALUES (
    $1,   -- patient_id
    $2,   -- consent_version (e.g., '1.0', '2.0')
    $3,   -- consent_date
    $4    -- SHA-256 hash of user_id + timestamp + password_hash
);
