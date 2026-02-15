CREATE OR REPLACE FUNCTION escalate_to_sae()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity_grade >= 4 OR 
       NEW.life_threatening = TRUE OR 
       NEW.requires_hospitalization = TRUE OR 
       NEW.results_in_death = TRUE THEN

        INSERT INTO serious_adverse_events (
            ae_id, sae_report_number, report_deadline_date
        ) VALUES (
            NEW.ae_id,
            'SAE-' || LPAD(NEW.ae_id::TEXT, 6, '0'),
            CURRENT_DATE + INTERVAL '24 hours'
        );

        INSERT INTO safety_alerts (
            patient_id, source_type, source_table, source_record_id,
            visit_instance_id, alert_code, alert_message, alert_severity
        ) VALUES (
            NEW.patient_id, 'ADVERSE_EVENT', 'adverse_events', NEW.ae_id,
            NEW.visit_instance_id, 'SAE',
            'Serious Adverse Event: ' || NEW.ae_term || ' (Grade ' || NEW.severity_grade || ')',
            'SEVERE'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
