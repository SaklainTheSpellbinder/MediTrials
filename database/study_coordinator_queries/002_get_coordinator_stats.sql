-- Get Key Metrics for Coordinator Dashboard

SELECT
    (SELECT COUNT(*) FROM patient_visits pv 
     JOIN patients p ON pv.patient_id = p.patient_id 
     WHERE p.site_id = $1 AND pv.scheduled_date = CURRENT_DATE) as today_visits,

    (SELECT COUNT(*) FROM lab_results lr
     JOIN patients p ON lr.patient_id = p.patient_id
     WHERE p.site_id = $1 AND lr.result_status = 'Pending') as pending_labs,

    (SELECT COUNT(*) FROM ecrf_data ed
     JOIN patients p ON ed.patient_id = p.patient_id
     WHERE p.site_id = $1 AND ed.form_status = 'In Progress') as incomplete_ecrfs,

    (SELECT COUNT(*) FROM data_queries dq
     JOIN ecrf_data ed ON dq.ecrf_instance_id = ed.ecrf_instance_id
     JOIN patients p ON ed.patient_id = p.patient_id
     WHERE p.site_id = $1 AND dq.query_status = 'Open') as open_queries;
