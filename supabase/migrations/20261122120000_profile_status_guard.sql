CREATE OR REPLACE FUNCTION public.fn_guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role public.user_role;
BEGIN
  -- The service role (server code, transfer_super_admin_ownership) and direct database sessions
  -- with no API JWT (SQL editor, cron) can update all fields. Checking current_user would not
  -- work here: in a SECURITY DEFINER trigger it is always the function owner.
  IF COALESCE((auth.jwt() ->> 'role'), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles
  WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE';

  -- There is only one super admin, so they must use the transfer flow instead
  IF OLD.id = (SELECT auth.uid()) AND OLD.role = 'super_admin'::public.user_role
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'The super admin cannot change their own role or status; transfer ownership instead';
  END IF;

  IF v_actor_role = 'super_admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Only the super admin may change roles or permissions, or edit the super admin's row
  IF OLD.role = 'super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only the super admin can edit a super admin profile';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role: only the super admin can change roles';
  END IF;

  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'Cannot modify permissions: only the super admin can change permissions';
  END IF;

  -- Librarians may also change status and student_id (approvals, corrections)
  IF v_actor_role = 'librarian'::public.user_role THEN
    IF OLD.role = 'librarian'::public.user_role AND OLD.id IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Cannot edit another librarian profile';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND
       (OLD.role NOT IN ('patron', 'library_staff') OR NEW.status NOT IN ('ACTIVE', 'PENDING', 'INACTIVE')) THEN
      RAISE EXCEPTION 'Cannot modify status: unauthorized status escalation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify status: unauthorized status escalation';
  END IF;

  -- Users cannot set or change their own student_id (it is set from the school email)
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Cannot modify student_id: it is assigned by the system or staff';
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.guard_audit_logs_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND COALESCE((auth.jwt() ->> 'role'), '') NOT IN ('anon', 'authenticated') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Audit logs are append-only';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_audit_logs_append_only() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_audit_logs_append_only();


CREATE OR REPLACE FUNCTION public.catalog_import_apply_book(p_item uuid, p_lease uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.catalog_import_items;
  target uuid;
  v_copy_ids jsonb;
BEGIN
  SELECT * INTO i FROM public.catalog_import_items WHERE id = p_item FOR UPDATE;
  IF i.lease IS DISTINCT FROM p_lease OR i.status <> 'processing' THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  target := i.book_id;
  IF target IS NULL AND i.mode = 'enrich' THEN
    RAISE EXCEPTION 'Original book no longer exists';
  END IF;
  IF target IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('catalog-isbn-' || i.isbn, 0));
    SELECT id INTO target FROM public.books WHERE upper(regexp_replace(isbn, '[[:space:]-]', '', 'g')) = i.isbn LIMIT 1 FOR UPDATE;
    IF target IS NULL THEN
      IF NULLIF(p_data->>'title', '') IS NULL THEN
        RETURN NULL;
      END IF;
      INSERT INTO public.books(title, author, isbn, is_active)
      VALUES (p_data->>'title', COALESCE(p_data->>'author', ''), i.isbn, true)
      RETURNING id INTO target;
    END IF;
  END IF;
  UPDATE public.books SET
    title = COALESCE(NULLIF(title, ''), p_data->>'title', ''),
    author = COALESCE(NULLIF(author, ''), p_data->>'author', ''),
    description = COALESCE(NULLIF(description, ''), NULLIF(p_data->>'description', '')),
    dewey_decimal = COALESCE(NULLIF(dewey_decimal, ''), NULLIF(p_data->>'dewey_decimal', '')),
    published_year = COALESCE(published_year, NULLIF(p_data->>'published_year', '')::integer),
    tags = CASE WHEN COALESCE(cardinality(tags), 0) > 0 THEN tags ELSE ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'tags', '[]'))) END,
    updated_at = NOW()
  WHERE id = target;
  IF NOT i.copies_applied AND i.mode = 'create' THEN
    WITH created AS (
      INSERT INTO public.book_copies(book_id, status)
      SELECT target, 'AVAILABLE' FROM generate_series(1, i.requested_copies)
      RETURNING id
    )
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_copy_ids FROM created;
    IF jsonb_array_length(v_copy_ids) > 0 THEN
      INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, reason, details)
      SELECT j.created_by, 'book_copy', NULL, 'create_isbn_import',
        'Created copies from an ISBN import',
        jsonb_build_object('bookIds', jsonb_build_array(target), 'copyIds', v_copy_ids, 'copiesCount', jsonb_array_length(v_copy_ids), 'jobId', i.job_id)
      FROM public.catalog_import_jobs j WHERE j.id = i.job_id
;
    END IF;
  END IF;
  UPDATE public.catalog_import_items
  SET book_id = target, copies_applied = true, title = (SELECT title FROM public.books WHERE id = target)
  WHERE id = i.id;
  RETURN target;
END;
$$;


COMMENT ON FUNCTION public.annual_student_reset() IS 'Suspends all patron accounts, including students and faculty.';
