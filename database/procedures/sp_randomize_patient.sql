CREATE OR REPLACE PROCEDURE sp_randomize_patient(
    p_patient_id INTEGER,
    p_trial_id INTEGER,
    p_randomization_method VARCHAR DEFAULT 'Stratified'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_arm_id INTEGER;
    v_random_seed VARCHAR;
    v_stratification JSONB;
BEGIN
    -- Check eligibility
    IF NOT EXISTS (
        SELECT 1 FROM patient_screening ps
        WHERE ps.patient_id = p_patient_id 
          AND ps.screening_status = 'Passed'
    ) THEN
        RAISE EXCEPTION 'Patient is not eligible for randomization';
    END IF;

    -- Simple randomization logic (randomly select an arm)
    SELECT arm_id INTO v_arm_id
    FROM treatment_arms
    WHERE trial_id = p_trial_id
    ORDER BY RANDOM()
    LIMIT 1;

    -- Generate random seed
    v_random_seed := MD5(CONCAT(p_patient_id, EXTRACT(EPOCH FROM NOW())::TEXT));

    -- Insert randomization assignment
    INSERT INTO randomization_assignments (
        patient_id, arm_id, randomization_method, random_seed
    ) VALUES (
        p_patient_id, v_arm_id, p_randomization_method, v_random_seed
    );

    -- Update patient status
    UPDATE patients SET patient_status = 'Enrolled', enrollment_date = CURRENT_DATE
    WHERE patient_id = p_patient_id;
END;
$$;