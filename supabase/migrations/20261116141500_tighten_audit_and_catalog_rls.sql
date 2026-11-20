-- Tighten RLS policies on audit_logs, books, and categories from is_staff() to is_manager().
-- Student assistants have no audit log access and no catalog write access in the app layer.
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

-- 1. audit_logs: restrict SELECT to active super_admin / librarian (also governs audit_log_records view via security_invoker).
DROP POLICY IF EXISTS "Staff can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Librarians can view all audit logs" ON public.audit_logs;
CREATE POLICY "Librarians can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_manager());

-- 2. books: restrict INSERT and UPDATE to active super_admin / librarian.
DROP POLICY IF EXISTS "Staff can insert books" ON public.books;
DROP POLICY IF EXISTS "Librarians can insert books" ON public.books;
CREATE POLICY "Librarians can insert books" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Staff can update books" ON public.books;
DROP POLICY IF EXISTS "Librarians can update books" ON public.books;
CREATE POLICY "Librarians can update books" ON public.books
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- 3. categories: restrict INSERT and UPDATE to active super_admin / librarian.
DROP POLICY IF EXISTS "Staff can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Librarians can insert categories" ON public.categories;
CREATE POLICY "Librarians can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Staff can update categories" ON public.categories;
DROP POLICY IF EXISTS "Librarians can update categories" ON public.categories;
CREATE POLICY "Librarians can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

COMMIT;
