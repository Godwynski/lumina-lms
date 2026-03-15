-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable array_to_string for search_vector generation
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(arr TEXT[], sep TEXT)
RETURNS TEXT AS $$
  SELECT array_to_string(arr, sep);
$$ LANGUAGE SQL IMMUTABLE;

-- Create books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  location VARCHAR(255),
  section VARCHAR(255),
  available_copies INT NOT NULL DEFAULT 0,
  total_copies INT NOT NULL DEFAULT 0,
  cover_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(isbn, '')), 'C') ||
    setweight(to_tsvector('english', public.immutable_array_to_string(tags, ' ')), 'D')
  ) STORED
);

-- Index for full-text search
CREATE INDEX idx_books_search ON public.books USING GIN (search_vector);

-- Sequence for physical QR codes
CREATE SEQUENCE public.book_copy_qr_seq;

-- Create book_copies table
CREATE TABLE public.book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  qr_string VARCHAR(50) UNIQUE DEFAULT 'QR-' || nextval('public.book_copy_qr_seq'),
  status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST')),
  condition VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function and Trigger for availability calculation
CREATE OR REPLACE FUNCTION public.update_available_copies()
RETURNS TRIGGER AS $$
DECLARE
  target_book_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_book_id := OLD.book_id;
  ELSE
    target_book_id := NEW.book_id;
  END IF;

  UPDATE public.books
  SET 
    available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = target_book_id AND status = 'AVAILABLE'),
    total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = target_book_id)
  WHERE id = target_book_id;
  
  -- If book_id was changed in an UPDATE, also update the old book_id
  IF TG_OP = 'UPDATE' AND OLD.book_id != NEW.book_id THEN
    UPDATE public.books
    SET 
      available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND status = 'AVAILABLE'),
      total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id)
    WHERE id = OLD.book_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_available_copies
AFTER INSERT OR UPDATE OR DELETE ON public.book_copies
FOR EACH ROW
EXECUTE FUNCTION public.update_available_copies();

-- Add RLS Policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access to books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Allow public read access to book_copies" ON public.book_copies FOR SELECT USING (true);

-- Allow authenticated users all rights for now
CREATE POLICY "Allow authenticated full access to categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to books" ON public.books FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to book_copies" ON public.book_copies FOR ALL TO authenticated USING (true) WITH CHECK (true);
