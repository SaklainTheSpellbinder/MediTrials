-- 002_get_protocol_versions.sql
-- Fetches consent versions available for a site's trial
-- Param $1: site_id

SELECT
    sp.protocol_id,
    sp.version_number,
    sp.approval_date,
    sp.valid_from,
    sp.valid_to,
    sp.amendment_number
FROM study_protocols sp
INNER JOIN study_sites ss ON ss.trial_id = sp.trial_id
WHERE ss.site_id = $1
  AND (sp.valid_to IS NULL OR sp.valid_to >= CURRENT_DATE)
ORDER BY sp.valid_from DESC;
