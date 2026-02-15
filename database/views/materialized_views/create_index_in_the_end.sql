
CREATE INDEX idx_patients_site ON patients(site_id);
CREATE INDEX idx_patients_status ON patients(patient_status);
CREATE INDEX idx_patients_enrollment_date ON patients(enrollment_date);

CREATE INDEX idx_visits_patient ON patient_visits(patient_id);
CREATE INDEX idx_visits_date ON patient_visits(scheduled_date);
CREATE INDEX idx_visits_status ON patient_visits(visit_status);

CREATE INDEX idx_ecrf_visit ON ecrf_data(visit_instance_id);
CREATE INDEX idx_ecrf_patient ON ecrf_data(patient_id);
CREATE INDEX idx_ecrf_status ON ecrf_data(form_status);

CREATE INDEX idx_labs_patient ON lab_results(patient_id);
CREATE INDEX idx_labs_visit ON lab_results(visit_instance_id);
CREATE INDEX idx_labs_critical ON lab_results(critical_result_flag, result_date);

CREATE INDEX idx_ae_patient ON adverse_events(patient_id);
CREATE INDEX idx_ae_severity ON adverse_events(severity_grade);
CREATE INDEX idx_ae_start_date ON adverse_events(ae_start_date);

CREATE INDEX idx_alerts_severity_status ON safety_alerts(alert_severity, alert_status);
CREATE INDEX idx_alerts_patient_status ON safety_alerts(patient_id, alert_status);

CREATE INDEX idx_queries_status ON data_queries(query_status);
CREATE INDEX idx_queries_ecrf ON data_queries(ecrf_instance_id);

CREATE INDEX idx_audit_table_record ON audit_trail_21cfr(table_name, record_id, change_timestamp);

CREATE INDEX idx_patients_site_status ON patients(site_id, patient_status);
CREATE INDEX idx_visits_patient_status ON patient_visits(patient_id, visit_status);
CREATE INDEX idx_labs_patient_test ON lab_results(patient_id, test_id);



COMMENT ON TABLE clinical_trials IS 'Master registry of clinical trials';
COMMENT ON TABLE patients IS 'Patient registry';
COMMENT ON TABLE adverse_events IS 'Adverse event records';
COMMENT ON TABLE safety_alerts IS 'Alerts generated from safety signals';
COMMENT ON TABLE audit_trail_21cfr IS '21 CFR Part 11 compliant audit trail';