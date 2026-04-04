
DROP TRIGGER IF EXISTS trg_screening_number          ON patients;
DROP TRIGGER IF EXISTS trg_update_enrollment         ON patients;
DROP TRIGGER IF EXISTS trg_audit_patients            ON patients;

DROP TRIGGER IF EXISTS trg_set_critical_lab_flag     ON lab_results;
DROP TRIGGER IF EXISTS trg_critical_lab_alert        ON lab_results;
DROP TRIGGER IF EXISTS trg_enforce_data_lock_labs    ON lab_results;
DROP TRIGGER IF EXISTS trg_audit_lab_results         ON lab_results;

DROP TRIGGER IF EXISTS trg_sae_escalation            ON adverse_events;
DROP TRIGGER IF EXISTS trg_safety_signal             ON adverse_events;
DROP TRIGGER IF EXISTS trg_audit_adverse_events      ON adverse_events;

DROP TRIGGER IF EXISTS trg_visit_window              ON patient_visits;

DROP TRIGGER IF EXISTS trg_form_completion           ON ecrf_data;
DROP TRIGGER IF EXISTS trg_enforce_data_lock_ecrf    ON ecrf_data;
DROP TRIGGER IF EXISTS trg_audit_ecrf_data           ON ecrf_data;

DROP TRIGGER IF EXISTS trg_validate_randomization    ON randomization_assignments;
DROP TRIGGER IF EXISTS trg_audit_randomization       ON randomization_assignments;

DROP TRIGGER IF EXISTS trg_invalidate_protocol       ON study_protocols;

DROP FUNCTION IF EXISTS generate_screening_number()      CASCADE;
DROP FUNCTION IF EXISTS update_site_enrollment()         CASCADE;
DROP FUNCTION IF EXISTS set_critical_lab_flag()          CASCADE;
DROP FUNCTION IF EXISTS create_critical_lab_alert()      CASCADE;
DROP FUNCTION IF EXISTS check_critical_lab()             CASCADE; -- old name, remove if exists
DROP FUNCTION IF EXISTS escalate_to_sae()                CASCADE;
DROP FUNCTION IF EXISTS check_visit_window()             CASCADE;
DROP FUNCTION IF EXISTS check_form_completion()          CASCADE;
DROP FUNCTION IF EXISTS enforce_data_lock()              CASCADE;
DROP FUNCTION IF EXISTS validate_randomization()         CASCADE;
DROP FUNCTION IF EXISTS detect_safety_signal()           CASCADE;
DROP FUNCTION IF EXISTS invalidate_old_protocol()        CASCADE;
DROP FUNCTION IF EXISTS audit_table_changes()            CASCADE;

DROP PROCEDURE IF EXISTS sp_randomize_patient(INTEGER, INTEGER, VARCHAR)                                          CASCADE;
DROP PROCEDURE IF EXISTS sp_calculate_enrollment_metrics(INTEGER, INOUT INTEGER, INOUT JSONB, INOUT DECIMAL, INOUT DECIMAL, INOUT DATE) CASCADE;
DROP PROCEDURE IF EXISTS sp_generate_safety_report(INTEGER, DATE, INOUT JSONB)                                    CASCADE;
DROP PROCEDURE IF EXISTS sp_detect_safety_signals(INTEGER, INOUT JSONB)                                           CASCADE;
DROP PROCEDURE IF EXISTS sp_lock_database(INTEGER, VARCHAR, INTEGER)                                              CASCADE;
DROP PROCEDURE IF EXISTS sp_calculate_survival(INTEGER, VARCHAR)                                                  CASCADE;
DROP PROCEDURE IF EXISTS sp_check_protocol_compliance(INTEGER, INOUT JSONB)                                       CASCADE;
DROP PROCEDURE IF EXISTS sp_generate_csdr(INTEGER, INOUT JSONB)                                                   CASCADE;
DROP PROCEDURE IF EXISTS sp_batch_sign_forms(INTEGER, INTEGER[], TEXT)                                            CASCADE;
DROP PROCEDURE IF EXISTS sp_unblind_patient(INTEGER, TEXT, INTEGER, INOUT VARCHAR)                                CASCADE;
DROP PROCEDURE IF EXISTS sp_calculate_power_analysis(INTEGER, DECIMAL, DECIMAL, DECIMAL, INOUT INTEGER, INOUT DECIMAL) CASCADE;
DROP PROCEDURE IF EXISTS sp_export_cdisc_sdtm(INTEGER, INOUT JSONB, INOUT JSONB, INOUT JSONB, INOUT JSONB)        CASCADE;

DROP VIEW  IF EXISTS vw_patient_timeline    CASCADE;
DROP VIEW  IF EXISTS vw_site_performance    CASCADE;

DROP MATERIALIZED VIEW IF EXISTS mv_site_enrollment             CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_safety_overview             CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_data_quality                CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_visit_compliance            CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_ae_by_arm                   CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_site_performance            CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_lab_trends                  CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_protocol_deviations_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_query_resolution_time       CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_randomization_balance       CASCADE;


CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_site_enrollment;
    REFRESH MATERIALIZED VIEW mv_safety_overview;
    REFRESH MATERIALIZED VIEW mv_data_quality;
    REFRESH MATERIALIZED VIEW mv_visit_compliance;
    REFRESH MATERIALIZED VIEW mv_ae_by_arm;
    REFRESH MATERIALIZED VIEW mv_site_performance;
    REFRESH MATERIALIZED VIEW mv_lab_trends;
    REFRESH MATERIALIZED VIEW mv_protocol_deviations_summary;
    REFRESH MATERIALIZED VIEW mv_query_resolution_time;
    REFRESH MATERIALIZED VIEW mv_randomization_balance;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_consent_expiry()
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'check_consent_expiry: skipped — Reconsent Required status not in constraint yet.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_screening_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.screening_number IS NULL THEN
        NEW.screening_number := 'SCR-' || to_char(NOW(), 'YYYYMMDD') ||
                                 '-' || LPAD(
                                     (nextval('public.patients_patient_id_seq'))::TEXT,
                                     6, '0'
                                 );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION update_site_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE study_sites
           SET current_enrollment = current_enrollment + 1,
               updated_at         = CURRENT_TIMESTAMP
         WHERE site_id = NEW.site_id;

    ELSIF TG_OP = 'UPDATE' AND OLD.site_id IS DISTINCT FROM NEW.site_id THEN
        -- Patient moved from one site to another
        UPDATE study_sites
           SET current_enrollment = GREATEST(current_enrollment - 1, 0),
               updated_at         = CURRENT_TIMESTAMP
         WHERE site_id = OLD.site_id;

        UPDATE study_sites
           SET current_enrollment = current_enrollment + 1,
               updated_at         = CURRENT_TIMESTAMP
         WHERE site_id = NEW.site_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE study_sites
           SET current_enrollment = GREATEST(current_enrollment - 1, 0),
               updated_at         = CURRENT_TIMESTAMP
         WHERE site_id = OLD.site_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION set_critical_lab_flag()
RETURNS TRIGGER AS $$
DECLARE
    v_critical_low  NUMERIC;
    v_critical_high NUMERIC;
BEGIN
    SELECT critical_low_value, critical_high_value
      INTO v_critical_low, v_critical_high
      FROM laboratory_tests
     WHERE test_id = NEW.test_id;

    IF (v_critical_low  IS NOT NULL AND NEW.result_value < v_critical_low) OR
       (v_critical_high IS NOT NULL AND NEW.result_value > v_critical_high)
    THEN
        NEW.critical_result_flag := 'Y';
        NEW.result_status        := 'Critical';
    ELSE
        -- Only reset if not already manually set to something else
        IF NEW.critical_result_flag = 'Y' AND
           NOT ((v_critical_low  IS NOT NULL AND NEW.result_value < v_critical_low) OR
                (v_critical_high IS NOT NULL AND NEW.result_value > v_critical_high))
        THEN
            NEW.critical_result_flag := 'N';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_critical_lab_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_test_name     VARCHAR;
    v_critical_low  NUMERIC;
    v_critical_high NUMERIC;
