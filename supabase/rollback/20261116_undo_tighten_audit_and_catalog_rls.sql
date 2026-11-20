-- Undo for migration 20261116141500_tighten_audit_and_catalog_rls.sql.
-- Restores the prior is_staff() policies on audit_logs, books, and categories.
BEGIN;

DROP POLICY IF EXISTS "Librarians can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can view all audit logs" ON public.audit_logs;
CREATE POLICY "Staff can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Librarians can insert books" ON public.books;
DROP POLICY IF EXISTS "Staff can insert books" ON public.books;
CREATE POLICY "Staff can insert books" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Librarians can update books" ON public.books;
DROP POLICY IF EXISTS "Staff can update books" ON public.books;
CREATE POLICY "Staff can update books" ON public.books
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Librarians can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can insert categories" ON public.categories;
CREATE POLICY "Staff can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Librarians can update categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can update categories" ON public.categories;
CREATE POLICY "Staff can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMIT;
