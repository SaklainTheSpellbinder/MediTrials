INSERT INTO visit_schedules (
  trial_id,
  visit_number,
  visit_name,
  day_offset,
  visit_window_before_days,
  visit_window_after_days,
  required_procedures
)
VALUES
-- =============================================
-- TRIAL 1: COVID Vaccine (NCT04829103)
-- =============================================
(1, 10, 'Screening', -7, 0, 7, '["Informed Consent", "Vitals", "Eligibility Check"]'),
(1, 20, 'Vaccination Dose 1', 0, 0, 3, '["Vitals", "Vaccine Admin", "AE Review"]'),
(1, 30, 'Vaccination Dose 2', 28, 3, 3, '["Vitals", "Vaccine Admin", "AE Review"]'),
(1, 40, 'Safety Follow-up (Day 60)', 60, 5, 5, '["Vitals", "Lab Tests", "Concomitant Meds"]'),

-- =============================================
-- TRIAL 2: Cancer Drug (NCT03928174)
-- =============================================
(2, 10, 'Screening', -14, 0, 14, '["CT Scan", "Biopsy", "ECG"]'),
(2, 20, 'Cycle 1 Day 1', 0, 0, 2, '["Drug Infusion", "PK Sampling"]'),
(2, 30, 'Cycle 2 Day 1', 21, 2, 2, '["Drug Infusion", "Vitals"]'),
(2, 40, 'Tumor Assessment', 60, 7, 7, '["CT Scan", "RECIST Evaluation"]'),

-- =============================================
-- TRIAL 3: Diabetes Drug (NCT05129482)
-- =============================================
(3, 10, 'Screening', -10, 0, 10, '["HbA1c Test", "BMI Check"]'),
(3, 20, 'Baseline Randomization', 0, 0, 5, '["Dispense Drug", "Training"]'),
(3, 30, 'Week 12 Follow-up', 84, 5, 5, '["HbA1c Test", "Drug Accountability"]'),
(3, 40, 'End of Study (Week 24)', 168, 7, 7, '["Final Exam", "Drug Return"]');