BEGIN
    IF NEW.critical_result_flag != 'Y' THEN
        RETURN NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM safety_alerts
         WHERE source_type      = 'LAB_RESULT'
           AND source_table     = 'lab_results'
           AND source_record_id = NEW.result_id
           AND alert_code       = 'CRITICAL_LAB'
    ) THEN
        RETURN NULL;
    END IF;

    SELECT test_name, critical_low_value, critical_high_value
      INTO v_test_name, v_critical_low, v_critical_high
      FROM laboratory_tests
     WHERE test_id = NEW.test_id;

    INSERT INTO safety_alerts (
        patient_id,
        source_type,
        source_table,
        source_record_id,
        visit_instance_id,
        alert_code,
        alert_message,
        alert_severity,
        measured_value,
        reference_range_low,
        reference_range_high,
        threshold_exceeded_percent
    ) VALUES (
        NEW.patient_id,
        'LAB_RESULT',
        'lab_results',
        NEW.result_id,
        NEW.visit_instance_id,
        'CRITICAL_LAB',
        'Critical ' || v_test_name || ' value: ' || NEW.result_value ||
            ' (ref: ' || COALESCE(v_critical_low::TEXT, '?') ||
            ' – '      || COALESCE(v_critical_high::TEXT, '?') || ')',
        'CRITICAL',
        NEW.result_value,
        v_critical_low,
        v_critical_high,
        CASE
            WHEN v_critical_low  IS NOT NULL AND NEW.result_value < v_critical_low
                THEN ROUND(((v_critical_low  - NEW.result_value) / v_critical_low)  * 100, 2)
            WHEN v_critical_high IS NOT NULL AND NEW.result_value > v_critical_high
                THEN ROUND(((NEW.result_value - v_critical_high) / v_critical_high) * 100, 2)
            ELSE NULL
        END
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION escalate_to_sae()
RETURNS TRIGGER AS $$
BEGIN
    -- Only escalate if criteria are met
    IF NEW.severity_grade >= 4
       OR NEW.life_threatening       = TRUE
       OR NEW.requires_hospitalization = TRUE
       OR NEW.results_in_death       = TRUE
    THEN
        IF NOT EXISTS (
            SELECT 1 FROM serious_adverse_events WHERE ae_id = NEW.ae_id
        ) THEN
            INSERT INTO serious_adverse_events (
                ae_id,
                sae_report_number,
                report_deadline_date,
                sae_status
            ) VALUES (
                NEW.ae_id,
                'SAE-' || LPAD(NEW.ae_id::TEXT, 6, '0'),
                CURRENT_DATE + 1, 
                'Open'
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM safety_alerts
             WHERE source_type      = 'ADVERSE_EVENT'
               AND source_table     = 'adverse_events'
               AND source_record_id = NEW.ae_id
               AND alert_code       = 'SAE'
        ) THEN
            INSERT INTO safety_alerts (
                patient_id,
                source_type,
                source_table,
                source_record_id,
                visit_instance_id,
                alert_code,
                alert_message,
                alert_severity
            ) VALUES (
                NEW.patient_id,
                'ADVERSE_EVENT',
                'adverse_events',
                NEW.ae_id,
                NEW.visit_instance_id,
                'SAE',
                'Serious Adverse Event: ' || NEW.ae_term ||
                    ' (Grade ' || NEW.severity_grade || ')',
                'SEVERE'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION check_visit_window()
RETURNS TRIGGER AS $$
DECLARE
    v_window_before INTEGER;
    v_window_after  INTEGER;
BEGIN
    IF NEW.actual_visit_date IS NULL THEN
        RETURN NEW; -- nothing to check yet
    END IF;

    SELECT visit_window_before_days, visit_window_after_days
      INTO v_window_before, v_window_after
      FROM visit_schedules
     WHERE visit_id = NEW.visit_id;

    IF    NEW.actual_visit_date < NEW.scheduled_date - v_window_before THEN
        NEW.visit_window_status := 'Early';
    ELSIF NEW.actual_visit_date > NEW.scheduled_date + v_window_after THEN
        NEW.visit_window_status := 'Late';
    ELSE
        NEW.visit_window_status := 'Within Window';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION check_form_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_trial_id        INTEGER;
    v_required_forms  INTEGER;
    v_completed_forms INTEGER;
BEGIN
    IF NEW.form_status != 'Signed' OR OLD.form_status = 'Signed' THEN
        RETURN NEW;
    END IF;

    SELECT ss.trial_id
      INTO v_trial_id
      FROM patient_visits pv
      JOIN study_sites    ss ON ss.site_id  = (
            SELECT site_id FROM patients WHERE patient_id = pv.patient_id
          )
     WHERE pv.visit_instance_id = NEW.visit_instance_id;

    SELECT COUNT(*)
      INTO v_required_forms
      FROM ecrf_definitions
     WHERE trial_id          = v_trial_id
       AND signature_required = TRUE;

    -- Count how many of those are signed for this specific visit instance
    SELECT COUNT(DISTINCT ed.ecrf_id)
      INTO v_completed_forms
      FROM ecrf_data ed
      JOIN ecrf_definitions edef ON edef.ecrf_id = ed.ecrf_id
     WHERE ed.visit_instance_id = NEW.visit_instance_id
       AND ed.form_status        = 'Signed'
       AND edef.signature_required = TRUE;

    -- If all required forms are signed, mark the visit complete
    IF v_required_forms > 0 AND v_completed_forms >= v_required_forms THEN
        UPDATE patient_visits
           SET visit_status = 'Completed',
               updated_at   = CURRENT_TIMESTAMP
         WHERE visit_instance_id = NEW.visit_instance_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- TF-7  Data lock enforcement
--        Blocks edits to eCRF and lab data when trial is locked
CREATE OR REPLACE FUNCTION enforce_data_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_patient_id INTEGER;
BEGIN
    -- Determine patient_id regardless of which table fired the trigger
    IF TG_TABLE_NAME = 'ecrf_data' THEN
        v_patient_id := NEW.patient_id;
    ELSIF TG_TABLE_NAME = 'lab_results' THEN
        v_patient_id := NEW.patient_id;
    ELSE
        v_patient_id := NEW.patient_id; -- fallback
    END IF;

    IF EXISTS (
        SELECT 1
          FROM data_locks    dl
          JOIN study_sites   ss ON ss.trial_id = dl.trial_id
          JOIN patients       p  ON p.site_id   = ss.site_id
         WHERE p.patient_id  = v_patient_id
           AND dl.unlock_date IS NULL
    ) THEN
        RAISE EXCEPTION
            'Data lock is active for this trial. Cannot modify % for patient_id = %.',
            TG_TABLE_NAME, v_patient_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- TF-8  Randomization validation
CREATE OR REPLACE FUNCTION validate_randomization()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Must have passed screening
    IF NOT EXISTS (
        SELECT 1 FROM patient_screening
         WHERE patient_id       = NEW.patient_id
           AND screening_status = 'Passed'
    ) THEN
        RAISE EXCEPTION
            'Patient % must pass screening before randomization.', NEW.patient_id;
    END IF;

    -- 2. Must not already be randomized
    IF EXISTS (
        SELECT 1 FROM randomization_assignments
         WHERE patient_id = NEW.patient_id
    ) THEN
        RAISE EXCEPTION
            'Patient % is already randomized.', NEW.patient_id;
    END IF;

    -- 3. Must have signed informed consent
    IF NOT EXISTS (
        SELECT 1 FROM informed_consent
         WHERE patient_id   = NEW.patient_id
           AND is_withdrawn = FALSE
    ) THEN
        RAISE EXCEPTION
            'Patient % must have active informed consent before randomization.', NEW.patient_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- TF-9  Safety signal detection
-- deduplicate signals so we don't spam alerts
CREATE OR REPLACE FUNCTION detect_safety_signal()
RETURNS TRIGGER AS $$
DECLARE
    v_recent_count INTEGER;
    v_trial_id     INTEGER;
BEGIN
    -- Resolve trial for this patient
    SELECT ss.trial_id
      INTO v_trial_id
      FROM patients    p
      JOIN study_sites ss ON ss.site_id = p.site_id
     WHERE p.patient_id = NEW.patient_id;

    -- Count occurrences of the same AE term in the last 24 h across the trial
    SELECT COUNT(*)
      INTO v_recent_count
      FROM adverse_events ae
      JOIN patients        p  ON p.patient_id  = ae.patient_id
      JOIN study_sites     ss ON ss.site_id     = p.site_id
     WHERE ss.trial_id        = v_trial_id
       AND ae.ae_term          = NEW.ae_term
       AND ae.ae_start_date   >= CURRENT_DATE - 1;

    -- Signal threshold: >5 occurrences in 24 h
    IF v_recent_count > 5 THEN
        -- Avoid duplicate signal alert for the same term on the same day
        IF NOT EXISTS (
            SELECT 1
              FROM safety_alerts sa
              JOIN patients       p  ON p.patient_id  = sa.patient_id
              JOIN study_sites    ss ON ss.site_id     = p.site_id
             WHERE ss.trial_id   = v_trial_id
               AND sa.alert_code = 'SAFETY_SIGNAL'
               AND sa.alert_message LIKE '%' || NEW.ae_term || '%'
               AND sa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ) THEN
            INSERT INTO safety_alerts (
                patient_id,
                source_type,
                source_table,
                source_record_id,
                visit_instance_id,
                alert_code,
                alert_message,
                alert_severity
            ) VALUES (
                NEW.patient_id,
                'ADVERSE_EVENT',
                'adverse_events',
                NEW.ae_id,
                NEW.visit_instance_id,
                'SAFETY_SIGNAL',
                'Safety signal: "' || NEW.ae_term || '" has ' ||
                    v_recent_count || ' occurrences in the last 24 h (trial ' || v_trial_id || ')',
                'WARNING'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- TF-10  Protocol version management
--         Closes (valid_to = today) all prior active versions
--         when a new protocol version is inserted
CREATE OR REPLACE FUNCTION invalidate_old_protocol()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE study_protocols
       SET valid_to = CURRENT_DATE
     WHERE trial_id    = NEW.trial_id
       AND protocol_id != NEW.protocol_id
       AND valid_to    IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- TF-11  21 CFR Part 11 audit trail
-- use CASE to record the actual PK of the changed row,
--      not patient_id for every table
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data     JSONB;
    v_new_data     JSONB;
    v_record_id    INTEGER;
    v_changed_by   INTEGER;
    v_change_reason TEXT;
BEGIN
    -- Capture row data
    IF TG_OP = 'DELETE' THEN
        v_old_data  := to_jsonb(OLD);
        v_new_data  := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data  := NULL;
        v_new_data  := to_jsonb(NEW);
    ELSE -- UPDATE
        v_old_data  := to_jsonb(OLD);
        v_new_data  := to_jsonb(NEW);
    END IF;

    -- Resolve the true primary key for each audited table
    v_record_id := CASE TG_TABLE_NAME
        WHEN 'patients'                  THEN COALESCE((v_new_data->>'patient_id')::INTEGER,
                                                        (v_old_data->>'patient_id')::INTEGER)
        WHEN 'adverse_events'            THEN COALESCE((v_new_data->>'ae_id')::INTEGER,
                                                        (v_old_data->>'ae_id')::INTEGER)
        WHEN 'lab_results'               THEN COALESCE((v_new_data->>'result_id')::INTEGER,
                                                        (v_old_data->>'result_id')::INTEGER)
        WHEN 'randomization_assignments' THEN COALESCE((v_new_data->>'assignment_id')::INTEGER,
                                                        (v_old_data->>'assignment_id')::INTEGER)
        WHEN 'ecrf_data'                 THEN COALESCE((v_new_data->>'ecrf_instance_id')::INTEGER,
                                                        (v_old_data->>'ecrf_instance_id')::INTEGER)
        ELSE -1
    END;

    -- Read application-set session variables (set by your app before DML)
    BEGIN
        v_changed_by := current_setting('app.current_user_id', TRUE)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_changed_by := NULL;
    END;

    BEGIN
        v_change_reason := NULLIF(current_setting('app.change_reason', TRUE), '');
    EXCEPTION WHEN OTHERS THEN
        v_change_reason := NULL;
    END;

    -- Fallback reason so NOT NULL constraint never fires
    IF v_change_reason IS NULL THEN
        v_change_reason := TG_OP || ' via ' || TG_TABLE_NAME;
    END IF;

    INSERT INTO audit_trail_21cfr (
        table_name,
        record_id,
        action_type,
        old_value,
        new_value,
        changed_by_user_id,
        change_reason,
        ip_address,
        data_hash
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_changed_by,
        v_change_reason,
        inet_client_addr()::TEXT,
        md5(
            COALESCE(v_old_data::TEXT, '') ||
            COALESCE(v_new_data::TEXT, '') ||
            TG_OP || TG_TABLE_NAME ||
            EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


-- TRG-1: Auto-generate screening number
CREATE TRIGGER trg_screening_number
BEFORE INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION generate_screening_number();

-- TRG-2: Keep site enrollment counts accurate
CREATE TRIGGER trg_update_enrollment
AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_site_enrollment();

-- TRG-3a: Set critical flag on the lab_results row (BEFORE — modifies NEW)
CREATE TRIGGER trg_set_critical_lab_flag
BEFORE INSERT OR UPDATE ON lab_results
FOR EACH ROW
EXECUTE FUNCTION set_critical_lab_flag();

-- TRG-3b: Create safety alert for critical lab (AFTER — result_id is available)
CREATE TRIGGER trg_critical_lab_alert
AFTER INSERT OR UPDATE ON lab_results
FOR EACH ROW
EXECUTE FUNCTION create_critical_lab_alert();

-- TRG-4: Escalate qualifying AEs to SAE table
CREATE TRIGGER trg_sae_escalation
AFTER INSERT OR UPDATE ON adverse_events
FOR EACH ROW
EXECUTE FUNCTION escalate_to_sae();

-- TRG-5: Compute visit window compliance
CREATE TRIGGER trg_visit_window
BEFORE INSERT OR UPDATE ON patient_visits
FOR EACH ROW
EXECUTE FUNCTION check_visit_window();

-- TRG-6: Auto-complete visit when all forms are signed
CREATE TRIGGER trg_form_completion
AFTER UPDATE ON ecrf_data
FOR EACH ROW
EXECUTE FUNCTION check_form_completion();

-- TRG-7a: Enforce data lock on eCRF edits
CREATE TRIGGER trg_enforce_data_lock_ecrf
BEFORE UPDATE ON ecrf_data
FOR EACH ROW
EXECUTE FUNCTION enforce_data_lock();

-- TRG-7b: Enforce data lock on lab result edits
CREATE TRIGGER trg_enforce_data_lock_labs
BEFORE UPDATE ON lab_results
FOR EACH ROW
EXECUTE FUNCTION enforce_data_lock();

-- TRG-8: Validate randomization prerequisites
CREATE TRIGGER trg_validate_randomization
BEFORE INSERT ON randomization_assignments
FOR EACH ROW
EXECUTE FUNCTION validate_randomization();

-- TRG-9: Detect safety signals (AE clustering)
CREATE TRIGGER trg_safety_signal
AFTER INSERT ON adverse_events
FOR EACH ROW
EXECUTE FUNCTION detect_safety_signal();

-- TRG-10: Invalidate old protocol versions on new approval
CREATE TRIGGER trg_invalidate_protocol
AFTER INSERT ON study_protocols
FOR EACH ROW
EXECUTE FUNCTION invalidate_old_protocol();

-- TRG-11: 21 CFR Part 11 audit trail
CREATE TRIGGER trg_audit_patients
AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_adverse_events
AFTER INSERT OR UPDATE OR DELETE ON adverse_events
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_lab_results
AFTER INSERT OR UPDATE OR DELETE ON lab_results
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_randomization
AFTER INSERT OR UPDATE OR DELETE ON randomization_assignments
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_ecrf_data
AFTER INSERT OR UPDATE OR DELETE ON ecrf_data
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();



-- SP-1  Randomize a patient into a treatment arm
CREATE OR REPLACE PROCEDURE sp_randomize_patient(
    p_patient_id          INTEGER,
    p_trial_id            INTEGER,
    p_randomization_method VARCHAR DEFAULT 'Stratified'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_arm_id     INTEGER;
    v_random_seed VARCHAR;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM patient_screening
         WHERE patient_id = p_patient_id AND screening_status = 'Passed'
    ) THEN
        RAISE EXCEPTION 'Patient % has not passed screening.', p_patient_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM informed_consent
         WHERE patient_id = p_patient_id AND is_withdrawn = FALSE
    ) THEN
        RAISE EXCEPTION 'Patient % does not have active informed consent.', p_patient_id;
    END IF;

    -- Simple random arm selection (replace with block/stratified logic as needed)
    SELECT arm_id INTO v_arm_id
      FROM treatment_arms
     WHERE trial_id = p_trial_id
     ORDER BY RANDOM()
     LIMIT 1;

    IF v_arm_id IS NULL THEN
        RAISE EXCEPTION 'No treatment arms found for trial %.', p_trial_id;
    END IF;

    v_random_seed := MD5(p_patient_id::TEXT || EXTRACT(EPOCH FROM NOW())::TEXT);

    INSERT INTO randomization_assignments (
        patient_id,
        arm_id,
        randomization_date,
        randomization_method,
        random_seed
    ) VALUES (
        p_patient_id,
        v_arm_id,
        CURRENT_TIMESTAMP,
        p_randomization_method,
        v_random_seed
    );

    UPDATE patients
       SET patient_status  = 'Enrolled',
           enrollment_date = CURRENT_DATE,
           updated_at      = CURRENT_TIMESTAMP
     WHERE patient_id = p_patient_id;

    RAISE NOTICE 'Patient % randomized to arm % (seed: %).', p_patient_id, v_arm_id, v_random_seed;
END;
$$;


-- SP-2  Enrollment metrics for a trial
-- GROUP BY corrected; all aggregated columns are in GROUP BY
CREATE OR REPLACE PROCEDURE sp_calculate_enrollment_metrics(
    p_trial_id                   INTEGER,
    INOUT total_enrolled         INTEGER  DEFAULT NULL,
    INOUT enrollment_by_site     JSONB    DEFAULT NULL,
    INOUT screening_failure_rate DECIMAL  DEFAULT NULL,
    INOUT enrollment_velocity    DECIMAL  DEFAULT NULL,
    INOUT projected_completion   DATE     DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_start_date       DATE;
    v_target_enrollment INTEGER;
    v_days_elapsed     INTEGER;
BEGIN
    SELECT start_date, target_enrollment
      INTO v_start_date, v_target_enrollment
      FROM clinical_trials
     WHERE trial_id = p_trial_id;

    -- Total enrolled / active patients
    SELECT COUNT(*)
      INTO total_enrolled
      FROM patients p
      JOIN study_sites ss ON ss.site_id = p.site_id
     WHERE ss.trial_id     = p_trial_id
       AND p.patient_status IN ('Enrolled', 'Active');

    -- Enrollment by site — FIX: GROUP BY site_id and institution_name
    SELECT jsonb_object_agg(
               ss.institution_name,
               jsonb_build_object(
                   'site_id',    ss.site_id,
                   'enrolled',   COUNT(p.patient_id),
                   'target',     ss.target_enrollment,
                   'percentage', ROUND(
                       COUNT(p.patient_id)::DECIMAL /
                       NULLIF(ss.target_enrollment, 0) * 100, 2
                   )
               )
           )
      INTO enrollment_by_site
      FROM study_sites ss
      LEFT JOIN patients p
             ON ss.site_id = p.site_id
            AND p.patient_status IN ('Enrolled', 'Active')
     WHERE ss.trial_id = p_trial_id
     GROUP BY ss.site_id, ss.institution_name, ss.target_enrollment;

    -- Screening failure rate
    SELECT ROUND(
               COUNT(*) FILTER (WHERE ps.screening_status = 'Failed')::DECIMAL /
               NULLIF(COUNT(*), 0) * 100, 2
           )
      INTO screening_failure_rate
      FROM patient_screening ps
      JOIN patients      p  ON p.patient_id  = ps.patient_id
      JOIN study_sites   ss ON ss.site_id     = p.site_id
     WHERE ss.trial_id = p_trial_id;

    -- Enrollment velocity (patients per week)
    v_days_elapsed    := GREATEST(CURRENT_DATE - v_start_date, 1);
    enrollment_velocity := ROUND(total_enrolled::DECIMAL / (v_days_elapsed / 7.0), 2);

    -- Projected completion date
    IF enrollment_velocity > 0 AND v_target_enrollment > total_enrolled THEN
        projected_completion := CURRENT_DATE +
            CEIL((v_target_enrollment - total_enrolled)::DECIMAL /
                  enrollment_velocity * 7)::INTEGER;
    ELSIF total_enrolled >= v_target_enrollment THEN
        projected_completion := CURRENT_DATE; -- already hit target
    ELSE
        projected_completion := NULL;
    END IF;
END;
$$;


-- SP-3  Generate safety report (snapshot up to cutoff date)
CREATE OR REPLACE PROCEDURE sp_generate_safety_report(
    p_trial_id   INTEGER,
    p_cutoff_date DATE    DEFAULT CURRENT_DATE,
    INOUT report  JSONB   DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    SELECT jsonb_build_object(
        'trial_id',    t.trial_id,
        'trial_title', t.trial_title,
        'cutoff_date', p_cutoff_date,
        'adverse_events', jsonb_build_object(
            'total',   COUNT(DISTINCT ae.ae_id),
            'serious', COUNT(DISTINCT sae.sae_id),
            'deaths',  COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.results_in_death),
            'by_severity', (
                SELECT COALESCE(jsonb_object_agg(severity_grade::TEXT, cnt), '{}'::JSONB)
                  FROM (
                      SELECT ae2.severity_grade, COUNT(DISTINCT ae2.ae_id) AS cnt
                        FROM adverse_events ae2
                        JOIN patients      p2  ON p2.patient_id  = ae2.patient_id
                        JOIN study_sites   ss2 ON ss2.site_id     = p2.site_id
                       WHERE ss2.trial_id        = p_trial_id
                         AND ae2.ae_start_date   <= p_cutoff_date
                       GROUP BY ae2.severity_grade
                  ) s
            )
        ),
        'active_safety_alerts',    COUNT(DISTINCT sa.alert_id)
                                   FILTER (WHERE sa.alert_status = 'ACTIVE'),
        'protocol_deviations',     COUNT(DISTINCT pd.deviation_id)
    )
      INTO report
      FROM clinical_trials t
      LEFT JOIN study_sites      ss  ON ss.trial_id     = t.trial_id
      LEFT JOIN patients          p   ON p.site_id       = ss.site_id
      LEFT JOIN adverse_events    ae  ON ae.patient_id   = p.patient_id
                                     AND ae.ae_start_date <= p_cutoff_date
      LEFT JOIN serious_adverse_events sae ON sae.ae_id  = ae.ae_id
      LEFT JOIN safety_alerts     sa  ON sa.patient_id   = p.patient_id
                                     AND sa.created_at   <= p_cutoff_date
      LEFT JOIN protocol_deviations pd ON pd.patient_id  = p.patient_id
                                      AND pd.deviation_date <= p_cutoff_date
     WHERE t.trial_id = p_trial_id
     GROUP BY t.trial_id, t.trial_title;
END;
$$;


-- SP-4  Detect safety signals using Proportional Reporting Ratio
CREATE OR REPLACE PROCEDURE sp_detect_safety_signals(
    p_trial_id    INTEGER,
    INOUT signals JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_total_patients INTEGER;
BEGIN
    SELECT COUNT(DISTINCT p.patient_id)
      INTO v_total_patients
      FROM patients    p
      JOIN study_sites ss ON ss.site_id = p.site_id
     WHERE ss.trial_id = p_trial_id;

    WITH ae_counts AS (
        SELECT
            ae.ae_term,
            COUNT(DISTINCT ae.ae_id)                                             AS ae_count,
            COUNT(DISTINCT ae.ae_id) FILTER (WHERE ta.arm_code != 'ARM_B')       AS treatment_count
        FROM adverse_events      ae
        JOIN patients             p  ON p.patient_id  = ae.patient_id
        JOIN study_sites          ss ON ss.site_id     = p.site_id
        LEFT JOIN randomization_assignments ra ON ra.patient_id = p.patient_id
        LEFT JOIN treatment_arms  ta ON ta.arm_id      = ra.arm_id
        WHERE ss.trial_id = p_trial_id
        GROUP BY ae.ae_term
    )
    SELECT jsonb_agg(
               jsonb_build_object(
                   'ae_term',          ac.ae_term,
                   'total_count',      ac.ae_count,
                   'treatment_count',  ac.treatment_count,
                   'control_count',    ac.ae_count - ac.treatment_count,
                   'prr',              ROUND(
                       (ac.treatment_count::DECIMAL / NULLIF(v_total_patients, 0)) /
                       NULLIF((ac.ae_count - ac.treatment_count)::DECIMAL / NULLIF(v_total_patients, 0), 0),
                       2
                   ),
                   'signal_strength',  CASE
                       WHEN ac.ae_count >= 3 AND ac.treatment_count >= 2 THEN 'HIGH'
                       WHEN ac.ae_count >= 2 THEN 'MEDIUM'
                       ELSE 'LOW'
                   END
               )
               ORDER BY ac.ae_count DESC
           )
      INTO signals
      FROM ae_counts ac
     WHERE ac.ae_count >= 2;
END;
$$;


-- SP-5  Lock database for interim / final analysis
-- ------------------------------------------------------------
CREATE OR REPLACE PROCEDURE public.sp_lock_database(
    p_trial_id          INTEGER,
    p_lock_type         VARCHAR,
    p_locked_by_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_snapshot_hash TEXT;
BEGIN
    -- Validate lock type (mirrors CHECK constraint on data_locks)
    IF p_lock_type NOT IN ('Interim', 'Final', 'Database', 'Partial') THEN
        RAISE EXCEPTION 'Invalid lock type: %. Must be Interim, Final, Database, or Partial.', p_lock_type;
    END IF;

    -- Check no active lock already exists
    IF EXISTS (
        SELECT 1 FROM data_locks
         WHERE trial_id   = p_trial_id
           AND unlock_date IS NULL
    ) THEN
        RAISE EXCEPTION 'Trial % already has an active data lock.', p_trial_id;
    END IF;

    -- CRITICAL FIX: Snapshot fingerprint now perfectly matches the Node.js /verify route.
    -- It aggregates the exact patient data row-by-row into a JSON string and hashes it.
    SELECT MD5(COALESCE(
        (
            SELECT json_agg(row_to_json(p.*) ORDER BY p.patient_id)::TEXT
            FROM public.patients p
            JOIN public.study_sites ss ON ss.site_id = p.site_id
            WHERE ss.trial_id = p_trial_id
        ), 
        ''
    )) INTO v_snapshot_hash;

    INSERT INTO data_locks (
        trial_id,
        lock_type,
        locked_by_user_id,
        snapshot_hash
    ) VALUES (
        p_trial_id,
        p_lock_type,
        p_locked_by_user_id,
        v_snapshot_hash
    );

    RAISE NOTICE 'Trial % locked (%). Snapshot hash: %', p_trial_id, p_lock_type, v_snapshot_hash;
END;
$$;


-- SP-6  Calculate / store Kaplan-Meier survival analysis
--        (time points are illustrative; plug in real calculation)
CREATE OR REPLACE PROCEDURE sp_calculate_survival(
    p_trial_id     INTEGER,
    p_endpoint_type VARCHAR DEFAULT 'Overall Survival'
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Placeholder KM values — replace with real computation or R/Python output
    INSERT INTO survival_analysis (
        trial_id,
        endpoint_type,
        time_points,
        survival_probabilities,
        hazard_ratio,
        logrank_p_value,
        confidence_interval_95
    ) VALUES (
        p_trial_id,
        p_endpoint_type,
        '[30, 60, 90, 180, 365]'::JSONB,
        '[0.95, 0.90, 0.85, 0.80, 0.75]'::JSONB,
        1.20,
        0.05,
        '0.80-1.60'
    );

    RAISE NOTICE 'Survival analysis stored for trial % / endpoint: %.', p_trial_id, p_endpoint_type;
END;
$$;


-- SP-7  Protocol compliance check for one patient
-- FIX: COALESCE to handle NULL from first query before concatenation
CREATE OR REPLACE PROCEDURE sp_check_protocol_compliance(
    p_patient_id    INTEGER,
    INOUT deviations JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_missed_visits JSONB;
BEGIN
    -- Recorded protocol deviations
    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'type',             pd.deviation_type,
                   'description',      pd.description,
                   'date',             pd.deviation_date,
                   'corrective_action', pd.corrective_action,
                   'reported_to_irb',  pd.reported_to_irb
               )
               ORDER BY pd.deviation_date
           ), '[]'::JSONB)
      INTO deviations
      FROM protocol_deviations pd
     WHERE pd.patient_id = p_patient_id;

    -- Missed visits (treated as implicit deviations)
    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'type',             'Missed Visit',
                   'description',      'Missed visit: ' || vs.visit_name,
                   'date',             pv.scheduled_date,
                   'corrective_action', 'Reschedule or document reason'
               )
               ORDER BY pv.scheduled_date
           ), '[]'::JSONB)
      INTO v_missed_visits
      FROM patient_visits  pv
      JOIN visit_schedules vs ON vs.visit_id = pv.visit_id
     WHERE pv.patient_id  = p_patient_id
       AND pv.visit_status = 'Missed';

    -- Merge both arrays (safe because both default to [] not NULL)
    deviations := deviations || v_missed_visits;
END;
$$;


-- SP-8  Clinical Study Data Review (CSDR) report
CREATE OR REPLACE PROCEDURE sp_generate_csdr(
    p_trial_id       INTEGER,
    INOUT csdr_report JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_patient_accountability JSONB;
    v_data_completeness      JSONB;
    v_query_status           JSONB;
    v_deviations             JSONB;
BEGIN
    -- Patient accountability
    SELECT jsonb_build_object(
        'screened',        COUNT(DISTINCT p.patient_id),
        'enrolled',        COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status IN ('Enrolled','Active')),
        'completed',       COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Completed'),
        'withdrawn',       COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Withdrawn'),
        'screen_failures', COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Screen Failure')
    ) INTO v_patient_accountability
      FROM patients    p
      JOIN study_sites ss ON ss.site_id = p.site_id
     WHERE ss.trial_id = p_trial_id;

    -- Data completeness (per-visit form completion rate)
    SELECT jsonb_build_object(
        'total_visit_instances', COUNT(DISTINCT pv.visit_instance_id),
        'total_ecrf_definitions', (
            SELECT COUNT(*) FROM ecrf_definitions WHERE trial_id = p_trial_id
        ),
        'forms_completed', COUNT(DISTINCT ed.ecrf_instance_id)
                           FILTER (WHERE ed.form_status IN ('Completed','Signed','Locked')),
        'forms_signed',    COUNT(DISTINCT ed.ecrf_instance_id)
                           FILTER (WHERE ed.form_status = 'Signed')
    ) INTO v_data_completeness
      FROM patients       p
      JOIN study_sites    ss ON ss.site_id = p.site_id
      LEFT JOIN patient_visits pv ON pv.patient_id = p.patient_id
      LEFT JOIN ecrf_data  ed ON ed.visit_instance_id = pv.visit_instance_id
     WHERE ss.trial_id = p_trial_id;

    -- Query resolution status
    SELECT jsonb_build_object(
        'total_queries',    COUNT(DISTINCT dq.query_id),
        'open_queries',     COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status = 'Open'),
        'resolved_queries', COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status IN ('Resolved','Closed')),
        'avg_days_to_resolve', ROUND(
            AVG(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0)
            FILTER (WHERE dq.resolved_date IS NOT NULL), 1
        )
    ) INTO v_query_status
      FROM data_queries dq
      JOIN ecrf_data    ed ON ed.ecrf_instance_id = dq.ecrf_instance_id
      JOIN patients      p  ON p.patient_id        = ed.patient_id
      JOIN study_sites   ss ON ss.site_id           = p.site_id
     WHERE ss.trial_id = p_trial_id;

    -- Protocol deviations summary
    SELECT jsonb_build_object(
        'total',           COUNT(DISTINCT pd.deviation_id),
        'minor',           COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.deviation_type = 'Minor'),
        'major',           COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.deviation_type = 'Major'),
        'critical',        COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.deviation_type = 'Critical'),
        'reported_to_irb', COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.reported_to_irb)
    ) INTO v_deviations
      FROM protocol_deviations pd
      JOIN patients             p  ON p.patient_id  = pd.patient_id
      JOIN study_sites          ss ON ss.site_id     = p.site_id
     WHERE ss.trial_id = p_trial_id;

    csdr_report := jsonb_build_object(
        'trial_id',              p_trial_id,
        'generation_date',       CURRENT_DATE,
        'patient_accountability', v_patient_accountability,
        'data_completeness',     v_data_completeness,
        'query_status',          v_query_status,
        'protocol_deviations',   v_deviations
    );
