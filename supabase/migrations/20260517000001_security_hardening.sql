-- 1. Hardening auto_checkout_forgotten_attendance with secure search_path
CREATE OR REPLACE FUNCTION public.auto_checkout_forgotten_attendance()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Close any open attendance records from previous days
  -- Setting checkout time to 5:00 PM (17:00:00) of that check-in day
  UPDATE public.attendance
  SET 
    check_out_at = (check_in_at::date + time '17:00:00')::timestamptz,
    notes = 'System auto-checkout: forgotten checkout'
  WHERE 
    check_out_at IS NULL 
    AND check_in_at < CURRENT_DATE;
END;
$function$;

-- 2. Hardening create_reservation_atomic with internal authorization enforcements
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_actor_id uuid, 
    p_book_id uuid, 
    p_target_user_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
    v_actor_role     user_role;
BEGIN
    -- Authorization Enforcements:
    -- 1. Enforce that if auth.uid() is not null (invoked from authenticated client),
    --    the p_actor_id must match auth.uid().
    IF auth.uid() IS NOT NULL AND p_actor_id <> auth.uid() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Actor ID must match authenticated user.');
    END IF;

    -- 2. If reserving on behalf of another user, verify that p_actor_id has a staff role.
    IF v_target_id <> p_actor_id THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
        IF v_actor_role NOT IN ('admin', 'librarian', 'student_assistant') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF v_profile_status = 'SUSPENDED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUSPENDED', 'message', 'User account is suspended.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    -- Expire old READY reservations
    WITH expired_holds AS (
        UPDATE public.reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE book_id = p_book_id 
          AND status = 'READY' 
          AND hold_expires_at < NOW()
        RETURNING copy_id
    )
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = NOW()
    WHERE id IN (SELECT copy_id FROM expired_holds);

    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';
        
        v_expiry := NOW() + (v_hold_days || ' days')::interval;
        
        UPDATE public.book_copies SET status = 'RESERVED', updated_at = NOW() WHERE id = v_copy_id;
        
        INSERT INTO public.reservations (user_id, book_id, copy_id, queue_position, status, hold_expires_at)
        VALUES (v_target_id, p_book_id, v_copy_id, 1, 'READY', v_expiry)
        RETURNING id INTO v_res_id;
        
        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'READY', 'copy_id', v_copy_id, 'hold_expires_at', v_expiry);
    ELSE
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_queue_pos
        FROM public.reservations WHERE book_id = p_book_id AND status = 'ACTIVE';
        
        INSERT INTO public.reservations (user_id, book_id, queue_position, status)
        VALUES (v_target_id, p_book_id, v_queue_pos, 'ACTIVE')
        RETURNING id INTO v_res_id;
        
        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'ACTIVE', 'queue_position', v_queue_pos);
    END IF;
END;
$function$;

-- 3. Revoking Direct Execute Privileges from Public/Anon/Authenticated on Sensitive Functions
REVOKE EXECUTE ON FUNCTION public.process_qr_checkout(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_qr_return(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compress_reservation_queue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_checkout_forgotten_attendance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_set_student_id() FROM PUBLIC, anon, authenticated;

-- 4. Securing Storage Bucket Listing
DROP POLICY IF EXISTS "Avatar Public View" ON storage.objects;
DROP POLICY IF EXISTS "Book Covers Public View" ON storage.objects;

-- 5. Hardening Audit Logs against client-side insertion tampering
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
