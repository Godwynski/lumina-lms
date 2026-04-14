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

-- 3. USERS (Profiles)
-- NOTE: These require corresponding auth.users in a real system.
-- For local/mock SQL, we insert into public.profiles directly.
INSERT INTO public.profiles (id, email, full_name, role, student_id, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@lumina.test', 'System Admin', 'admin', 'ADM-001', 'ACTIVE'),
('00000000-0000-0000-0000-000000000002', 'librarian@lumina.test', 'Jane Librarian', 'librarian', 'LIB-001', 'ACTIVE'),
('00000000-0000-0000-0000-000000000003', 'alice@lumina.test', 'Alice Student', 'student', 'STUD-001', 'ACTIVE'),
('00000000-0000-0000-0000-000000000004', 'bob@lumina.test', 'Bob Student', 'student', 'STUD-002', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 4. CARDS
INSERT INTO public.library_cards (user_id, card_number, status) VALUES
('00000000-0000-0000-0000-000000000003', 'CARD-ALICE-123', 'active'),
('00000000-0000-0000-0000-000000000004', 'CARD-BOB-456', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- 5. INITIAL TRANSACTIONS
DO $$
DECLARE
    v_alice_id UUID := '00000000-0000-0000-0000-000000000003';
    v_bob_id   UUID := '00000000-0000-0000-0000-000000000004';
    v_copy_id  UUID;
    v_book_id  UUID;
BEGIN
    -- Alice borrows Algorithms Copy 1
    v_copy_id := (SELECT id FROM public.book_copies WHERE qr_string = 'QR-ALGO-001');
    IF v_copy_id IS NOT NULL THEN
        INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status)
        VALUES (v_alice_id, v_copy_id, NOW() + interval '14 days', 'ACTIVE');
    END IF;

    -- Bob reserves "Clean Code"
    v_book_id := (SELECT id FROM public.books WHERE title = 'Clean Code');
    v_copy_id := (SELECT id FROM public.book_copies WHERE qr_string = 'QR-CODE-002');
    IF v_book_id IS NOT NULL THEN
        INSERT INTO public.reservations (user_id, book_id, copy_id, status, queue_position, hold_expires_at)
        VALUES (v_bob_id, v_book_id, v_copy_id, 'READY', 1, NOW() + interval '3 days');
    END IF;
END $$;
