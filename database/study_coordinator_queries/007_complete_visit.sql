-- Updates a checked-in visit to 'Completed' and stamps the actual visit date.
-- Only transitions visits that are in 'Checked In' status (prevents double-complete).
UPDATE public.patient_visits
SET
    visit_status       = 'Completed',
    actual_visit_date  = CURRENT_DATE,
    updated_at         = CURRENT_TIMESTAMP
WHERE visit_instance_id = $1
  AND visit_status = 'Checked In'
RETURNING visit_instance_id, patient_id, visit_status, actual_visit_date;
