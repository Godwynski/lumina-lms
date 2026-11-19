-- 1. Trigger function public.ensure_profile_library_card() is SECURITY DEFINER and
--    should not be directly executable by PUBLIC, anon, authenticated, or service_role.
--    PostgreSQL fires triggers internally without requiring EXECUTE privileges.
REVOKE ALL ON FUNCTION public.ensure_profile_library_card()
  FROM PUBLIC, anon, authenticated, service_role;

-- 2. Add explicit deny-all RLS policy on public.book_copy_lifecycle (matches demo_accounts)
--    to resolve rls_enabled_no_policy while preserving service_role-only access.
DROP POLICY IF EXISTS "Deny direct access to book copy lifecycle" ON public.book_copy_lifecycle;
CREATE POLICY "Deny direct access to book copy lifecycle" ON public.book_copy_lifecycle
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- 3. Add covering B-tree index for borrowing_records_fine_settled_by_fkey
--    to resolve unindexed_foreign_keys advisor.
CREATE INDEX IF NOT EXISTS borrowing_records_fine_settled_by_idx
  ON public.borrowing_records (fine_settled_by);
