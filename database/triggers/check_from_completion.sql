CREATE OR REPLACE FUNCTION check_form_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_visit_instance_id INTEGER;
    v_visit_id INTEGER;
    v_required_forms INTEGER;
    v_completed_forms INTEGER;
BEGIN
    IF NEW.form_status = 'Signed' AND OLD.form_status != 'Signed' THEN
        v_visit_instance_id := NEW.visit_instance_id;

        -- Get visit_id for this eCRF
        SELECT visit_id INTO v_visit_id
        FROM patient_visits
        WHERE visit_instance_id = v_visit_instance_id;

        -- Count required forms for this visit
        SELECT COUNT(DISTINCT ed.ecrf_id) INTO v_required_forms
        FROM visit_schedules vs
        CROSS JOIN ecrf_definitions ed
        WHERE vs.visit_id = v_visit_id
          AND ed.signature_required = TRUE
          AND ed.trial_id = vs.trial_id;  -- Ensure they belong to same trial

        -- Count completed forms for this visit instance
        SELECT COUNT(DISTINCT ed2.ecrf_instance_id) INTO v_completed_forms
        FROM ecrf_data ed2
        JOIN ecrf_definitions ed_def ON ed2.ecrf_id = ed_def.ecrf_id
        WHERE ed2.visit_instance_id = v_visit_instance_id
          AND ed2.form_status = 'Signed'
          AND ed_def.signature_required = TRUE;

        -- If all required forms are signed, mark visit as completed
        IF v_completed_forms >= v_required_forms THEN
            UPDATE patient_visits
            SET visit_status = 'Completed'
            WHERE visit_instance_id = v_visit_instance_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;