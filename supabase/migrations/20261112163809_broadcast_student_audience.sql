CREATE OR REPLACE FUNCTION public.send_bulk_notifications_by_target(
  p_target text,
  p_title text,
  p_content text,
  p_type text DEFAULT 'SYSTEM',
  p_priority text DEFAULT 'high',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    SELECT
      p.id,
      p_title,
      p_content,
      COALESCE(p_type, 'SYSTEM'),
      COALESCE(p_priority, 'high'),
      COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    WHERE p_target = 'all'
       OR (p_target = 'students' AND p.role IN ('student', 'student_assistant'))
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text,text,text,text,text,jsonb) TO authenticated, service_role;
