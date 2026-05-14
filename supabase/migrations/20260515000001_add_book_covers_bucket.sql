-- Migration to create the "book-covers" storage bucket and its policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow public viewing of book covers
CREATE POLICY "Book Covers Public View"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'book-covers' );

-- Policy to allow authenticated users to upload/update/delete book covers
-- The Next.js API route (/api/upload) already handles role-based authorization
CREATE POLICY "Book Covers Authenticated Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'book-covers' );

CREATE POLICY "Book Covers Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'book-covers' )
WITH CHECK ( bucket_id = 'book-covers' );

CREATE POLICY "Book Covers Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'book-covers' );
