-- Drop the existing unique constraint
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_isbn_key;

-- Create a partial unique index that only applies to active books
-- This allows multiple soft-deleted records with the same ISBN but only one active one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_isbn_active ON public.books (isbn) WHERE (is_active = true AND isbn IS NOT NULL);
