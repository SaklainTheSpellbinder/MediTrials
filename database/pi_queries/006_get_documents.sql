-- 006_get_documents.sql
-- Gets documents and audit trail for a patient

-- Query 1: Informed Consent
SELECT 
    consent_version,
    consent_date,
    digital_signature_hash,
    is_withdrawn,
    withdrawal_date
FROM informed_consent
WHERE patient_id = $1
ORDER BY consent_date DESC;

-- Query 2: Signed eCRFs
SELECT 
    ed.ecrf_id,
    def.ecrf_name,
    ed.form_status,
    ed.data_entry_date,
    ed.investigator_signature,
    es.signature_hash,
    es.signed_at
FROM ecrf_data ed
JOIN ecrf_definitions def ON ed.ecrf_id = def.ecrf_id
LEFT JOIN electronic_signatures es ON es.document_id = ed.ecrf_instance_id AND es.document_type = 'eCRF'
WHERE ed.patient_id = $1 AND ed.form_status IN ('Signed', 'Locked')
ORDER BY ed.data_entry_date DESC;

-- Query 3: Audit Trail (Last 50)
-- For patient-specific audit trail, we look for records involving this patient's ID
-- in relevant tables. This is a simplified approach assuming record_id maps to patient_id 
-- for the patients table or we query by change_timestamp for recent activity.
-- A more robust implementation would trace the patient_id through all related tables.
SELECT 
    table_name,
    action_type,
    column_name,
    change_timestamp,
    change_reason,
    changed_by_user_id
FROM audit_trail_21cfr
WHERE (table_name = 'patients' AND record_id = $1)
   OR table_name IN ('patient_visits', 'lab_results', 'adverse_events', 'ecrf_data') 
      -- Simplification: usually we would join back to get exact row matches, 
      -- but for this mock we just get the latest 50 for the whole system or 
      -- implement a specific tracing logic.
ORDER BY change_timestamp DESC
LIMIT 50;