END;
$$;


-- SP-9  Batch-sign eCRF forms
CREATE OR REPLACE PROCEDURE sp_batch_sign_forms(
    p_user_id           INTEGER,
    p_ecrf_instance_ids INTEGER[],
    p_signing_reason    TEXT DEFAULT 'Batch investigator signature'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_ecrf_id   INTEGER;
    v_signed    INTEGER := 0;
    v_skipped   INTEGER := 0;
BEGIN
    -- Validate role
    IF NOT EXISTS (
        SELECT 1 FROM users
         WHERE user_id = p_user_id
           AND role IN ('Principal_Investigator', 'Study_Coordinator')
           AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'User % does not have authority to sign forms.', p_user_id;
    END IF;

    FOREACH v_ecrf_id IN ARRAY p_ecrf_instance_ids LOOP
        -- Skip forms that are not in a signable state
        IF NOT EXISTS (
            SELECT 1 FROM ecrf_data
             WHERE ecrf_instance_id = v_ecrf_id
               AND form_status IN ('Completed', 'In Progress')
        ) THEN
            RAISE NOTICE 'Form % skipped (status not signable or does not exist).', v_ecrf_id;
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        -- Record electronic signature
        INSERT INTO electronic_signatures (
            signatory_user_id,
            document_type,
            document_id,
            signature_hash,
            signing_reason
        ) VALUES (
            p_user_id,
            'eCRF',
            v_ecrf_id,
            MD5(p_user_id::TEXT || v_ecrf_id::TEXT || CURRENT_TIMESTAMP::TEXT),
            p_signing_reason
        );

        -- Update form status and embed signature metadata
        UPDATE ecrf_data
           SET form_status          = 'Signed',
               investigator_signature = jsonb_build_object(
                   'signed_by',      p_user_id,
                   'signature_date', CURRENT_TIMESTAMP,
                   'signing_reason', p_signing_reason
               ),
               updated_at           = CURRENT_TIMESTAMP
         WHERE ecrf_instance_id = v_ecrf_id;

        v_signed := v_signed + 1;
    END LOOP;

    RAISE NOTICE 'Batch sign complete: % signed, % skipped.', v_signed, v_skipped;
END;
$$;

-- SP-10  Emergency unblinding
CREATE OR REPLACE PROCEDURE sp_unblind_patient(
    p_patient_id          INTEGER,
    p_reason              TEXT,
    p_requested_by_user_id INTEGER,
    INOUT treatment_arm   VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Authorization check
    IF NOT EXISTS (
        SELECT 1 FROM users
         WHERE user_id  = p_requested_by_user_id
           AND role     IN ('Safety_Monitor', 'Principal_Investigator')
           AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'User % is not authorized to perform unblinding.', p_requested_by_user_id;
    END IF;

    -- Retrieve treatment arm
    SELECT ta.arm_code
      INTO treatment_arm
      FROM randomization_assignments ra
      JOIN treatment_arms ta ON ta.arm_id = ra.arm_id
     WHERE ra.patient_id = p_patient_id;

    IF treatment_arm IS NULL THEN
        RAISE EXCEPTION 'Patient % has not been randomized.', p_patient_id;
    END IF;

    -- Check not already unblinded
    IF EXISTS (
        SELECT 1 FROM randomization_assignments
         WHERE patient_id      = p_patient_id
           AND unblinding_date IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Patient % has already been unblinded.', p_patient_id;
    END IF;

    -- Record unblinding date
    UPDATE randomization_assignments
       SET unblinding_date = CURRENT_DATE,
       unblinded_at            = CURRENT_TIMESTAMP,
       unblinded_by_user_id    = p_requested_by_user_id
     WHERE patient_id = p_patient_id;

    -- Audit / alert
    INSERT INTO safety_alerts (
        patient_id,
        source_type,
        source_table,
        source_record_id,
        alert_code,
        alert_message,
        alert_severity
    ) VALUES (
        p_patient_id,
        'OTHER',
        'randomization_assignments',
        p_patient_id,
        'UNBLINDING',
        'Patient ' || p_patient_id || ' unblinded to arm "' || treatment_arm ||
            '". Requested by user ' || p_requested_by_user_id ||
            '. Reason: ' || p_reason,
        'WARNING'
    );

    RAISE NOTICE 'Patient % unblinded to arm: %.', p_patient_id, treatment_arm;
END;
$$;


-- SP-11  Power analysis
-- actually use p_alpha and p_power_target to compute Z-scores
CREATE OR REPLACE PROCEDURE sp_calculate_power_analysis(
    p_trial_id           INTEGER,
    p_effect_size        DECIMAL DEFAULT 0.5,
    p_alpha              DECIMAL DEFAULT 0.05,
    p_power_target       DECIMAL DEFAULT 0.8,
    INOUT required_sample_size INTEGER DEFAULT NULL,
    INOUT current_power        DECIMAL DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_current_enrollment INTEGER;
    v_target_enrollment  INTEGER;
    v_event_rate         DECIMAL := 0.30;
    v_z_alpha            DECIMAL;
    v_z_beta             DECIMAL;
BEGIN
    -- Map common alpha values to Z-scores (one-sided upper tail)
    v_z_alpha := CASE
        WHEN p_alpha <= 0.01 THEN 2.576
        WHEN p_alpha <= 0.025 THEN 1.960
        WHEN p_alpha <= 0.05  THEN 1.645
        ELSE 1.282
    END;

    -- Map power targets to Z-scores
    v_z_beta := CASE
        WHEN p_power_target >= 0.90 THEN 1.282
        WHEN p_power_target >= 0.80 THEN 0.842
        WHEN p_power_target >= 0.70 THEN 0.524
        ELSE 0.253
    END;

    -- Sample size formula for two proportions (equal group sizes)
    required_sample_size := CEIL(
        2 * POWER(
            v_z_alpha * SQRT(2 * v_event_rate * (1 - v_event_rate)) +
            v_z_beta  * SQRT(p_effect_size * (1 - p_effect_size)),
            2
        ) / POWER(p_effect_size - v_event_rate, 2)
    );

    -- Current enrollment
    SELECT COALESCE(SUM(ss.current_enrollment), 0),
           ct.target_enrollment
      INTO v_current_enrollment, v_target_enrollment
      FROM study_sites    ss
      JOIN clinical_trials ct ON ct.trial_id = ss.trial_id
     WHERE ct.trial_id = p_trial_id
     GROUP BY ct.target_enrollment;

    -- Achieved power (proportional approximation)
    current_power := ROUND(
        LEAST(1.0,
              v_current_enrollment::DECIMAL /
              NULLIF(required_sample_size, 0) * p_power_target
        ), 3
    );

    RAISE NOTICE 'Required n=%  Current enrollment=%  Estimated power=%.', 
        required_sample_size, v_current_enrollment, current_power;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_export_cdisc_sdtm(
    p_trial_id   INTEGER,
    INOUT dm_data JSONB DEFAULT NULL,
    INOUT ae_data JSONB DEFAULT NULL,
    INOUT vs_data JSONB DEFAULT NULL,
    INOUT lb_data JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- DM Domain (Demographics)
    SELECT jsonb_agg(
               jsonb_build_object(
                   'STUDYID', ct.trial_nct_id,
                   'DOMAIN',  'DM',
                   'USUBJID', p.trial_patient_id,
                   'BRTHDTC', to_char(p.date_of_birth, 'YYYY-MM-DD'),
                   'SEX',     UPPER(LEFT(p.gender, 1)),
                   'RACE',    'UNKNOWN',
                   'COUNTRY', ss.country,
                   'RFSTDTC', to_char(p.enrollment_date, 'YYYY-MM-DD'),
                   'ARM',     ta.arm_code
               )
           )
      INTO dm_data
      FROM patients    p
      JOIN study_sites ss ON ss.site_id  = p.site_id
      JOIN clinical_trials ct ON ct.trial_id = ss.trial_id
      LEFT JOIN randomization_assignments ra ON ra.patient_id = p.patient_id
      LEFT JOIN treatment_arms  ta ON ta.arm_id = ra.arm_id
     WHERE ss.trial_id = p_trial_id;

    -- AE Domain
    SELECT jsonb_agg(
               jsonb_build_object(
                   'STUDYID', ct.trial_nct_id,
                   'DOMAIN',  'AE',
                   'USUBJID', p.trial_patient_id,
                   'AESEQ',   ae.ae_id,
                   'AETERM',  ae.ae_term,
                   'AESTDTC', to_char(ae.ae_start_date, 'YYYY-MM-DD'),
                   'AEENDTC', to_char(ae.ae_end_date,   'YYYY-MM-DD'),
                   'AESEV',   CASE ae.severity_grade
                                  WHEN 1 THEN 'MILD'
                                  WHEN 2 THEN 'MODERATE'
                                  ELSE        'SEVERE'
                              END,
                   'AEREL',   ae.causality_relationship,
                   'AESER',   CASE WHEN ae.life_threatening OR ae.requires_hospitalization
                                        OR ae.results_in_death THEN 'Y' ELSE 'N' END
               )
           )
      INTO ae_data
      FROM adverse_events ae
      JOIN patients        p  ON p.patient_id  = ae.patient_id
      JOIN study_sites     ss ON ss.site_id     = p.site_id
      JOIN clinical_trials ct ON ct.trial_id    = ss.trial_id
     WHERE ss.trial_id = p_trial_id;

    -- VS Domain (Vital Signs — all measurements)
    SELECT jsonb_agg(
               jsonb_build_object(
                   'STUDYID', ct.trial_nct_id,
                   'DOMAIN',  'VS',
                   'USUBJID', p.trial_patient_id,
                   'VSSEQ',   vs.vital_id,
                   'VSDAT',   to_char(vs.measurement_time, 'YYYY-MM-DD'),
                   'SYSBP',   vs.systolic_bp,
                   'DIABP',   vs.diastolic_bp,
                   'PULSE',   vs.heart_rate,
                   'TEMP',    vs.temperature,
                   'SpO2',    vs.oxygen_saturation
               )
           )
      INTO vs_data
      FROM vital_signs   vs
      JOIN patients       p  ON p.patient_id  = vs.patient_id
      JOIN study_sites    ss ON ss.site_id     = p.site_id
      JOIN clinical_trials ct ON ct.trial_id   = ss.trial_id
     WHERE ss.trial_id = p_trial_id;

    -- LB Domain (Laboratory)
    SELECT jsonb_agg(
               jsonb_build_object(
                   'STUDYID',  ct.trial_nct_id,
                   'DOMAIN',   'LB',
                   'USUBJID',  p.trial_patient_id,
                   'LBSEQ',    lr.result_id,
                   'LBTESTCD', lt.test_code_loinc,
                   'LBTEST',   lt.test_name,
                   'LBORRES',  lr.result_value,
                   'LBORRESU', lt.unit_of_measure,
                   'LBSTNRLO', lr.reference_low,
                   'LBSTNRHI', lr.reference_high,
                   'LBNRIND',  CASE
                       WHEN lr.result_value < lr.reference_low  THEN 'LOW'
                       WHEN lr.result_value > lr.reference_high THEN 'HIGH'
                       ELSE 'NORMAL'
                   END
               )
           )
      INTO lb_data
      FROM lab_results     lr
      JOIN laboratory_tests lt ON lt.test_id     = lr.test_id
      JOIN patients          p  ON p.patient_id   = lr.patient_id
      JOIN study_sites       ss ON ss.site_id      = p.site_id
      JOIN clinical_trials   ct ON ct.trial_id     = ss.trial_id
     WHERE ss.trial_id = p_trial_id;
END;
$$;

-- Patient timeline (enrollment → visits → AEs → critical labs)
CREATE OR REPLACE VIEW vw_patient_timeline AS
SELECT
    p.patient_id,
    p.trial_patient_id,
    p.enrollment_date              AS event_date,
    'Enrollment'                   AS event_type,
    'Patient enrolled in study'    AS description,
    NULL::INTEGER                  AS visit_instance_id,
    NULL::NUMERIC                  AS result_value
FROM patients p
WHERE p.enrollment_date IS NOT NULL

UNION ALL

SELECT
    p.patient_id,
    p.trial_patient_id,
    pv.actual_visit_date,
    'Visit',
    'Visit: ' || vs.visit_name,
    pv.visit_instance_id,
    NULL::NUMERIC
FROM patients       p
JOIN patient_visits  pv ON pv.patient_id  = p.patient_id
JOIN visit_schedules vs ON vs.visit_id    = pv.visit_id
WHERE pv.actual_visit_date IS NOT NULL

UNION ALL

SELECT
    p.patient_id,
    p.trial_patient_id,
    ae.ae_start_date,
    'Adverse Event',
    'AE: ' || ae.ae_term || ' (Grade ' || ae.severity_grade || ')',
    ae.visit_instance_id,
    ae.severity_grade::NUMERIC
FROM patients       p
JOIN adverse_events ae ON ae.patient_id = p.patient_id

UNION ALL

SELECT
    p.patient_id,
    p.trial_patient_id,
    lr.result_date::DATE,
    'Critical Lab',
    'Critical: ' || lt.test_name || ' = ' || lr.result_value ||
        ' ' || lt.unit_of_measure,
    lr.visit_instance_id,
    lr.result_value
FROM patients          p
JOIN lab_results        lr ON lr.patient_id = p.patient_id
JOIN laboratory_tests   lt ON lt.test_id    = lr.test_id
WHERE lr.critical_result_flag = 'Y'

ORDER BY patient_id, event_date;


-- Site performance from the site_performance table
CREATE OR REPLACE VIEW vw_site_performance AS
SELECT
    s.site_id,
    s.institution_name,
    s.trial_id,
    s.country,
    sp.period_start_date,
    sp.period_end_date,
    sp.patients_screened,
    sp.patients_enrolled,
    sp.screen_fail_rate,
    sp.average_screening_days,
    sp.protocol_deviations_count,
    sp.query_resolution_days_avg,
    ROUND(
        sp.patients_enrolled::DECIMAL / NULLIF(sp.patients_screened, 0) * 100, 2
    ) AS screening_success_rate,
    ROUND(
        sp.patients_enrolled::DECIMAL / NULLIF(s.target_enrollment, 0) * 100, 2
    ) AS enrollment_progress_pct
FROM study_sites     s
LEFT JOIN site_performance sp ON sp.site_id = s.site_id;

-- MV-1  Site enrollment dashboard
CREATE MATERIALIZED VIEW mv_site_enrollment AS
SELECT
    s.site_id,
    s.institution_name,
    s.trial_id,
    s.country,
    s.target_enrollment,
    s.current_enrollment,
    CASE WHEN s.target_enrollment > 0
        THEN ROUND(s.current_enrollment::DECIMAL / s.target_enrollment * 100, 2)
        ELSE 0
    END                                                                  AS enrollment_pct,
    COUNT(DISTINCT p.patient_id)                                         AS total_patients,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Active')          AS active_patients,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Enrolled')        AS enrolled_patients,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Screen Failure')  AS screen_failures,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Withdrawn')       AS withdrawn_patients,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.patient_status = 'Completed')       AS completed_patients
FROM study_sites s
LEFT JOIN patients p ON p.site_id = s.site_id
GROUP BY s.site_id, s.institution_name, s.trial_id, s.country,
         s.target_enrollment, s.current_enrollment;


-- MV-2  Safety overview per trial
CREATE MATERIALIZED VIEW mv_safety_overview AS
SELECT
    t.trial_id,
    t.trial_title,
    t.trial_status,
    COUNT(DISTINCT ae.ae_id)                                              AS total_ae,
    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.severity_grade >= 3)        AS grade3plus_ae,
    COUNT(DISTINCT sae.sae_id)                                            AS total_sae,
    COUNT(DISTINCT ae.ae_id)  FILTER (WHERE ae.results_in_death)          AS ae_deaths,
    COUNT(DISTINCT sa.alert_id)                                           AS total_alerts,
    COUNT(DISTINCT sa.alert_id) FILTER (WHERE sa.alert_status = 'ACTIVE') AS active_alerts,
    COUNT(DISTINCT pd.deviation_id)                                       AS total_deviations,
    COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.deviation_type = 'Critical') AS critical_deviations
FROM clinical_trials          t
LEFT JOIN study_sites          ss  ON ss.trial_id    = t.trial_id
LEFT JOIN patients              p   ON p.site_id      = ss.site_id
LEFT JOIN adverse_events        ae  ON ae.patient_id  = p.patient_id
LEFT JOIN serious_adverse_events sae ON sae.ae_id     = ae.ae_id
LEFT JOIN safety_alerts         sa  ON sa.patient_id  = p.patient_id
LEFT JOIN protocol_deviations   pd  ON pd.patient_id  = p.patient_id
GROUP BY t.trial_id, t.trial_title, t.trial_status;


-- MV-3  Data quality per patient
CREATE MATERIALIZED VIEW mv_data_quality AS
SELECT
    p.patient_id,
    p.trial_patient_id,
    ss.trial_id,
    COUNT(DISTINCT ed.ecrf_instance_id)                                          AS total_forms,
    COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status = 'Signed') AS signed_forms,
    COUNT(DISTINCT ed.ecrf_instance_id) FILTER (WHERE ed.form_status = 'Locked') AS locked_forms,
    COALESCE(SUM(ed.query_count), 0)                                             AS total_query_count,
    COUNT(DISTINCT dq.query_id)                                                  AS open_queries
FROM patients    p
JOIN study_sites ss ON ss.site_id = p.site_id
LEFT JOIN patient_visits pv ON pv.patient_id        = p.patient_id
LEFT JOIN ecrf_data      ed ON ed.visit_instance_id = pv.visit_instance_id
LEFT JOIN data_queries   dq ON dq.ecrf_instance_id  = ed.ecrf_instance_id
                             AND dq.query_status     = 'Open'
GROUP BY p.patient_id, p.trial_patient_id, ss.trial_id;


-- MV-4  Visit compliance per patient
CREATE MATERIALIZED VIEW mv_visit_compliance AS
SELECT
    p.patient_id,
    p.trial_patient_id,
    ss.trial_id,
    COUNT(DISTINCT pv.visit_instance_id)                                               AS total_scheduled,
    COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_status = 'Completed') AS completed_visits,
    COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_status = 'Missed')    AS missed_visits,
    COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_status = 'Cancelled') AS cancelled_visits,
    ROUND(
        COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_status = 'Completed')::DECIMAL /
        NULLIF(COUNT(DISTINCT pv.visit_instance_id), 0) * 100, 2
    ) AS compliance_pct,
    COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_window_status = 'Late')  AS late_visits,
    COUNT(DISTINCT pv.visit_instance_id) FILTER (WHERE pv.visit_window_status = 'Early') AS early_visits
