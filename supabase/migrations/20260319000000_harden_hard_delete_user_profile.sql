-- Harden hard_delete_user_profile with in-function authorization checks.
-- This keeps self-delete working while blocking cross-user RPC abuse.

CREATE OR REPLACE FUNCTION public.hard_delete_user_profile(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_display_name TEXT;
  v_borrow_count INTEGER := 0;
  v_result JSONB;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Unauthorized'
    );
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Caller profile not found'
    );
  END IF;

  IF v_actor_id <> p_user_id AND v_actor_role NOT IN ('admin', 'librarian') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Forbidden'
    );
  END IF;

  SELECT full_name INTO v_display_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  SELECT COUNT(*) INTO v_borrow_count
  FROM public.borrowing_records
  WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    full_name = 'DELETED_USER_' || SUBSTRING(p_user_id::TEXT, 1, 8),
    email = 'deleted_' || SUBSTRING(p_user_id::TEXT, 1, 8) || '@deleted.local',
    phone = NULL,
    avatar_url = NULL,
    status = 'deleted',
    updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE public.borrowing_records
  SET
    user_id = NULL,
    user_display_name = COALESCE(v_display_name, 'Unknown User')
  WHERE user_id = p_user_id;

  UPDATE public.reservations
  SET status = CASE
    WHEN status::text = UPPER(status::text) THEN 'CANCELLED'
    ELSE 'cancelled'
  END
  WHERE user_id = p_user_id
    AND UPPER(status::text) = 'ACTIVE';

  INSERT INTO public.deleted_profile_info (
    original_profile_id,
    deletion_reason,
    retained_borrow_count
  ) VALUES (
    p_user_id,
    COALESCE(p_reason, 'User requested deletion'),
    v_borrow_count
  )
  ON CONFLICT (original_profile_id)
  DO UPDATE SET
    deletion_reason = EXCLUDED.deletion_reason,
    retained_borrow_count = EXCLUDED.retained_borrow_count,
    anonymized_at = NOW();

  INSERT INTO public.audit_logs (
    admin_id,
    entity_type,
    entity_id,
    action,
    reason
  ) VALUES (
    v_actor_id,
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

REVOKE EXECUTE ON FUNCTION public.hard_delete_user_profile(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.hard_delete_user_profile(UUID, TEXT) TO authenticated;
