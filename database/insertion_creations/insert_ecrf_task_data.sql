-- =================================================================================
-- INSERT eCRF DATA FOR COORDINATOR DASHBOARD (Tasks)
-- Run this to populate "Incomplete eCRFs" and "Open Queries"
-- =================================================================================

-- 1. Ensure we have an eCRF Definition (Vital Signs)
-- Using ON CONFLICT to avoid errors if it already exists
INSERT INTO ecrf_definitions (ecrf_id, trial_id, ecrf_name, ecrf_schema, signature_required)
VALUES (
    1, 
    1, 
    'Vital Signs', 
    '{"fields": [{"name": "systolic_bp", "type": "number"}, {"name": "diastolic_bp", "type": "number"}]}'::jsonb, 
    true
)
ON CONFLICT (ecrf_id) DO NOTHING;

-- 2. Insert Incomplete eCRF for Patient 3 (Charlie Brown)
-- Linked to his visit TODAY (created in previous step)
INSERT INTO ecrf_data (ecrf_id, patient_id, visit_instance_id, form_status, form_data)
SELECT 
    1, 
    3, -- Charlie
    (SELECT visit_instance_id FROM patient_visits WHERE patient_id = 3 AND scheduled_date = CURRENT_DATE LIMIT 1),
    'In Progress',
    '{"systolic_bp": 180, "diastolic_bp": 95}'::jsonb -- High BP to justify the query
WHERE EXISTS (
    SELECT 1 FROM patient_visits WHERE patient_id = 3 AND scheduled_date = CURRENT_DATE
);

-- 3. Insert Open Data Query for that eCRF
INSERT INTO data_queries (ecrf_instance_id, field_name, query_text, query_status, raised_date)
SELECT 
    ecrf_instance_id,
    'systolic_bp',
    'Blood pressure exceeds protocol limits. Please repeat measurement.',
    'Open',
    CURRENT_TIMESTAMP
FROM 
    ecrf_data 
WHERE 
    patient_id = 3 
    AND form_status = 'In Progress' 
    AND visit_instance_id = (SELECT visit_instance_id FROM patient_visits WHERE patient_id = 3 AND scheduled_date = CURRENT_DATE LIMIT 1)
LIMIT 1;