FROM patients    p
JOIN study_sites  ss ON ss.site_id = p.site_id
LEFT JOIN patient_visits pv ON pv.patient_id = p.patient_id
GROUP BY p.patient_id, p.trial_patient_id, ss.trial_id;


-- MV-5  Adverse events by treatment arm
CREATE MATERIALIZED VIEW mv_ae_by_arm AS
SELECT
    ct.trial_id,
    ta.arm_id,
    ta.arm_code,
    ae.ae_term,
    COUNT(DISTINCT ae.ae_id)                                                AS occurrence_count,
    ROUND(AVG(ae.severity_grade), 2)                                        AS avg_severity,
    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.severity_grade >= 3)          AS grade3plus_count,
    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.life_threatening)              AS life_threatening_count,
    COUNT(DISTINCT ae.ae_id) FILTER (WHERE ae.requires_hospitalization)      AS hospitalization_count
FROM treatment_arms           ta
JOIN clinical_trials           ct ON ct.trial_id   = ta.trial_id
LEFT JOIN randomization_assignments ra ON ra.arm_id = ta.arm_id
LEFT JOIN adverse_events        ae ON ae.patient_id = ra.patient_id
GROUP BY ct.trial_id, ta.arm_id, ta.arm_code, ae.ae_term;


-- MV-6  Site performance (from site_performance table)
CREATE MATERIALIZED VIEW mv_site_performance AS
WITH site_patient_metrics AS (
    -- 1. Aggregate Patient Data per Site
    SELECT 
        p.site_id,
        COUNT(DISTINCT p.patient_id) AS patients_screened,
        COUNT(p.enrollment_date) AS patients_enrolled,
        MIN(ps.screening_date) AS period_start_date,
        MAX(COALESCE(p.enrollment_date, ps.screening_date)) AS period_end_date,
        -- p.enrollment_date and ps.screening_date are DATE types, subtraction yields integer days
        AVG(p.enrollment_date - ps.screening_date) AS average_screening_days
    FROM patients p
    LEFT JOIN patient_screening ps ON p.patient_id = ps.patient_id
    GROUP BY p.site_id
),
site_deviations AS (
    -- 2. Aggregate Protocol Deviations per Site
    -- Must join through the patients table to resolve the site_id
    SELECT 
        p.site_id, 
        COUNT(pd.deviation_id) AS protocol_deviations_count
    FROM protocol_deviations pd
    JOIN patients p ON pd.patient_id = p.patient_id
    GROUP BY p.site_id
),
site_queries AS (
    -- 3. Aggregate Data Queries per Site
    -- Must join through ecrf_data and patients to resolve the site_id
    -- raised_date and resolved_date are TIMESTAMPs, subtraction yields an INTERVAL. 
    -- We extract epoch seconds and divide by 86400 to get decimal days.
    SELECT 
        p.site_id, 
        AVG(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400) AS query_resolution_days_avg
    FROM data_queries dq
    JOIN ecrf_data ed ON dq.ecrf_instance_id = ed.ecrf_instance_id
    JOIN patients p ON ed.patient_id = p.patient_id
    WHERE dq.resolved_date IS NOT NULL
    GROUP BY p.site_id
)
-- 4. Combine Everything and Calculate Final Percentages
SELECT
    s.site_id,
    s.institution_name,
    s.trial_id,
    s.country,
    spm.period_start_date,
    spm.period_end_date,
    COALESCE(spm.patients_screened, 0) AS patients_screened,
    COALESCE(spm.patients_enrolled, 0) AS patients_enrolled,
    
    -- Calculated: Screen Fail Rate = (Screened - Enrolled) / Screened
    ROUND(
        (COALESCE(spm.patients_screened, 0) - COALESCE(spm.patients_enrolled, 0))::DECIMAL 
        / NULLIF(spm.patients_screened, 0) * 100, 
    2) AS screen_fail_rate,
    
    ROUND(spm.average_screening_days, 1) AS average_screening_days,
    
    COALESCE(sd.protocol_deviations_count, 0) AS protocol_deviations_count,
    ROUND(sq.query_resolution_days_avg::DECIMAL, 1) AS query_resolution_days_avg,
    
    -- Calculated: Screening Success Rate = Enrolled / Screened
    ROUND(
        COALESCE(spm.patients_enrolled, 0)::DECIMAL 
        / NULLIF(spm.patients_screened, 0) * 100, 
    2) AS screening_success_rate,
    
    -- Calculated: Enrollment Progress = Enrolled / Target
    ROUND(
        COALESCE(spm.patients_enrolled, 0)::DECIMAL 
        / NULLIF(s.target_enrollment, 0) * 100, 
    2) AS enrollment_progress_pct

