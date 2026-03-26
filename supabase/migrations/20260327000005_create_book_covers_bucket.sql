-- Create the book-covers bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public access to view covers
DROP POLICY IF EXISTS "Public Access to Book Covers" ON storage.objects;
CREATE POLICY "Public Access to Book Covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

-- Policy: Allow authenticated staff/librarians/admins to upload
DROP POLICY IF EXISTS "Staff and Admins can upload book covers" ON storage.objects;
CREATE POLICY "Staff and Admins can upload book covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'book-covers' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'librarian', 'staff')
  )
);

-- Policy: Allow authenticated staff/librarians/admins to delete/update
DROP POLICY IF EXISTS "Staff and Admins can manage book covers" ON storage.objects;
CREATE POLICY "Staff and Admins can manage book covers"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'book-covers' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'librarian', 'staff')
  )
);
