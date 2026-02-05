INSERT INTO lab_results (patient_id, test_id, visit_instance_id, result_value, result_status, critical_result_flag, result_date) VALUES
-- PATIENT 1 (Alice) - Visit 1 (Screening) - ALL NORMAL
(1, 1, 1, 14.2, 'Completed', 'N', '2024-03-30'), -- Normal Hgb
(1, 2, 1, 6.5,  'Completed', 'N', '2024-03-30'), -- Normal WBC

-- PATIENT 1 (Alice) - Visit 2 (Dose 1) - STILL NORMAL
(1, 1, 2, 14.1, 'Completed', 'N', '2024-04-05'),
(1, 2, 2, 7.1,  'Completed', 'N', '2024-04-05'),

-- PATIENT 10 (Jessica) - Cancer Patient - LOW BLOOD COUNTS (Chemo effect?)
(10, 1, 6, 9.5, 'Completed', 'N', '2023-11-20'),  -- Low Hemoglobin (Anemia)
(10, 2, 6, 2.5, 'Completed', 'Y', '2023-11-20'),  -- CRITICAL Low WBC (Neutropenia)

-- PATIENT 13 (Michael) - Diabetes - SHOWING IMPROVEMENT
(13, 5, 9, 8.5, 'Completed', 'N', '2022-02-05'),  -- Visit 1: High HbA1c (8.5%)
(13, 5, 11, 7.1, 'Completed', 'N', '2022-05-12'), -- Visit 3: Lower (7.1%) - Drug working!
(13, 5, 12, 6.4, 'Completed', 'N', '2022-08-01'); -- Visit 4: Good (6.4%)