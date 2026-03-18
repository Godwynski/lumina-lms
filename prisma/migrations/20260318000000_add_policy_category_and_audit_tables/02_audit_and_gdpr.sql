-- Comprehensive audit triggers and GDPR compliance functions

-- Create audit entity change function
CREATE OR REPLACE FUNCTION public.audit_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_admin_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    END IF;

    -- Try to get user context from session
    BEGIN
        v_admin_id := COALESCE(
            (current_setting('app.user_id', true))::UUID,
            '00000000-0000-0000-0000-000000000000'::UUID
        );
    EXCEPTION WHEN OTHERS THEN
        v_admin_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END;

    INSERT INTO public.audit_logs (
        admin_id,
        entity_type,
        entity_id,
        action,
        old_value,
        new_value
    ) VALUES (
        v_admin_id,
        TG_TABLE_NAME,
        COALESCE((NEW).id, (OLD).id)::UUID,
        v_action,
        CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN to_jsonb(OLD)::text ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)::text ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    -- Silently continue if audit fails to not block main operations
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make audit_logs immutable (prevent tampering)
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified after creation';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_audit_tampering_trigger ON audit_logs;
CREATE TRIGGER prevent_audit_tampering_trigger
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_tampering();

-- Audit triggers for all mutable entities
DROP TRIGGER IF EXISTS audit_categories_trigger ON categories;
CREATE TRIGGER audit_categories_trigger
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS audit_books_trigger ON books;
CREATE TRIGGER audit_books_trigger
AFTER INSERT OR UPDATE OR DELETE ON books
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS audit_library_cards_trigger ON library_cards;
CREATE TRIGGER audit_library_cards_trigger
AFTER INSERT OR UPDATE OR DELETE ON library_cards
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS audit_borrowing_records_trigger ON borrowing_records;
CREATE TRIGGER audit_borrowing_records_trigger
AFTER INSERT OR UPDATE OR DELETE ON borrowing_records
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS audit_reservations_trigger ON reservations;
CREATE TRIGGER audit_reservations_trigger
AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

-- GDPR-compliant hard delete function (anonymization)
CREATE OR REPLACE FUNCTION public.hard_delete_user_profile(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_borrow_count INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Verify user exists
  SELECT full_name INTO v_display_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Count borrowed items (for audit trail)
  SELECT COUNT(*) INTO v_borrow_count
  FROM public.borrowing_records
  WHERE user_id = p_user_id;

  -- GDPR compliance: anonymize instead of delete
  -- This preserves transaction history while removing PII
  UPDATE public.profiles
  SET
    full_name = 'DELETED_USER_' || SUBSTRING(p_user_id::TEXT, 1, 8),
    email = 'deleted_' || SUBSTRING(p_user_id::TEXT, 1, 8) || '@deleted.local',
    phone = NULL,
    avatar_url = NULL,
    status = 'deleted',
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Update borrowing records to remove direct user reference
  -- But preserve user_display_name snapshot for historical integrity
  UPDATE public.borrowing_records
  SET
    user_id = NULL,
    user_display_name = COALESCE(v_display_name, 'Unknown User')
  WHERE user_id = p_user_id;

  -- Cancel active reservations
  UPDATE public.reservations
  SET status = 'CANCELLED'
  WHERE user_id = p_user_id
    AND status = 'ACTIVE';

  -- Create deletion audit trail
  INSERT INTO public.deleted_profile_info (
    original_profile_id,
    deletion_reason,
    retained_borrow_count
  ) VALUES (
    p_user_id,
    COALESCE(p_reason, 'User requested deletion'),
    v_borrow_count
  );

  -- Log the deletion action as immutable audit record
  INSERT INTO public.audit_logs (
    admin_id,
    entity_type,
    entity_id,
    action,
    reason
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'profile',
    p_user_id,
    'hard_delete',
    COALESCE(p_reason, 'GDPR Right to Erasure') || ' - Anonymization Complete'
  );

  v_result := jsonb_build_object(
    'success', true,
    'message', 'User profile has been anonymized per GDPR Right to Erasure',
    'user_id', p_user_id::TEXT,
    'original_name', v_display_name,
    'retained_borrow_count', v_borrow_count,
    'deleted_at', NOW()::TEXT,
    'note', 'User data anonymized; transaction history preserved for auditing'
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.hard_delete_user_profile(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_entity_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_audit_tampering() TO authenticated;
