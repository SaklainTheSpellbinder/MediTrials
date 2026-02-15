CREATE OR REPLACE FUNCTION check_critical_lab()
RETURNS TRIGGER AS $$
DECLARE
    v_test_name VARCHAR;
    v_critical_low NUMERIC;
    v_critical_high NUMERIC;
BEGIN
    SELECT test_name, critical_low_value, critical_high_value 
    INTO v_test_name, v_critical_low, v_critical_high
    FROM laboratory_tests 
    WHERE test_id = NEW.test_id;

    IF (v_critical_low IS NOT NULL AND NEW.result_value < v_critical_low) OR
       (v_critical_high IS NOT NULL AND NEW.result_value > v_critical_high) THEN

        NEW.critical_result_flag := 'Y';
        NEW.result_status := 'Critical';

        INSERT INTO safety_alerts (
            patient_id, source_type, source_table, source_record_id,
            visit_instance_id, alert_code, alert_message, alert_severity,
            measured_value, reference_range_low, reference_range_high,
            threshold_exceeded_percent
        ) VALUES (
            NEW.patient_id, 'LAB_RESULT', 'lab_results', NEW.result_id,
            NEW.visit_instance_id, 'CRITICAL_LAB',
            'Critical ' || v_test_name || ' value: ' || NEW.result_value,
            'CRITICAL',
            NEW.result_value, v_critical_low, v_critical_high,
            CASE 
                WHEN v_critical_low IS NOT NULL AND NEW.result_value < v_critical_low
                THEN ROUND(((v_critical_low - NEW.result_value) / v_critical_low) * 100, 2)
                WHEN v_critical_high IS NOT NULL AND NEW.result_value > v_critical_high
                THEN ROUND(((NEW.result_value - v_critical_high) / v_critical_high) * 100, 2)
                ELSE NULL
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