FROM study_sites s
LEFT JOIN site_patient_metrics spm ON s.site_id = spm.site_id
LEFT JOIN site_deviations sd ON s.site_id = sd.site_id
LEFT JOIN site_queries sq ON s.site_id = sq.site_id;


-- MV-7  Lab result trends per patient per test
CREATE MATERIALIZED VIEW mv_lab_trends AS
SELECT
    p.patient_id,
    p.trial_patient_id,
    lt.test_id,
    lt.test_name,
    lt.unit_of_measure,
    COUNT(lr.result_id)             AS measurement_count,
    MIN(lr.result_value)            AS min_value,
    MAX(lr.result_value)            AS max_value,
    ROUND(AVG(lr.result_value), 3)  AS avg_value,
    COUNT(lr.result_id) FILTER (WHERE lr.critical_result_flag = 'Y') AS critical_count,
    jsonb_agg(
        jsonb_build_object(
            'date',           lr.result_date::DATE,
            'value',          lr.result_value,
            'critical',       lr.critical_result_flag = 'Y',
            'reference_low',  lr.reference_low,
            'reference_high', lr.reference_high
        ) ORDER BY lr.result_date
    ) AS trend_data
FROM lab_results      lr
JOIN laboratory_tests  lt ON lt.test_id    = lr.test_id
JOIN patients           p  ON p.patient_id  = lr.patient_id
GROUP BY p.patient_id, p.trial_patient_id, lt.test_id, lt.test_name, lt.unit_of_measure;


