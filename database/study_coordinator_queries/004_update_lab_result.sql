UPDATE lab_results
SET
    result_value = $1,
    result_status = 'Completed',
    result_date = CURRENT_TIMESTAMP
WHERE
    result_id = $2
RETURNING *;
