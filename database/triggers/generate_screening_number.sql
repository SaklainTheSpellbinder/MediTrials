CREATE OR REPLACE FUNCTION generate_screening_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.screening_number IS NULL THEN
        NEW.screening_number := 'SCR-' || LPAD(NEW.patient_id::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;