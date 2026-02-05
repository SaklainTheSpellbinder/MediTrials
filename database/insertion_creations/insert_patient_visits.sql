INSERT INTO patient_visits (
  patient_id,
  visit_id,
  scheduled_date,
  actual_visit_date,
  visit_status,
  visit_window_status,
  updated_at
)
VALUES
-- =========================================================
-- PATIENT 1: Alice Johnson (Enrolled 2024-04-05) - Trial 1
-- Ideally compliant patient.
-- =========================================================
(1, 1, '2024-03-29', '2024-03-30', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening
(1, 2, '2024-04-05', '2024-04-05', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Dose 1
(1, 3, '2024-05-03', '2024-05-04', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Dose 2 (Day 28)
(1, 4, '2024-06-04', NULL, 'Scheduled', NULL, CURRENT_TIMESTAMP),                    -- Follow up (Future)

-- =========================================================
-- PATIENT 2: Bob Smith (Enrolled 2024-04-06) - Trial 1
-- WITHDRAWN right after enrollment.
-- =========================================================
(2, 1, '2024-04-01', '2024-04-01', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening
(2, 2, '2024-04-06', '2024-04-06', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Dose 1
(2, 3, '2024-05-04', NULL, 'Cancelled', NULL, CURRENT_TIMESTAMP),                    -- Dose 2 (Cancelled)

-- =========================================================
-- PATIENT 4: Diana Prince (Screen Failure) - Trial 1
-- She only has a screening visit, and it failed.
-- =========================================================
(4, 1, '2024-04-10', '2024-04-10', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening

-- =========================================================
-- PATIENT 8: Greta Thunberg (Enrolled 2024-05-10) - Trial 1
-- PROTOCOL DEVIATION: She showed up very late for Dose 1.
-- =========================================================
(8, 1, '2024-05-01', '2024-05-02', 'Completed', 'Within Window', CURRENT_TIMESTAMP),
(8, 2, '2024-05-10', '2024-05-15', 'Completed', 'Outside Window', CURRENT_TIMESTAMP), -- 5 Days late (Window is 3)

-- =========================================================
-- PATIENT 9: Ian McKellen (Enrolled 2023-11-20) - Trial 2
-- Cancer trial. Long term, consistent data.
-- =========================================================
(9, 5, '2023-11-06', '2023-11-06', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening
(9, 6, '2023-11-20', '2023-11-20', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Cycle 1
(9, 7, '2023-12-11', '2023-12-11', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Cycle 2
(9, 8, '2024-01-19', '2024-01-20', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Tumor Assessment

-- =========================================================
-- PATIENT 13: Michael Scott (Enrolled 2022-02-15) - Trial 3
-- Diabetes Trial (Completed Study). All historic data.
-- =========================================================
(13, 9, '2022-02-05', '2022-02-05', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening
(13, 10, '2022-02-15', '2022-02-15', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Baseline
(13, 11, '2022-05-10', '2022-05-12', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Week 12
(13, 12, '2022-08-02', '2022-08-01', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- End of Study

-- =========================================================
-- PATIENT 15: Oscar Martinez (Enrolled 2022-02-20) - Trial 3
-- LOST TO FOLLOW UP (Withdrawn). Missed the last visit.
-- =========================================================
(15, 9, '2022-02-10', '2022-02-10', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Screening
(15, 10, '2022-02-20', '2022-02-20', 'Completed', 'Within Window', CURRENT_TIMESTAMP), -- Baseline
(15, 11, '2022-05-15', NULL, 'Missed', NULL, CURRENT_TIMESTAMP),                       -- Week 12 (Ghosted)
(15, 12, '2022-08-07', NULL, 'Missed', NULL, CURRENT_TIMESTAMP);                       -- EOS (Ghosted)