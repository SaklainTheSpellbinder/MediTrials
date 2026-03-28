-- Latest screening row per patient, with consent summary
SELECT DISTINCT ON (p.patient_id)
    p.patient_id,
    p.trial_patient_id,
    p.screening_number,
    p.trial_patient_id AS full_name,
    p.date_of_birth,
    p.gender,
    p.patient_status,
    p.site_id,
    ps.screening_id,
    ps.screening_date,
    ps.screening_status,
    ps.eligibility_score,
    ps.manual_override,
    ps.override_reason,
    ic.consent_version AS recorded_consent_version,
    ic.consent_date AS recorded_consent_date,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'criterion_id', sf.criterion_id,
                    'failure_reason', sf.failure_reason,
                    'override_approved', sf.override_approved
                )
            )
            FROM screening_failures sf
            WHERE sf.screening_id = ps.screening_id
        ),
        '[]'::jsonb
    ) AS failures
FROM patients p
LEFT JOIN patient_screening ps ON ps.patient_id = p.patient_id
LEFT JOIN informed_consent ic ON ic.patient_id = p.patient_id AND ic.is_withdrawn = FALSE
WHERE p.patient_id = $1
ORDER BY p.patient_id, ps.screening_id DESC NULLS LAST;