-- MV-8  Protocol deviations summary per site
CREATE MATERIALIZED VIEW mv_protocol_deviations_summary AS
SELECT
    ss.site_id,
    ss.institution_name,
    ss.trial_id,
    pd.deviation_type,
    COUNT(DISTINCT pd.deviation_id)                                         AS deviation_count,
    COUNT(DISTINCT pd.patient_id)                                           AS affected_patients,
    COUNT(DISTINCT pd.deviation_id) FILTER (WHERE pd.reported_to_irb)       AS reported_to_irb_count,
    MIN(pd.deviation_date)                                                  AS first_deviation_date,
    MAX(pd.deviation_date)                                                  AS last_deviation_date
FROM protocol_deviations pd
JOIN patients             p  ON p.patient_id  = pd.patient_id
JOIN study_sites          ss ON ss.site_id     = p.site_id
GROUP BY ss.site_id, ss.institution_name, ss.trial_id, pd.deviation_type;


-- MV-9  Query resolution time per site
CREATE MATERIALIZED VIEW mv_query_resolution_time AS
SELECT
    ss.site_id,
    ss.institution_name,
    ss.trial_id,
    COUNT(DISTINCT dq.query_id)                                             AS total_queries,
    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status = 'Open')    AS open_queries,
    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status = 'Resolved') AS resolved_queries,
    COUNT(DISTINCT dq.query_id) FILTER (WHERE dq.query_status = 'Closed')  AS closed_queries,
    ROUND(
        AVG(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0)
            FILTER (WHERE dq.resolved_date IS NOT NULL)::NUMERIC, 2
    ) AS avg_days_to_resolve,
    ROUND(
        MAX(EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0)
            FILTER (WHERE dq.resolved_date IS NOT NULL)::NUMERIC, 2
    ) AS max_days_to_resolve,
    ROUND(
        (PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (dq.resolved_date - dq.raised_date)) / 86400.0
        ) FILTER (WHERE dq.resolved_date IS NOT NULL))::NUMERIC, 2
    ) AS median_days_to_resolve
