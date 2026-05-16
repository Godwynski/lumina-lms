-- LUMINA LMS: SAMPLE DATA SEED
-- This file contains mock data for development and testing.

-- 1. CATEGORIES
INSERT INTO public.categories (name, slug, description) VALUES
('Computer Science', 'computer-science', 'Books about algorithms, programming, and systems.'),
('Mathematics', 'mathematics', 'Calculus, linear algebra, and discrete math.'),
('Fiction', 'fiction', 'Classic and contemporary literature.')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- 2. BOOKS
DO $$ 
DECLARE
    v_cs_id UUID := (SELECT id FROM public.categories WHERE slug = 'computer-science');
    v_math_id UUID := (SELECT id FROM public.categories WHERE slug = 'mathematics');
    v_fic_id UUID := (SELECT id FROM public.categories WHERE slug = 'fiction');
    v_book_id UUID;
BEGIN
    -- Book 1
    INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
    VALUES ('Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', v_cs_id, 3, 2)
    ON CONFLICT DO NOTHING RETURNING id INTO v_book_id;
    
    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-ALGO-001', 'BORROWED'),
        (v_book_id, 'QR-ALGO-002', 'AVAILABLE'),
        (v_book_id, 'QR-ALGO-003', 'AVAILABLE');
    END IF;

    -- Book 2
    INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
    VALUES ('Clean Code', 'Robert C. Martin', '9780132350884', v_cs_id, 2, 1)
    ON CONFLICT DO NOTHING RETURNING id INTO v_book_id;

    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-CODE-001', 'AVAILABLE'),
        (v_book_id, 'QR-CODE-002', 'RESERVED');
    END IF;

    -- Book 3
    INSERT INTO public.books (title, author, isbn, category_id, total_copies, available_copies)
    VALUES ('Calculus Vol 1', 'Tom M. Apostol', '9788126515196', v_math_id, 1, 1)
    ON CONFLICT DO NOTHING RETURNING id INTO v_book_id;

    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.book_copies (book_id, qr_string, status) VALUES
        (v_book_id, 'QR-MATH-001', 'AVAILABLE');
    END IF;
END $$;


