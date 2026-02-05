INSERT INTO investigators (user_id, site_id, investigator_name, medical_license_number, gcp_certification_date, electronic_signature_key)
SELECT user_id, site_id, 'Dr. Sarah Connor', 'MD-MA-001', '2023-01-01'::DATE, 'SIG-SC-001' FROM users WHERE username = 'dr_connor'
UNION ALL
SELECT user_id, site_id, 'Dr. John Watson', 'GMC-UK-002', '2023-02-01'::DATE, 'SIG-JW-002' FROM users WHERE username = 'dr_watson'
UNION ALL
SELECT user_id, site_id, 'Dr. Hans Gruber', 'DE-MED-003', '2023-03-01'::DATE, 'SIG-HG-003' FROM users WHERE username = 'dr_gruber'
UNION ALL
SELECT user_id, site_id, 'Dr. Meredith Grey', 'MD-TX-004', '2023-04-01'::DATE, 'SIG-MG-004' FROM users WHERE username = 'dr_grey'
UNION ALL
SELECT user_id, site_id, 'Dr. Akira Tanaka', 'JP-MED-005', '2023-05-01'::DATE, 'SIG-AT-005' FROM users WHERE username = 'dr_tanaka'
UNION ALL
SELECT user_id, site_id, 'Dr. Gregory House', 'MD-IL-006', '2023-06-01'::DATE, 'SIG-GH-006' FROM users WHERE username = 'dr_house';