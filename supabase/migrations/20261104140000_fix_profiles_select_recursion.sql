-- Hotfix for 20261104120000_rls_roles_signup (C2). The profiles update policies query profiles in a
-- subquery; a sub-select inside the profiles SELECT policy then counts as policy recursion
-- ("infinite recursion detected in policy for relation profiles"), so write it without one.
-- Mirrored in supabase/schema_clean_install.sql.
DROP POLICY IF EXISTS "Users can view own profile, staff can view all" ON public.profiles;
CREATE POLICY "Users can view own profile, staff can view all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff());
