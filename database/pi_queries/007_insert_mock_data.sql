-- 007_insert_mock_data.sql
-- Run this if you need more mock data for the existing patients in order to test the PI dashboard

-- Ensure you have an existing patient_id. Let's assume patient_id = 7 exists as per the frontend dummy data logic

DO $$
DECLARE
    v_patient_id INT := 7; 
    v_visit_id INT;
BEGIN
    -- Check if patient 7 actually exists
    IF NOT EXISTS (SELECT 1 FROM patients WHERE patient_id = v_patient_id) THEN
        RAISE NOTICE 'Patient % does not exist, insert skipped.', v_patient_id;
        RETURN;
    END IF;

    -- Insert mock medical history
    INSERT INTO patient_medical_history (patient_id, condition_name, diagnosis_date, severity, is_active, notes)
    VALUES 
        (v_patient_id, 'Hypertension', '2015-05-12', 'Moderate', TRUE, 'Controlled by medication'),
        (v_patient_id, 'Type 2 Diabetes', '2018-11-20', 'Mild', TRUE, 'Diet controlled')
    ON CONFLICT DO NOTHING;

    -- Insert a mock visit instance if not exists
    IF NOT EXISTS (SELECT 1 FROM patient_visits WHERE patient_id = v_patient_id LIMIT 1) THEN
        INSERT INTO patient_visits (patient_id, visit_id, scheduled_date, actual_visit_date, visit_status, visit_window_status)
        VALUES (v_patient_id, (SELECT MIN(visit_id) FROM visit_schedules), CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '10 days', 'Completed', 'Within Window')
        RETURNING visit_instance_id INTO v_visit_id;
    ELSE
        SELECT visit_instance_id INTO v_visit_id FROM patient_visits WHERE patient_id = v_patient_id LIMIT 1;
    END IF;

    -- Insert vital signs
    INSERT INTO vital_signs (patient_id, visit_instance_id, measurement_time, systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation)
    VALUES 
        (v_patient_id, v_visit_id, CURRENT_TIMESTAMP - INTERVAL '10 days', 125, 82, 75, 36.6, 98),
        (v_patient_id, v_visit_id, CURRENT_TIMESTAMP - INTERVAL '30 days', 130, 85, 78, 36.7, 97);

    -- Insert mock adverse event
    INSERT INTO adverse_events (patient_id, visit_instance_id, ae_term, ae_start_date, ae_end_date, severity_grade, causality_relationship, treatment_related, ae_description)
    VALUES 
        (v_patient_id, v_visit_id, 'Mild Headache', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '3 days', 1, 'Possible', TRUE, 'Patient reported headache morning of dose');

    -- Insert mock safety alert
    INSERT INTO safety_alerts (patient_id, source_type, source_table, source_record_id, alert_code, alert_message, alert_severity, alert_status)
    VALUES 
        (v_patient_id, 'ADVERSE_EVENT', 'adverse_events', 1, 'AE_MILD', 'Mild adverse event reported: Headache', 'WARNING', 'ACTIVE');

    -- Insert mock protocol deviation
    INSERT INTO protocol_deviations (patient_id, visit_instance_id, deviation_type, deviation_date, description, reported_to_irb)
    VALUES 
        (v_patient_id, v_visit_id, 'Minor', CURRENT_DATE - INTERVAL '10 days', 'Patient arrived 2 hours late for appointment', FALSE);

END;
$$;
