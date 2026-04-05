DROP SCHEMA IF EXISTS meditrials CASCADE;
CREATE SCHEMA meditrials;
SET search_path TO meditrials;

CREATE TABLE clinical_trials (
    trial_id SERIAL PRIMARY KEY,
    trial_nct_id VARCHAR(20) UNIQUE NOT NULL,
    trial_title TEXT NOT NULL,
    trial_phase VARCHAR(20) CHECK (trial_phase IN ('Phase I', 'Phase II', 'Phase III', 'Phase IV')),
    therapeutic_area VARCHAR(100) NOT NULL,
    trial_status VARCHAR(50) DEFAULT 'Design' 
        CHECK (trial_status IN ('Design', 'Recruiting', 'Active', 'Completed', 'Suspended', 'Terminated')),
    start_date DATE,
    estimated_completion_date DATE,
    target_enrollment INTEGER CHECK (target_enrollment > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE study_sites (
    site_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    institution_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    site_status VARCHAR(50) DEFAULT 'Pending' 
        CHECK (site_status IN ('Pending', 'Active', 'Closed', 'Suspended')),
    target_enrollment INTEGER CHECK (target_enrollment >= 0),
    current_enrollment INTEGER DEFAULT 0 CHECK (current_enrollment >= 0),
    site_initiation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL 
        CHECK (role IN ('Principal_Investigator', 'Study_Coordinator', 'Safety_Monitor', 
                       'Data_Manager', 'Statistician', 'System_Admin')),
    site_id INTEGER REFERENCES study_sites(site_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(100),
    last_login TIMESTAMP,
    password_reset_token VARCHAR(100),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT site_role_check CHECK (
        (role IN ('Principal_Investigator', 'Study_Coordinator') AND site_id IS NOT NULL) OR
        (role IN ('Safety_Monitor', 'Data_Manager', 'Statistician', 'System_Admin'))
    )
);

CREATE TABLE study_protocols (
    protocol_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    version_number VARCHAR(20) NOT NULL,
    protocol_document JSONB NOT NULL,
    approval_date DATE NOT NULL,
    approved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    electronic_signature TEXT NOT NULL,
    amendment_number INTEGER DEFAULT 0,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trial_id, version_number)
);

CREATE TABLE eligibility_criteria (
    criterion_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    criterion_type VARCHAR(20) NOT NULL CHECK (criterion_type IN ('Inclusion', 'Exclusion')),
    criterion_text TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    criterion_logic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treatment_arms (
    arm_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    arm_code VARCHAR(20) NOT NULL,
    arm_description TEXT NOT NULL,
    treatment_description JSONB,
    allocation_ratio VARCHAR(20) DEFAULT '1:1',
    blinding_level VARCHAR(50) DEFAULT 'Double Blind' 
        CHECK (blinding_level IN ('Open Label', 'Single Blind', 'Double Blind')),
    UNIQUE(trial_id, arm_code)
);

CREATE TABLE stratification_factors (
    factor_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    factor_name VARCHAR(100) NOT NULL,
    factor_levels JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE patients (
    patient_id SERIAL PRIMARY KEY,
    trial_patient_id VARCHAR(50) UNIQUE NOT NULL,
    site_id INTEGER NOT NULL REFERENCES study_sites(site_id) ON DELETE RESTRICT,
    screening_number VARCHAR(50),
    patient_status VARCHAR(50) DEFAULT 'Screened' 
        CHECK (patient_status IN ('Screened', 'Enrolled', 'Active', 'Completed', 'Withdrawn', 'Screen Failure')),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    enrollment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_medical_history (
    history_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    condition_code VARCHAR(50),
    condition_name VARCHAR(100) NOT NULL,
    diagnosis_date DATE,
    severity VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_screening (
    screening_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    screening_date DATE DEFAULT CURRENT_DATE,
    screening_status VARCHAR(50) DEFAULT 'Pending Review' 
        CHECK (screening_status IN ('Passed', 'Failed', 'Pending Review')),
    eligibility_score INTEGER CHECK (eligibility_score >= 0),
    manual_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE screening_failures (
    screening_id INTEGER NOT NULL REFERENCES patient_screening(screening_id) ON DELETE CASCADE,
    criterion_id INTEGER NOT NULL REFERENCES eligibility_criteria(criterion_id) ON DELETE CASCADE,
    failure_reason TEXT,
    override_approved BOOLEAN DEFAULT FALSE,
    override_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (screening_id, criterion_id)
);

CREATE TABLE informed_consent (
    consent_id SERIAL PRIMARY KEY,
    patient_id INTEGER UNIQUE NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    consent_version VARCHAR(20) NOT NULL,
    consent_date DATE NOT NULL DEFAULT CURRENT_DATE,
    digital_signature_hash TEXT NOT NULL,
    is_withdrawn BOOLEAN DEFAULT FALSE,
    withdrawal_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT withdrawal_after_consent CHECK (withdrawal_date IS NULL OR withdrawal_date >= consent_date)
);

CREATE TABLE randomization_assignments (
    assignment_id SERIAL PRIMARY KEY,
    patient_id INTEGER UNIQUE NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    arm_id INTEGER NOT NULL REFERENCES treatment_arms(arm_id) ON DELETE RESTRICT,
    randomization_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    randomization_method VARCHAR(50) 
        CHECK (randomization_method IN ('Simple', 'Block', 'Stratified')),
    stratification_profile JSONB,
    unblinding_date DATE,
    random_seed VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE visit_schedules (
    visit_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    visit_number INTEGER NOT NULL,
    visit_name VARCHAR(100) NOT NULL,
    visit_window_before_days INTEGER DEFAULT 0,
    visit_window_after_days INTEGER DEFAULT 0,
    day_offset INTEGER NOT NULL,
    required_procedures JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_visits (
    visit_instance_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_id INTEGER NOT NULL REFERENCES visit_schedules(visit_id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    actual_visit_date DATE,
    visit_status VARCHAR(50) DEFAULT 'Scheduled' 
        CHECK (visit_status IN ('Scheduled','Checked In','In Progress','Completed', 'Missed', 'Cancelled')),
    visit_window_status VARCHAR(50) 
        CHECK (visit_window_status IN ('Within Window', 'Early', 'Late', 'Outside Window')),
    data_queries_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, visit_id)
);

CREATE TABLE ecrf_definitions (
    ecrf_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    ecrf_name VARCHAR(100) NOT NULL,
    ecrf_schema JSONB NOT NULL,
    validation_rules JSONB,
    signature_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ecrf_data (
    ecrf_instance_id SERIAL PRIMARY KEY,
    ecrf_id INTEGER NOT NULL REFERENCES ecrf_definitions(ecrf_id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_instance_id INTEGER NOT NULL REFERENCES patient_visits(visit_instance_id) ON DELETE CASCADE,
    entered_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    form_status VARCHAR(50) DEFAULT 'In Progress' 
        CHECK (form_status IN ('In Progress', 'Completed', 'Signed', 'Locked')),
    form_data JSONB NOT NULL,
    data_entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    investigator_signature JSONB,
    query_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE laboratory_tests (
    test_id SERIAL PRIMARY KEY,
    test_name VARCHAR(100) NOT NULL,
    test_code_loinc VARCHAR(50) UNIQUE,
    unit_of_measure VARCHAR(20),
    reference_ranges JSONB,
    critical_low_value NUMERIC,
    critical_high_value NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_results (
    result_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES laboratory_tests(test_id) ON DELETE CASCADE,
    visit_instance_id INTEGER NOT NULL REFERENCES patient_visits(visit_instance_id) ON DELETE CASCADE,
    result_value NUMERIC NOT NULL,
    result_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result_status VARCHAR(50) DEFAULT 'Pending' 
        CHECK (result_status IN ('Pending', 'Completed', 'Critical', 'Cancelled')),
    critical_result_flag CHAR(1) DEFAULT 'N' CHECK (critical_result_flag IN ('Y', 'N')),
    reference_low NUMERIC,
    reference_high NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vital_signs (
    vital_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_instance_id INTEGER NOT NULL REFERENCES patient_visits(visit_instance_id) ON DELETE CASCADE,
    measurement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    heart_rate INTEGER,
    temperature NUMERIC(3,1),
    oxygen_saturation INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medical_images (
    image_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_instance_id INTEGER NOT NULL REFERENCES patient_visits(visit_instance_id) ON DELETE CASCADE,
    image_type VARCHAR(50) NOT NULL 
        CHECK (image_type IN ('X-ray', 'MRI', 'CT', 'Ultrasound', 'PET', 'Mammogram')),
    image_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    imaging_protocol TEXT,
    file_path TEXT NOT NULL,
    radiologist_review JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE adverse_events (
    ae_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_instance_id INTEGER REFERENCES patient_visits(visit_instance_id) ON DELETE SET NULL,
    ae_term VARCHAR(255) NOT NULL,
    ae_start_date DATE NOT NULL,
    ae_end_date DATE,
    severity_grade INTEGER NOT NULL CHECK (severity_grade BETWEEN 1 AND 5),
    causality_relationship VARCHAR(50) 
        CHECK (causality_relationship IN ('Definite', 'Probable', 'Possible', 'Unlikely', 'Unrelated')),
    treatment_related BOOLEAN,
    results_in_death BOOLEAN DEFAULT FALSE,
    life_threatening BOOLEAN DEFAULT FALSE,
    requires_hospitalization BOOLEAN DEFAULT FALSE,
    ae_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ae_dates_valid CHECK (ae_end_date IS NULL OR ae_end_date >= ae_start_date)
);

CREATE TABLE serious_adverse_events (
    sae_id SERIAL PRIMARY KEY,
    ae_id INTEGER UNIQUE NOT NULL REFERENCES adverse_events(ae_id) ON DELETE CASCADE,
    sae_report_number VARCHAR(100) UNIQUE,
    regulatory_body VARCHAR(50) DEFAULT 'FDA',
    report_deadline_date DATE NOT NULL,
    report_submitted_date DATE,
    dsmb_review_date DATE,
    sae_status VARCHAR(50) DEFAULT 'Open' 
        CHECK (sae_status IN ('Open', 'Under Investigation', 'Closed', 'Reported')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE protocol_deviations (
    deviation_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    visit_instance_id INTEGER REFERENCES patient_visits(visit_instance_id) ON DELETE SET NULL,
    deviation_type VARCHAR(50) NOT NULL 
        CHECK (deviation_type IN ('Minor', 'Major', 'Critical')),
    deviation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    corrective_action TEXT,
    reported_to_irb BOOLEAN DEFAULT FALSE,
    reported_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE safety_alerts (
    alert_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL 
        CHECK (source_type IN ('LAB_RESULT', 'VITAL_SIGN', 'ADVERSE_EVENT', 'PROTOCOL_DEVIATION', 'OTHER')),
    source_table VARCHAR(50) NOT NULL,
    source_record_id INTEGER NOT NULL,
    visit_instance_id INTEGER REFERENCES patient_visits(visit_instance_id) ON DELETE SET NULL,
    alert_code VARCHAR(20) NOT NULL,
    alert_message TEXT NOT NULL,
    alert_severity VARCHAR(20) DEFAULT 'INFO' 
        CHECK (alert_severity IN ('INFO', 'WARNING', 'CRITICAL', 'SEVERE')),
    alert_status VARCHAR(20) DEFAULT 'ACTIVE' 
        CHECK (alert_status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED', 'DISMISSED')),
    acknowledged_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    escalated_at TIMESTAMP,
    escalation_level INTEGER DEFAULT 1 CHECK (escalation_level BETWEEN 1 AND 5),
    measured_value NUMERIC,
    reference_range_low NUMERIC,
    reference_range_high NUMERIC,
    threshold_exceeded_percent NUMERIC
);

CREATE TABLE dsmb_meetings (
    meeting_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    meeting_date DATE NOT NULL,
    meeting_type VARCHAR(50) DEFAULT 'Scheduled' 
        CHECK (meeting_type IN ('Scheduled', 'Emergency', 'Ad-hoc')),
    data_cutoff_date DATE NOT NULL,
    recommendation VARCHAR(100) 
        CHECK (recommendation IN ('Continue', 'Modify', 'Stop', 'Requires Follow-up')),
    meeting_minutes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE analysis_datasets (
    dataset_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    dataset_name VARCHAR(100) NOT NULL,
    dataset_type VARCHAR(50) NOT NULL 
        CHECK (dataset_type IN ('Safety', 'Efficacy', 'ITT', 'Per Protocol', 'Exploratory')),
    snapshot_date DATE DEFAULT CURRENT_DATE,
    data_cutoff_date DATE NOT NULL,
    population_count INTEGER CHECK (population_count >= 0),
    analysis_results JSONB,
    p_value NUMERIC,
    statistical_significance BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE survival_analysis (
    analysis_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    endpoint_type VARCHAR(100) NOT NULL,
    time_points JSONB NOT NULL,
    survival_probabilities JSONB NOT NULL,
    hazard_ratio NUMERIC,
    logrank_p_value NUMERIC,
    confidence_interval_95 VARCHAR(50),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE data_locks (
    lock_id SERIAL PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES clinical_trials(trial_id) ON DELETE CASCADE,
    lock_type VARCHAR(50) NOT NULL 
        CHECK (lock_type IN ('Interim', 'Final', 'Database', 'Partial')),
    lock_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    unlock_date TIMESTAMP,
    snapshot_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE audit_trail_21cfr (
    audit_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    column_name VARCHAR(50),
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_value JSONB,
    new_value JSONB,
    changed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    change_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT NOT NULL,
    ip_address VARCHAR(45),
    data_hash TEXT NOT NULL
);

CREATE TABLE electronic_signatures (
    signature_id SERIAL PRIMARY KEY,
    signatory_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL 
        CHECK (document_type IN ('Protocol', 'eCRF', 'Consent', 'SAE Report', 'Deviation Report')),
    document_id INTEGER NOT NULL,
    signature_hash TEXT NOT NULL,
    signing_reason TEXT NOT NULL,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE data_queries (
    query_id SERIAL PRIMARY KEY,
    ecrf_instance_id INTEGER NOT NULL REFERENCES ecrf_data(ecrf_instance_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    query_text TEXT NOT NULL,
    query_status VARCHAR(20) DEFAULT 'Open' 
        CHECK (query_status IN ('Open', 'Answered', 'Resolved', 'Closed')),
    raised_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    raised_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_text TEXT,
    resolved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resolution_date_valid CHECK (
        resolved_date IS NULL OR resolved_date >= raised_date
    )
);

CREATE TABLE user_access_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    accessed_table VARCHAR(50) NOT NULL,
    accessed_record_id INTEGER,
    access_type VARCHAR(20) NOT NULL 
        CHECK (access_type IN ('VIEW', 'EDIT', 'DELETE', 'EXPORT', 'SIGN', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT')),
    access_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(100)
);

CREATE TABLE site_performance (
    performance_id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES study_sites(site_id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    patients_screened INTEGER DEFAULT 0,
    patients_enrolled INTEGER DEFAULT 0,
    screen_fail_rate DECIMAL(5,2),
    average_screening_days DECIMAL(5,2),
    protocol_deviations_count INTEGER DEFAULT 0,
    query_resolution_days_avg DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_period CHECK (period_end_date > period_start_date)
);

CREATE TABLE investigators (
    investigator_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES study_sites(site_id) ON DELETE CASCADE,
    investigator_name VARCHAR(255) NOT NULL,
    medical_license_number VARCHAR(100) UNIQUE,
    gcp_certification_date DATE NOT NULL,
    electronic_signature_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_patients_site ON patients(site_id);
CREATE INDEX idx_patients_status ON patients(patient_status);
CREATE INDEX idx_visits_patient ON patient_visits(patient_id);
CREATE INDEX idx_visits_date ON patient_visits(scheduled_date);
CREATE INDEX idx_ecrf_visit ON ecrf_data(visit_instance_id);
CREATE INDEX idx_labs_patient ON lab_results(patient_id);
CREATE INDEX idx_labs_visit ON lab_results(visit_instance_id);
CREATE INDEX idx_ae_patient ON adverse_events(patient_id);
CREATE INDEX idx_ae_severity ON adverse_events(severity_grade);
CREATE INDEX idx_alerts_severity_status ON safety_alerts(alert_severity, alert_status);
CREATE INDEX idx_alerts_patient_status ON safety_alerts(patient_id, alert_status);
CREATE INDEX idx_critical_labs ON lab_results(critical_result_flag, result_date);
CREATE INDEX idx_queries_status ON data_queries(query_status);
CREATE INDEX idx_users_role ON users(role, site_id);
CREATE INDEX idx_audit_table_record ON audit_trail_21cfr(table_name, record_id, change_timestamp);


CREATE OR REPLACE FUNCTION reset_sequences()
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'meditrials'
    LOOP
        EXECUTE 'ALTER SEQUENCE meditrials.' || r.sequence_name || ' RESTART WITH 1';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE patient_visits DROP CONSTRAINT patient_visits_visit_status_check; ALTER TABLE patient_visits ADD CONSTRAINT patient_visits_visit_status_check CHECK (visit_status IN ('Scheduled', 'Checked In', 'Completed', 'Missed', 'Cancelled'));

