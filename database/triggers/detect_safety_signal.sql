CREATE OR REPLACE FUNCTION detect_safety_signal()
RETURNS TRIGGER AS $$
DECLARE
    v_recent_count INTEGER;
    v_trial_id INTEGER;
BEGIN
    -- Get trial_id for this patient
    SELECT ss.trial_id INTO v_trial_id
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE p.patient_id = NEW.patient_id;

    -- Count same AE term in last 24 hours across the trial
    SELECT COUNT(*) INTO v_recent_count
    FROM adverse_events ae
    JOIN patients p ON ae.patient_id = p.patient_id
    JOIN study_sites ss ON p.site_id = ss.site_id
    WHERE ss.trial_id = v_trial_id
      AND ae.ae_term = NEW.ae_term
      AND ae.ae_start_date >= CURRENT_DATE - INTERVAL '24 hours';

    -- If more than 5 occurrences, create safety signal alert
    IF v_recent_count > 5 THEN
        INSERT INTO safety_alerts (
            patient_id, source_type, source_table, source_record_id,
            visit_instance_id, alert_code, alert_message, alert_severity
        ) VALUES (
            NEW.patient_id, 'ADVERSE_EVENT', 'adverse_events', NEW.ae_id,
            NEW.visit_instance_id, 'SAFETY_SIGNAL',
            'Safety signal detected: ' || NEW.ae_term || ' has ' || v_recent_count || ' occurrences in 24 hours',
            'WARNING'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;