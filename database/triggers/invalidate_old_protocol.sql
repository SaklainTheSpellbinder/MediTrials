CREATE OR REPLACE FUNCTION invalidate_old_protocol()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE study_protocols
    SET valid_to = CURRENT_DATE
    WHERE trial_id = NEW.trial_id
      AND protocol_id != NEW.protocol_id
      AND valid_to IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;