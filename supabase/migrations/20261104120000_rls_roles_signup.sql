-- B2.1 (docs/AUDIT_CHECKLIST.md): RLS, roles and sign-up. Fixes C1, C2, C3, M13, M14, M17.
-- Mirrored in supabase/schema_clean_install.sql. Take a backup before running this on the live database.
BEGIN;

-- Active super_admin or librarian (is_staff() also includes student assistants).
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND status = 'ACTIVE'
    AND role IN ('super_admin', 'librarian')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, service_role;

-- C3: only take a student number from school emails.
CREATE OR REPLACE FUNCTION public.auto_set_student_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_local_part TEXT;
  v_digit_match TEXT;
  v_student_id TEXT;
  v_domain TEXT;
BEGIN
  -- Only act if student_id is not already set
  IF NEW.student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Parse email parts
  v_local_part := lower(split_part(COALESCE(NEW.email, ''), '@', 1));
  v_domain     := lower(split_part(COALESCE(NEW.email, ''), '@', 2));

  IF v_local_part = '' THEN
    RETURN NEW;
  END IF;

  -- Only school emails get an ID; anything else stays NULL (staff can set it manually).
  IF v_domain = 'sti.edu.ph' OR v_domain LIKE '%.sti.edu.ph' THEN
    -- Try to extract 6+ digit sequence (student number)
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];

    IF v_digit_match IS NOT NULL THEN
      -- Student: lastname.NUMBER@sti.edu.ph → STU-NUMBER
      v_student_id := 'STU-' || v_digit_match;
    ELSE
      -- Faculty/staff: no digit sequence → FAC-localpart
      v_student_id := 'FAC-' || v_local_part;
    END IF;
  END IF;

  -- Sanitize and assign
  IF v_student_id IS NOT NULL THEN
    NEW.student_id := upper(regexp_replace(v_student_id, '[^A-Z0-9._\-]', '_', 'g'));
  END IF;

  RETURN NEW;
END;
$$;

-- C3: reject sign-ups from other email domains (@lumina.test is for the demo accounts).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  card_number_val TEXT;
BEGIN
  IF lower(COALESCE(new.email, '')) !~ '^[^@]+@(alabang\.sti\.edu\.ph|lumina\.test)$' THEN
    RAISE EXCEPTION 'Sign-up is limited to @alabang.sti.edu.ph accounts';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, avatar_url, email, status, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    'PENDING',
    'student'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

  -- Create library card with PENDING status
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '100 years')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- C1, C3, M17: who may change role, permissions, status and student_id.
CREATE OR REPLACE FUNCTION public.fn_guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role public.user_role;
BEGIN
  -- The service role (server code, transfer_super_admin_ownership) can update all fields
  IF COALESCE((auth.jwt() ->> 'role'), '') = 'service_role' OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles
  WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE';

  -- M17: there is only one super admin, so they must use the transfer flow instead
  IF OLD.id = (SELECT auth.uid()) AND OLD.role = 'super_admin'::public.user_role
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'The super admin cannot change their own role or status; transfer ownership instead';
  END IF;

  IF v_actor_role = 'super_admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- C1: only the super admin may change roles or permissions, or edit the super admin's row
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
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify status: unauthorized status escalation';
  END IF;

  -- C3: users cannot set or change their own student_id (it is set from the school email)
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Cannot modify student_id: it is assigned by the system or staff';
  END IF;

  RETURN NEW;
END;
$$;

-- C2: users read only their own profile; staff read all.
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile, staff can view all" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_staff());

-- M13: attendance is recorded by staff only.
DROP POLICY IF EXISTS "Users can self check-in" ON public.attendance;
DROP POLICY IF EXISTS "Users can self check-out" ON public.attendance;

-- M14: student assistants can read circulation data but not write it directly.
DROP POLICY IF EXISTS "Staff can insert book_copies" ON public.book_copies;
DROP POLICY IF EXISTS "Staff can update book_copies" ON public.book_copies;
CREATE POLICY "Librarians can insert book_copies" ON public.book_copies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());
CREATE POLICY "Librarians can update book_copies" ON public.book_copies
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Staff can insert borrowing records" ON public.borrowing_records;
DROP POLICY IF EXISTS "Staff can update borrowing records" ON public.borrowing_records;
CREATE POLICY "Librarians can insert borrowing records" ON public.borrowing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());
CREATE POLICY "Librarians can update borrowing records" ON public.borrowing_records
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Staff can manage reservations" ON public.reservations;
CREATE POLICY "Staff can view all reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Librarians can manage reservations" ON public.reservations
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

COMMIT;
