-- 2. Insert Lab Test Definitions
INSERT INTO laboratory_tests (test_name, test_code_loinc, unit_of_measure, reference_ranges, critical_low_value, critical_high_value) VALUES
('Hemoglobin', '718-7', 'g/dL', '{"male": "13.5-17.5", "female": "12.0-15.5"}'::jsonb, 7.0, 20.0),
('White Blood Cell (WBC)', '6690-2', '10^3/uL', '{"all": "4.5-11.0"}'::jsonb, 2.0, 30.0),
('Platelets', '777-3', '10^3/uL', '{"all": "150-450"}'::jsonb, 50, 1000),
('ALT (Liver Enzyme)', '1742-6', 'U/L', '{"all": "7-56"}'::jsonb, NULL, 300), -- High is bad
('HbA1c (Glycated Hemoglobin)', '4548-4', '%', '{"normal": "<5.7", "diabetes": ">6.5"}'::jsonb, NULL, 15.0);