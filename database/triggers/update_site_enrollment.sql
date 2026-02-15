CREATE OR REPLACE FUNCTION update_site_enrollment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE study_sites 
        SET current_enrollment = current_enrollment + 1
        WHERE site_id = NEW.site_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.site_id != NEW.site_id THEN
        UPDATE study_sites 
        SET current_enrollment = current_enrollment - 1
        WHERE site_id = OLD.site_id;
        UPDATE study_sites 
        SET current_enrollment = current_enrollment + 1
        WHERE site_id = NEW.site_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE study_sites 
        SET current_enrollment = current_enrollment - 1
        WHERE site_id = OLD.site_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;