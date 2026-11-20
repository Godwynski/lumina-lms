-- LUMINA LMS: SAMPLE DATA SEED
-- This file contains mock data for development and testing.

-- 1. CATEGORIES (Synchronized with scripts/seed.ts slug conventions)
INSERT INTO public.categories (name, slug, description) VALUES
('Computer Science', 'computer-science', 'Books about algorithms, programming, and systems.'),
('Mathematics', 'mathematics', 'Calculus, linear algebra, and discrete math.'),
('Literature & Fiction', 'literature-fiction', 'Classic novels, poetry, plays, and modern fictional works.')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. BOOKS & COPIES (Idempotent seed execution)
DO $$ 
DECLARE
    v_cs_id UUID := (SELECT id FROM public.categories WHERE slug = 'computer-science');
    v_math_id UUID := (SELECT id FROM public.categories WHERE slug = 'mathematics');
    v_fic_id UUID := (SELECT id FROM public.categories WHERE slug = 'literature-fiction');
    v_book_id UUID;
BEGIN
    -- Book 1
    SELECT id INTO v_book_id FROM public.books WHERE isbn = '9780262033848' LIMIT 1;
    IF v_book_id IS NULL THEN
        INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
        VALUES ('Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', v_cs_id, 3, 2)
        RETURNING id INTO v_book_id;
    END IF;
    
    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-ALGO-001', 'BORROWED'),
        (v_book_id, 'QR-ALGO-002', 'AVAILABLE'),
        (v_book_id, 'QR-ALGO-003', 'AVAILABLE')
        ON CONFLICT (qr_string) DO NOTHING;
    END IF;

    -- Book 2
    SELECT id INTO v_book_id FROM public.books WHERE isbn = '9780132350884' LIMIT 1;
    IF v_book_id IS NULL THEN
        INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
        VALUES ('Clean Code', 'Robert C. Martin', '9780132350884', v_cs_id, 2, 1)
        RETURNING id INTO v_book_id;
    END IF;

    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-CODE-001', 'AVAILABLE'),
        (v_book_id, 'QR-CODE-002', 'RESERVED')
        ON CONFLICT (qr_string) DO NOTHING;
    END IF;

    -- Book 3
    SELECT id INTO v_book_id FROM public.books WHERE isbn = '9788126515196' LIMIT 1;
    IF v_book_id IS NULL THEN
        INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
        VALUES ('Calculus Vol 1', 'Tom M. Apostol', '9788126515196', v_math_id, 1, 1)
        RETURNING id INTO v_book_id;
    END IF;

    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-MATH-001', 'AVAILABLE')
        ON CONFLICT (qr_string) DO NOTHING;
    END IF;
END $$;
