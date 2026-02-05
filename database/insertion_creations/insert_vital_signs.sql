INSERT INTO vital_signs (patient_id, visit_instance_id, systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation) VALUES
-- Alice (Healthy)
(1, 1, 120, 80, 72, 36.6, 99),
(1, 2, 118, 78, 75, 36.7, 98),

-- Jessica (Sick - Fever)
(10, 6, 100, 60, 110, 38.5, 94), -- Fever + High Heart Rate (Infection risk?)

-- Michael (High BP improved)
(13, 9, 150, 95, 80, 36.5, 97),  -- High BP at start
(13, 12, 130, 85, 76, 36.4, 98); -- Better BP at end