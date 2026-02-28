-- 003_get_clinical_data.sql
-- Gets visit schedule, vital signs, and medical history

-- To use: Execute three separate queries in the backend

-- Query 1: Visit Schedule
SELECT 
    vs.visit_name,
    pv.scheduled_date,
    pv.actual_visit_date,
    pv.visit_status,
    pv.visit_window_status
FROM patient_visits pv
JOIN visit_schedules vs ON pv.visit_id = vs.visit_id
WHERE pv.patient_id = $1
ORDER BY vs.day_offset ASC;

-- Query 2: Vital Signs (Last 5)
SELECT 
    measurement_time,
    systolic_bp,
    diastolic_bp,
    heart_rate,
    temperature,
    oxygen_saturation
FROM vital_signs
WHERE patient_id = $1
ORDER BY measurement_time DESC
LIMIT 5;

-- Query 3: Medical History
SELECT 
    condition_name,
    diagnosis_date,
    severity,
    is_active,
    notes
FROM patient_medical_history
WHERE patient_id = $1
ORDER BY diagnosis_date DESC NULLS LAST;
