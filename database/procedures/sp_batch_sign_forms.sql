CREATE OR REPLACE PROCEDURE sp_batch_sign_forms(
    p_user_id INTEGER,
    p_ecrf_instance_ids INTEGER[],
    p_signing_reason TEXT DEFAULT 'Batch signature'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_ecrf_id INTEGER;
BEGIN
    -- Validate signature authority (user must be PI or Coordinator)
    IF NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.user_id = p_user_id
          AND u.role IN ('Principal_Investigator', 'Study_Coordinator')
    ) THEN
        RAISE EXCEPTION 'User does not have authority to sign forms';
    END IF;

    FOREACH v_ecrf_id IN ARRAY p_ecrf_instance_ids LOOP
        -- Check form completeness (must be 'Completed' or already 'Signed')
        IF EXISTS (
            SELECT 1 FROM ecrf_data ed
            WHERE ed.ecrf_instance_id = v_ecrf_id
              AND ed.form_status NOT IN ('Completed', 'Signed')
        ) THEN
            RAISE NOTICE 'Form % is not complete, skipping', v_ecrf_id;
            CONTINUE;
        END IF;

        -- Create electronic signature
        INSERT INTO electronic_signatures (
            signatory_user_id, document_type, document_id,
            signature_hash, signing_reason
        ) VALUES (
            p_user_id, 'eCRF', v_ecrf_id,
            MD5(CONCAT(p_user_id, v_ecrf_id, CURRENT_TIMESTAMP::TEXT)),
            p_signing_reason
        );

        -- Update form status
        UPDATE ecrf_data
        SET form_status = 'Signed',
            investigator_signature = jsonb_build_object(
                'signed_by', p_user_id,
                'signature_date', CURRENT_TIMESTAMP,
                'signing_reason', p_signing_reason
            )
        WHERE ecrf_instance_id = v_ecrf_id;
    END LOOP;
END;
$$;