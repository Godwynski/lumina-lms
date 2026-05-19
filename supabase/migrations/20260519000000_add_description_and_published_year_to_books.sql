-- Add description and published_year columns to public.books
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS published_year INTEGER;
