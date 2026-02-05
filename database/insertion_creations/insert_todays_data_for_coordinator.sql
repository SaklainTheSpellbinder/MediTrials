-- =================================================================================
-- INSERT TEST DATA FOR TODAY (Dynamic Date) - UPDATED (UPSERT VERSION)
-- Run this script to populate the Study Coordinator Dashboard with "live" data.
-- Targets Site 1 (Nurse Joy's Site).
-- Uses ON CONFLICT to update dates if the visits already exist.
-- =================================================================================

-- 1. Insert/Update Visits Scheduled for TODAY
INSERT INTO patient_visits (patient_id, visit_id, scheduled_date, visit_status, visit_window_status, updated_at)
VALUES 
(1, 4, CURRENT_DATE, 'Scheduled', 'Within Window', CURRENT_TIMESTAMP), -- Alice Johnson (Follow up)
(3, 2, CURRENT_DATE, 'Scheduled', 'Within Window', CURRENT_TIMESTAMP)  -- Charlie Brown (Dose 1)
ON CONFLICT (patient_id, visit_id) 
DO UPDATE SET 
    scheduled_date = CURRENT_DATE,
    visit_status = 'Scheduled',
    updated_at = CURRENT_TIMESTAMP;

-- 2. Insert Pending Lab Results (Linked to Alice's visit today)
-- Clean up existing pending results for today to avoid dupes/confusion first
DELETE FROM lab_results 
WHERE patient_id = 1 
  AND result_status = 'Pending' 
  AND visit_instance_id IN (
      SELECT visit_instance_id FROM patient_visits WHERE patient_id = 1 AND visit_id = 4
  );

INSERT INTO lab_results (patient_id, test_id, visit_instance_id, result_value, result_status, result_date)
SELECT 
    1, -- Alice
    1, -- Hemoglobin
    (SELECT visit_instance_id FROM patient_visits WHERE patient_id = 1 AND visit_id = 4 LIMIT 1),
    0, 
    'Pending',
    CURRENT_DATE;

INSERT INTO lab_results (patient_id, test_id, visit_instance_id, result_value, result_status, result_date)
SELECT 
    1, -- Alice
    2, -- WBC
    (SELECT visit_instance_id FROM patient_visits WHERE patient_id = 1 AND visit_id = 4 LIMIT 1),
    0, 
    'Pending', 
    CURRENT_DATE;

-- 3. Insert Incomplete eCRF (for Charlie)
-- Clean up old test data first
DELETE FROM ecrf_data 
WHERE patient_id = 3 
  AND form_status = 'In Progress'
  AND visit_instance_id IN (
      SELECT visit_instance_id FROM patient_visits WHERE patient_id = 3 AND visit_id = 2
  );

INSERT INTO ecrf_data (ecrf_id, patient_id, visit_instance_id, form_status, form_data)
SELECT 
    1, 
    3, -- Charlie
    (SELECT visit_instance_id FROM patient_visits WHERE patient_id = 3 AND visit_id = 2 LIMIT 1),
    'In Progress',
    '{}'::jsonb;

-- 4. Insert Open Data Query (for Charlie's eCRF)
-- Clean up old open queries for this eCRF
DELETE FROM data_queries 
WHERE ecrf_instance_id IN (
    SELECT ecrf_instance_id FROM ecrf_data WHERE patient_id = 3 AND visit_instance_id IN (
        SELECT visit_instance_id FROM patient_visits WHERE patient_id = 3 AND visit_id = 2
    )
);


