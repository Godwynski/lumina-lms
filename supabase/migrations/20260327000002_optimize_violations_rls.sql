-- Optimize RLS policies with auth.uid() caching
-- Using security definer functions to cache auth.uid() and improve performance

-- Create security definer function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'librarian', 'staff')
  );
END;
$$;

-- Create security definer function to check if user can view violations
CREATE OR REPLACE FUNCTION public.can_view_violations()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_staff BOOLEAN;
BEGIN
  current_user_id := (SELECT auth.uid());
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_user_id
      AND role IN ('admin', 'librarian', 'staff')
  ) INTO is_staff;
  
  RETURN is_staff;
END;
$$;

-- Drop and recreate policies with optimized RLS using cached auth.uid()
DROP POLICY IF EXISTS "Users can view own violations" ON public.violations;
DROP POLICY IF EXISTS "Librarians can manage violations" ON public.violations;

CREATE POLICY "Staff can view violations"
  ON public.violations FOR SELECT
  TO authenticated
  USING (public.can_view_violations());

CREATE POLICY "Staff can insert violations"
  ON public.violations FOR INSERT
  TO authenticated
  WITH CHECK (public.can_view_violations());

CREATE POLICY "Staff can update violations"
  ON public.violations FOR UPDATE
  TO authenticated
  USING (public.can_view_violations())
  WITH CHECK (public.can_view_violations());

CREATE POLICY "Staff can delete violations"
  ON public.violations FOR DELETE
  TO authenticated
  USING (public.can_view_violations());

-- Create index on created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_violations_created_by ON public.violations(created_by);
