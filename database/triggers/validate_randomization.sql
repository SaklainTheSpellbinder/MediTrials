CREATE OR REPLACE FUNCTION validate_randomization()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if patient screening passed
    IF NOT EXISTS (
        SELECT 1 FROM patient_screening ps
        WHERE ps.patient_id = NEW.patient_id
          AND ps.screening_status = 'Passed'
    ) THEN
        RAISE EXCEPTION 'Patient must pass screening before randomization';
    END IF;
    -- Check if already randomized
    IF EXISTS (
        SELECT 1 FROM randomization_assignments
        WHERE patient_id = NEW.patient_id
    ) THEN
        RAISE EXCEPTION 'Patient already randomized';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;