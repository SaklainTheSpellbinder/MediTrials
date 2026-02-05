INSERT INTO patients (
  full_name,
  trial_patient_id,
  site_id,
  screening_number,
  patient_status,
  date_of_birth,
  gender,
  enrollment_date,
  updated_at
)
VALUES
-- =========================================================
-- TRIAL 1 (Vaccine)
-- =========================================================

-- 1. The Perfect Patient (Site 1)
('Alice Johnson', '101-001', 1, 'SCR-101-001', 'Enrolled', '1985-04-12', 'Female', '2024-04-05', CURRENT_TIMESTAMP),

-- 2. The Early Withdrawal (Site 1)
('Bob Smith', '101-002', 1, 'SCR-101-002', 'Withdrawn', '1990-08-22', 'Male', '2024-04-06', CURRENT_TIMESTAMP),

-- 3. The "Safety Alert" Patient (Site 1)
('Charlie Brown', '101-003', 1, 'SCR-101-003', 'Enrolled', '1978-11-30', 'Male', '2024-04-10', CURRENT_TIMESTAMP),

-- 4. The Screen Failure (Site 2)
-- (Note: Assigned a dummy trial_patient_id because the schema requires it)
('Diana Prince', '102-FAIL-001', 2, 'SCR-102-001', 'Screen Failure', '1995-02-14', 'Female', NULL, CURRENT_TIMESTAMP),

-- 5. Active Patient (Site 2)
('Edward Stark', '102-002', 2, 'SCR-102-002', 'Enrolled', '1965-06-21', 'Male', '2024-04-20', CURRENT_TIMESTAMP),

-- 6. Active Patient (Site 2)
('Fiona Gallagher', '102-003', 2, 'SCR-102-003', 'Enrolled', '1992-09-05', 'Female', '2024-05-01', CURRENT_TIMESTAMP),

-- 7. Active Patient (Site 3)
('Hans Zimmer', '103-001', 3, 'SCR-103-001', 'Enrolled', '1980-01-15', 'Male', '2024-05-05', CURRENT_TIMESTAMP),

-- 8. The Protocol Deviation (Site 3)
('Greta Thunberg', '103-002', 3, 'SCR-103-002', 'Enrolled', '2003-01-03', 'Female', '2024-05-10', CURRENT_TIMESTAMP),

-- =========================================================
-- TRIAL 2 (Cancer Drug)
-- =========================================================

-- 9. The Long-Term Survivor (Site 4)
('Ian McKellen', '204-001', 4, 'SCR-204-001', 'Active', '1950-05-25', 'Male', '2023-11-20', CURRENT_TIMESTAMP),

-- 10. The Adverse Event Case (Site 4)
('Jessica Jones', '204-002', 4, 'SCR-204-002', 'Active', '1988-12-12', 'Female', '2023-12-01', CURRENT_TIMESTAMP),

-- 11. Japanese Patient (Site 5)
('Ken Watanabe', '205-001', 5, 'SCR-205-001', 'Active', '1959-10-21', 'Male', '2023-12-05', CURRENT_TIMESTAMP),

-- 12. Japanese Patient (Site 5)
('Lara Croft', '205-002', 5, 'SCR-205-002', 'Active', '1996-03-03', 'Female', '2023-12-15', CURRENT_TIMESTAMP),

-- =========================================================
-- TRIAL 3 (Diabetes Drug)
-- =========================================================

-- 13. Completed Patient (Site 6)
('Michael Scott', '306-001', 6, 'SCR-306-001', 'Completed', '1970-03-15', 'Male', '2022-02-15', CURRENT_TIMESTAMP),

-- 14. Completed Patient (Site 6)
('Nancy Wheeler', '306-002', 6, 'SCR-306-002', 'Completed', '2000-01-01', 'Female', '2022-03-01', CURRENT_TIMESTAMP),

-- 15. The "Lost to Follow-up" (Site 7)
('Oscar Martinez', '307-001', 7, 'SCR-307-001', 'Withdrawn', '1982-11-18', 'Male', '2022-02-20', CURRENT_TIMESTAMP);