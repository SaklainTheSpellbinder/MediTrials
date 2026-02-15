-- 10. Randomization Balance
CREATE MATERIALIZED VIEW mv_randomization_balance AS
SELECT 
    ct.trial_id,
    ct.trial_title,
    ta.arm_id,
    ta.arm_code,
    COUNT(DISTINCT ra.patient_id) as patient_count,
    ROUND(AVG(EXTRACT(YEAR FROM AGE(p.date_of_birth))), 1) as avg_age,
    COUNT(DISTINCT CASE WHEN p.gender = 'Male' THEN p.patient_id END) as male_count,
    COUNT(DISTINCT CASE WHEN p.gender = 'Female' THEN p.patient_id END) as female_count,
    ROUND(
        COUNT(DISTINCT CASE WHEN p.gender = 'Male' THEN p.patient_id END)::DECIMAL / 
        NULLIF(COUNT(DISTINCT ra.patient_id), 0) * 100, 2
    ) as percent_male
FROM randomization_assignments ra
JOIN patients p ON ra.patient_id = p.patient_id
JOIN treatment_arms ta ON ra.arm_id = ta.arm_id
JOIN clinical_trials ct ON ta.trial_id = ct.trial_id
GROUP BY ct.trial_id, ct.trial_title, ta.arm_id, ta.arm_code;