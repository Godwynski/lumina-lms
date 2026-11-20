BEGIN;

-- 1. Unindexed foreign keys on catalog import tables
CREATE INDEX IF NOT EXISTS catalog_import_items_book_id_idx
  ON public.catalog_import_items (book_id);

CREATE INDEX IF NOT EXISTS catalog_import_jobs_created_by_idx
  ON public.catalog_import_jobs (created_by);

-- 2. Fix auth_rls_initplan on public.profiles without re-introducing 42P17 policy recursion.
-- Using public.is_manager() (SECURITY DEFINER) in the UPDATE policy avoids querying
-- public.profiles directly inside a profiles policy when SELECT wraps auth.uid().
DROP POLICY IF EXISTS "Users can view own profile, staff can view all" ON public.profiles;
CREATE POLICY "Users can view own profile, staff can view all" ON public.profiles
  FOR SELECT TO authenticated
  USING ((id = (SELECT auth.uid())) OR public.is_staff());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = id) OR public.is_manager())
  WITH CHECK (((SELECT auth.uid()) = id) OR public.is_manager());

-- 3. Consolidate SELECT policies on public.books into one policy.
-- Inline the active-staff check rather than calling public.is_staff() because
-- EXECUTE on is_staff() is revoked from anon; referencing is_staff() in a
-- TO public policy triggers permission-denied errors on anonymous catalog queries.
DROP POLICY IF EXISTS "Active books are viewable by everyone" ON public.books;
DROP POLICY IF EXISTS "Staff can view all books" ON public.books;
DROP POLICY IF EXISTS "Books select policy" ON public.books;
CREATE POLICY "Books select policy" ON public.books
  FOR SELECT TO public
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'ACTIVE'
        AND role IN (
          'super_admin'::public.user_role,
          'librarian'::public.user_role,
          'student_assistant'::public.user_role
        )
    )
  );

-- 4. Eliminate multiple_permissive_policies on public.reservations by keeping a single
-- SELECT policy and splitting manager writes into explicit INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can view all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Reservations select policy" ON public.reservations;
CREATE POLICY "Reservations select policy" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_staff() OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Librarians can manage reservations" ON public.reservations;
DROP POLICY IF EXISTS "Librarians can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Librarians can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Librarians can delete reservations" ON public.reservations;
CREATE POLICY "Librarians can insert reservations" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY "Librarians can update reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY "Librarians can delete reservations" ON public.reservations
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- 5. Add explicit deny-all policy for rls_enabled_no_policy on public.demo_accounts
DROP POLICY IF EXISTS "Deny direct access to demo accounts" ON public.demo_accounts;
CREATE POLICY "Deny direct access to demo accounts" ON public.demo_accounts
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

COMMIT;
