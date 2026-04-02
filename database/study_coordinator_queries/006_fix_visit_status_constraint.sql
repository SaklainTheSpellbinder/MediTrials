ALTER TABLE patient_visits DROP CONSTRAINT IF EXISTS patient_visits_visit_status_check;
ALTER TABLE patient_visits ADD CONSTRAINT patient_visits_visit_status_check CHECK (visit_status IN ('Scheduled', 'Checked In', 'In Progress', 'Completed', 'Missed', 'Cancelled'));
