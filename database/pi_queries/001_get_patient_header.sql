-- 001_get_patient_header.sql
-- Gets the patient details for the Header bar of the PI Patient Profile
SELECT 
    p.patient_id,
    p.trial_patient_id,
    p.date_of_birth,
    p.gender,
    p.patient_status,
    p.enrollment_date,
    p.site_id,
    s.institution_name,
    ta.arm_code as treatment_arm,
    (
        SELECT jsonb_agg(jsonb_build_object('condition', pmh.condition_name, 'active', pmh.is_active))
        FROM patient_medical_history pmh
        WHERE pmh.patient_id = p.patient_id
    ) as medical_history_summary
FROM patients p
LEFT JOIN study_sites s ON p.site_id = s.site_id
LEFT JOIN randomization_assignments ra ON p.patient_id = ra.patient_id
LEFT JOIN treatment_arms ta ON ra.arm_id = ta.arm_id
WHERE p.patient_id = $1;
