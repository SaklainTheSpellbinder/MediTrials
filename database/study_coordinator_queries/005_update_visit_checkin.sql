UPDATE patient_visits
SET
    visit_status = 'Checked In',
    updated_at = CURRENT_TIMESTAMP
WHERE
    visit_instance_id = $1
RETURNING *;
