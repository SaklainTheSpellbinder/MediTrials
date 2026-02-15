CREATE OR REPLACE FUNCTION check_visit_window()
RETURNS TRIGGER AS $$
DECLARE
    v_window_before INTEGER;
    v_window_after INTEGER;
    v_scheduled_date DATE;
BEGIN
    SELECT visit_window_before_days, visit_window_after_days
    INTO v_window_before, v_window_after
    FROM visit_schedules
    WHERE visit_id = NEW.visit_id;

    IF NEW.actual_visit_date IS NOT NULL THEN
        v_scheduled_date := NEW.scheduled_date;

        IF NEW.actual_visit_date < v_scheduled_date - v_window_before THEN
            NEW.visit_window_status := 'Early';
        ELSIF NEW.actual_visit_date > v_scheduled_date + v_window_after THEN
            NEW.visit_window_status := 'Late';
        ELSE
            NEW.visit_window_status := 'Within Window';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;