FROM data_queries dq
JOIN ecrf_data    ed ON ed.ecrf_instance_id = dq.ecrf_instance_id
JOIN patients      p  ON p.patient_id        = ed.patient_id
JOIN study_sites   ss ON ss.site_id           = p.site_id
GROUP BY ss.site_id, ss.institution_name, ss.trial_id;


-- MV-10  Randomization balance across arms
CREATE MATERIALIZED VIEW mv_randomization_balance AS
SELECT
    ct.trial_id,
    ct.trial_title,
    ta.arm_id,
    ta.arm_code,
    ta.arm_description,
    COUNT(DISTINCT ra.patient_id)                                                      AS patient_count,
    ROUND(AVG(EXTRACT(YEAR FROM AGE(p.date_of_birth)))::NUMERIC, 1)                    AS avg_age,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Male')                      AS male_count,
    COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Female')                    AS female_count,
    ROUND(
        COUNT(DISTINCT p.patient_id) FILTER (WHERE p.gender = 'Male')::DECIMAL /
        NULLIF(COUNT(DISTINCT ra.patient_id), 0) * 100, 2
    ) AS pct_male
FROM randomization_assignments ra
JOIN patients        p  ON p.patient_id  = ra.patient_id
JOIN treatment_arms  ta ON ta.arm_id     = ra.arm_id
JOIN clinical_trials ct ON ct.trial_id   = ta.trial_id
GROUP BY ct.trial_id, ct.trial_title, ta.arm_id, ta.arm_code, ta.arm_description;


