-- 002_get_patient_timeline.sql
-- Gets the unified event timeline from the materialized/standard view
SELECT 
    event_date,
    event_type,
    description,
    visit_id,          -- Actually visit_instance_id from the view
    result_value       -- Optional, e.g., AE grade or lab value
FROM vw_patient_timeline
WHERE patient_id = $1
ORDER BY event_date DESC;
