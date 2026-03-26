-- Consolidate and harden RLS policies for library_cards

-- 1. Drop redundant policies
DROP POLICY IF EXISTS "Users can view their own library card" ON public.library_cards;
DROP POLICY IF EXISTS "Users can view their own library card." ON public.library_cards;
DROP POLICY IF EXISTS "Admin and librarians can manage library cards." ON public.library_cards;
DROP POLICY IF EXISTS "Admins can manage all cards" ON public.library_cards;

-- 2. Create clean, robust policies
-- Residents/Students can view their OWN cards
CREATE POLICY "Users can view own card"
ON public.library_cards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins and Librarians can do EVERYTHING (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins and librarians can manage all cards"
ON public.library_cards
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'librarian')
  )
);
