-- 001_get_eligibility_criteria.sql
-- Fetches all inclusion/exclusion criteria for the trial linked to a given site
-- Param $1: site_id

SELECT
    ec.criterion_id,
    ec.criterion_type,         -- 'Inclusion' | 'Exclusion'
    ec.criterion_text,
    ec.is_mandatory,
    ec.criterion_logic
FROM eligibility_criteria ec
INNER JOIN study_sites ss ON ss.trial_id = ec.trial_id
WHERE ss.site_id = $1
ORDER BY ec.criterion_type DESC, ec.criterion_id ASC;
-- Inclusion first (DESC = I before E), then Exclusion