CREATE INDEX IF NOT EXISTS idx_patients_site             ON patients(site_id);
CREATE INDEX IF NOT EXISTS idx_patients_status           ON patients(patient_status);
CREATE INDEX IF NOT EXISTS idx_patients_enrollment_date  ON patients(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_patients_site_status      ON patients(site_id, patient_status);

CREATE INDEX IF NOT EXISTS idx_visits_patient            ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date               ON patient_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status             ON patient_visits(visit_status);
CREATE INDEX IF NOT EXISTS idx_visits_patient_status     ON patient_visits(patient_id, visit_status);

CREATE INDEX IF NOT EXISTS idx_ecrf_visit                ON ecrf_data(visit_instance_id);
CREATE INDEX IF NOT EXISTS idx_ecrf_patient              ON ecrf_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_ecrf_status               ON ecrf_data(form_status);

CREATE INDEX IF NOT EXISTS idx_labs_patient              ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_labs_visit                ON lab_results(visit_instance_id);
CREATE INDEX IF NOT EXISTS idx_labs_critical             ON lab_results(critical_result_flag, result_date);
CREATE INDEX IF NOT EXISTS idx_labs_patient_test         ON lab_results(patient_id, test_id);

CREATE INDEX IF NOT EXISTS idx_ae_patient                ON adverse_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_ae_severity               ON adverse_events(severity_grade);
CREATE INDEX IF NOT EXISTS idx_ae_start_date             ON adverse_events(ae_start_date);

CREATE INDEX IF NOT EXISTS idx_alerts_severity_status    ON safety_alerts(alert_severity, alert_status);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_status     ON safety_alerts(patient_id, alert_status);

CREATE INDEX IF NOT EXISTS idx_queries_status            ON data_queries(query_status);
CREATE INDEX IF NOT EXISTS idx_queries_ecrf              ON data_queries(ecrf_instance_id);

CREATE INDEX IF NOT EXISTS idx_audit_table_record        ON audit_trail_21cfr(table_name, record_id, change_timestamp);
CREATE INDEX IF NOT EXISTS idx_users_role                ON users(role, site_id);


COMMENT ON TABLE clinical_trials              IS 'Master registry of clinical trials';
COMMENT ON TABLE study_sites                  IS 'Trial sites / institutions';
COMMENT ON TABLE patients                     IS 'Patient registry (all statuses)';
COMMENT ON TABLE patient_screening            IS 'Screening assessments and pass/fail status';
COMMENT ON TABLE informed_consent             IS 'Consent records with digital signature';
COMMENT ON TABLE randomization_assignments    IS 'Treatment arm assignments';
COMMENT ON TABLE adverse_events               IS 'All adverse event records';
COMMENT ON TABLE serious_adverse_events       IS 'SAE escalations (Grade 4+, hospitalization, death)';
COMMENT ON TABLE safety_alerts                IS 'System-generated safety signals and alerts';
COMMENT ON TABLE audit_trail_21cfr            IS '21 CFR Part 11 compliant immutable audit trail';
COMMENT ON TABLE ecrf_data                    IS 'Electronic Case Report Form data instances';
COMMENT ON TABLE lab_results                  IS 'Lab test results with critical flagging';
COMMENT ON TABLE protocol_deviations          IS 'Protocol deviations including IRB reportable ones';
COMMENT ON TABLE data_locks                   IS 'Trial data lock records for analysis freezes';





CREATE OR REPLACE FUNCTION public.get_patient_ae_summary(p_patient_id INTEGER)
RETURNS TABLE(
    patient_id              INTEGER,
    trial_patient_id        VARCHAR,
    total_ae                INTEGER,
    grade3plus_ae           INTEGER,
    sae_count               INTEGER,
    open_sae_count          INTEGER,
    deaths                  INTEGER,
    life_threatening        INTEGER,
    requires_hospitalization INTEGER,
    treatment_related_count INTEGER,
    most_recent_ae_date     DATE,
    most_severe_grade       INTEGER,
    ae_by_term              JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.patient_id::INTEGER,
        p.trial_patient_id,

        COUNT(DISTINCT ae.ae_id)::INTEGER                                              AS total_ae,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.severity_grade >= 3)::INTEGER                             AS grade3plus_ae,

        COUNT(DISTINCT sae.sae_id)::INTEGER                                            AS sae_count,

        COUNT(DISTINCT sae.sae_id)
            FILTER (WHERE sae.sae_status NOT IN ('Reported','Closed'))::INTEGER        AS open_sae_count,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.results_in_death = TRUE)::INTEGER                         AS deaths,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.life_threatening = TRUE)::INTEGER                         AS life_threatening,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.requires_hospitalization = TRUE)::INTEGER                 AS requires_hospitalization,

        COUNT(DISTINCT ae.ae_id)
            FILTER (WHERE ae.treatment_related = TRUE)::INTEGER                        AS treatment_related_count,

        MAX(ae.ae_start_date)                                                          AS most_recent_ae_date,

        MAX(ae.severity_grade)::INTEGER                                                AS most_severe_grade,

        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'ae_term',              ae.ae_term,
                    'severity_grade',       ae.severity_grade,
                    'ae_start_date',        ae.ae_start_date,
                    'outcome',              ae.outcome,
                    'causality',            ae.causality_relationship,
                    'treatment_related',    ae.treatment_related,
                    'is_sae',               sae.sae_id IS NOT NULL
                ) ORDER BY ae.ae_start_date DESC
            ) FILTER (WHERE ae.ae_id IS NOT NULL),
            '[]'::JSONB
        )                                                                              AS ae_by_term

    FROM public.patients p
    LEFT JOIN public.adverse_events       ae  ON ae.patient_id  = p.patient_id
    LEFT JOIN public.serious_adverse_events sae ON sae.ae_id    = ae.ae_id
    WHERE p.patient_id = p_patient_id
    GROUP BY p.patient_id, p.trial_patient_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR PRIMARY KEY, 
    value JSONB,
    updated_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.system_settings IS 'Global system configuration parameters';