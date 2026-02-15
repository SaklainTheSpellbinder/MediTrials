CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id INTEGER;
    v_changed_by INTEGER;
    v_change_reason TEXT;
BEGIN
    -- Capture the changed data
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.patient_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := OLD.patient_id;  -- again, not universal
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.patient_id;
    END IF;

    -- Get user context (set by application)
    BEGIN
        v_changed_by := current_setting('app.current_user_id')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_changed_by := NULL;
    END;
    BEGIN
        v_change_reason := current_setting('app.change_reason');
    EXCEPTION WHEN OTHERS THEN
        v_change_reason := TG_OP;
    END;

    INSERT INTO audit_trail_21cfr (
        table_name, record_id, action_type,
        old_value, new_value, changed_by_user_id,
        change_reason, ip_address, data_hash
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_changed_by,
        v_change_reason,
        inet_client_addr(),
        md5(COALESCE(v_old_data::TEXT, '') || COALESCE(v_new_data::TEXT, '') || TG_OP || TG_TABLE_NAME)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;