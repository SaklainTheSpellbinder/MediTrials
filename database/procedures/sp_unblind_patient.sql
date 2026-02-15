CREATE OR REPLACE PROCEDURE sp_unblind_patient(
    p_patient_id INTEGER,
    p_reason TEXT,
    p_requested_by_user_id INTEGER,
    INOUT treatment_arm VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_arm_id INTEGER;
BEGIN
    -- In real system, check if user has permission (safety monitor or PI)
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE user_id = p_requested_by_user_id AND role IN ('Safety_Monitor', 'Principal_Investigator')
    ) THEN
        RAISE EXCEPTION 'User not authorized for unblinding';
    END IF;

    -- Retrieve treatment assignment
    SELECT ta.arm_code INTO treatment_arm
    FROM randomization_assignments ra
    JOIN treatment_arms ta ON ra.arm_id = ta.arm_id
    WHERE ra.patient_id = p_patient_id;

    IF treatment_arm IS NULL THEN
        RAISE EXCEPTION 'Patient not randomized';
    END IF;

    -- Log unblinding event
    UPDATE randomization_assignments
    SET unblinding_date = CURRENT_DATE
    WHERE patient_id = p_patient_id;

    -- Audit trail (already handled by trigger)
    -- Create safety alert for unblinding
    INSERT INTO safety_alerts (
        patient_id, source_type, source_table, source_record_id,
        alert_code, alert_message, alert_severity
    ) VALUES (
        p_patient_id, 'OTHER', 'randomization_assignments', p_patient_id,
        'UNBLINDING',
        'Patient unblinded to ' || treatment_arm || ' treatment. Reason: ' || p_reason,
        'WARNING'
    );
END;
$$;