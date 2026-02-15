CREATE OR REPLACE PROCEDURE sp_lock_database(
    p_trial_id INTEGER,
    p_lock_type VARCHAR,
    p_locked_by_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_snapshot_hash TEXT;
BEGIN
    -- Generate snapshot hash (simplified)
    SELECT MD5(
        CONCAT(
            COUNT(DISTINCT p.patient_id)::TEXT,
            COUNT(DISTINCT ae.ae_id)::TEXT,
            COUNT(DISTINCT lr.result_id)::TEXT,
            EXTRACT(EPOCH FROM NOW())::TEXT
        )
    ) INTO v_snapshot_hash
    FROM patients p
    JOIN study_sites ss ON p.site_id = ss.site_id
    LEFT JOIN adverse_events ae ON p.patient_id = ae.patient_id
    LEFT JOIN lab_results lr ON p.patient_id = lr.patient_id
    WHERE ss.trial_id = p_trial_id;

    -- Create data lock
    INSERT INTO data_locks (
        trial_id, lock_type, locked_by_user_id, snapshot_hash
    ) VALUES (
        p_trial_id, p_lock_type, p_locked_by_user_id, v_snapshot_hash
    );
END;
$$;