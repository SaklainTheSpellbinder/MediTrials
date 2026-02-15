CREATE OR REPLACE FUNCTION enforce_data_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM data_locks dl
        JOIN study_sites ss ON ss.trial_id = dl.trial_id
        JOIN patients p ON p.site_id = ss.site_id
        WHERE p.patient_id = NEW.patient_id
          AND dl.unlock_date IS NULL
    ) THEN
        RAISE EXCEPTION 'Data is locked for analysis. Cannot modify.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
