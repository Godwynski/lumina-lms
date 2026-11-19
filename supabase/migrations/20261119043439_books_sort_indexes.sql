-- The ID tiebreaker follows the primary sort direction, so these B-tree
-- indexes can serve each order through a forward or backward scan.
CREATE INDEX IF NOT EXISTS books_title_id_idx ON public.books (title, id);
CREATE INDEX IF NOT EXISTS books_author_id_idx ON public.books (author, id);
CREATE INDEX IF NOT EXISTS books_available_copies_id_idx ON public.books (available_copies, id);
CREATE INDEX IF NOT EXISTS books_created_at_id_idx ON public.books (created_at, id);
