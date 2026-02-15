-- Trigger 1: Auto-generate screening number
CREATE TRIGGER trg_screening_number
BEFORE INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION generate_screening_number();

-- Trigger 2: Update site enrollment
CREATE TRIGGER trg_update_enrollment
AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_site_enrollment();

-- Trigger 3: Critical lab alert
CREATE TRIGGER trg_critical_lab
BEFORE INSERT OR UPDATE ON lab_results
FOR EACH ROW
EXECUTE FUNCTION check_critical_lab();

-- Trigger 4: SAE escalation
CREATE TRIGGER trg_sae_escalation
AFTER INSERT OR UPDATE ON adverse_events
FOR EACH ROW
EXECUTE FUNCTION escalate_to_sae();

-- Trigger 5: Visit window check
CREATE TRIGGER trg_visit_window
BEFORE INSERT OR UPDATE ON patient_visits
FOR EACH ROW
EXECUTE FUNCTION check_visit_window();

-- Trigger 6: Form completion
CREATE TRIGGER trg_form_completion
AFTER UPDATE ON ecrf_data
FOR EACH ROW
EXECUTE FUNCTION check_form_completion();

-- Trigger 7: Data lock enforcement (on ecrf_data and lab_results)
CREATE TRIGGER trg_enforce_data_lock_ecrf
BEFORE UPDATE ON ecrf_data
FOR EACH ROW
EXECUTE FUNCTION enforce_data_lock();

CREATE TRIGGER trg_enforce_data_lock_labs
BEFORE UPDATE ON lab_results
FOR EACH ROW
EXECUTE FUNCTION enforce_data_lock();

-- Trigger 8: Randomization validation
CREATE TRIGGER trg_validate_randomization
BEFORE INSERT ON randomization_assignments
FOR EACH ROW
EXECUTE FUNCTION validate_randomization();

-- Trigger 9: Safety signal detection
CREATE TRIGGER trg_safety_signal
AFTER INSERT ON adverse_events
FOR EACH ROW
EXECUTE FUNCTION detect_safety_signal();

-- Trigger 10: Protocol version invalidation
CREATE TRIGGER trg_invalidate_protocol
AFTER INSERT ON study_protocols
FOR EACH ROW
EXECUTE FUNCTION invalidate_old_protocol();

-- Trigger 11: Audit trail for key tables
-- (We'll create separate audit triggers for each table we want to track)
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
