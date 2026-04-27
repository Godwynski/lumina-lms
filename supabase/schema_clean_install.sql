-- LUMINA LMS: CLEAN INSTALL SCHEMA
-- Version: 1.1 (Bug Fix Edition)
-- This file contains the complete database structure, excluding sample data.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. CUSTOM TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'librarian', 'staff', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. TABLES

-- Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'student',
    student_id TEXT UNIQUE,
    department TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'DELETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Library Cards
CREATE TABLE IF NOT EXISTS public.library_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'expired')),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    cover_url TEXT,
    tags TEXT[] DEFAULT '{}',
    location TEXT,
    section TEXT,
    total_copies INTEGER DEFAULT 0,
    available_copies INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(isbn, '')), 'C')
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book Copies
CREATE TABLE IF NOT EXISTS public.book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
    qr_string TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED')),
    condition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Borrowing Records
CREATE TABLE IF NOT EXISTS public.borrowing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    book_copy_id UUID REFERENCES public.book_copies(id) NOT NULL,
    processed_by UUID REFERENCES public.profiles(id),
    borrowed_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    status "BorrowStatus" DEFAULT 'ACTIVE',
    renewal_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    book_id UUID REFERENCES public.books(id) NOT NULL,
    copy_id UUID REFERENCES public.book_copies(id),
    status "ReservationStatus" DEFAULT 'ACTIVE',
    queue_position INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    hold_expires_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);



-- System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT DEFAULT 'string',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID, -- NULL means system automated
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency Tables
CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATOMIC RPCs & CORE LOGIC

-- Helper to reorder reservation queue positions for a book
CREATE OR REPLACE FUNCTION public.compress_reservation_queue(p_book_id UUID)
RETURNS VOID AS $$
BEGIN
    WITH reorder AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position ASC, created_at ASC) as new_pos
        FROM public.reservations
        WHERE book_id = p_book_id AND status = 'ACTIVE'
    )
    UPDATE public.reservations r
    SET queue_position = reorder.new_pos
    FROM reorder
    WHERE r.id = reorder.id;
END;
$$ LANGUAGE plpgsql;

-- UNIFIED ATOMIC RESERVATION
-- If an AVAILABLE copy exists → READY immediately (copy → RESERVED, hold timer starts).
-- If no copies available → ACTIVE queue (promoted when a copy is returned).
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_actor_id UUID,
    p_book_id UUID,
    p_target_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
BEGIN
    -- 1. Authorization: block suspended accounts
    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF v_profile_status = 'SUSPENDED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUSPENDED', 'message', 'User account is suspended.');
    END IF;

    -- 2. Serialize queue operations with an advisory lock on this book
    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    -- 3. Reject duplicates
    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    -- 4. Try to find an AVAILABLE copy to assign immediately
    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        -- Fast path: copy available → READY immediately
        SELECT COALESCE(value::INTEGER, 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';

        v_expiry := NOW() + make_interval(days => v_hold_days);

        UPDATE public.book_copies SET status = 'RESERVED', updated_at = NOW() WHERE id = v_copy_id;

        INSERT INTO public.reservations (user_id, book_id, copy_id, queue_position, status, hold_expires_at)
        VALUES (v_target_id, p_book_id, v_copy_id, 1, 'READY', v_expiry)
        RETURNING id INTO v_res_id;

        RETURN jsonb_build_object(
            'ok', true, 'reservation_id', v_res_id,
            'status', 'READY', 'copy_id', v_copy_id, 'hold_expires_at', v_expiry
        );
    ELSE
        -- Slow path: no copies available → join queue
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_queue_pos
        FROM public.reservations WHERE book_id = p_book_id AND status = 'ACTIVE';

        INSERT INTO public.reservations (user_id, book_id, queue_position, status)
        VALUES (v_target_id, p_book_id, v_queue_pos, 'ACTIVE')
        RETURNING id INTO v_res_id;

        RETURN jsonb_build_object(
            'ok', true, 'reservation_id', v_res_id,
            'status', 'ACTIVE', 'queue_position', v_queue_pos
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- UNIFIED ATOMIC CHECKOUT
CREATE OR REPLACE FUNCTION public.process_qr_checkout(
    p_card_qr TEXT,
    p_book_qr TEXT,
    p_librarian_id UUID,
    p_idempotency_key TEXT DEFAULT NULL,
    p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_card RECORD;
    v_copy RECORD;
    v_limit INTEGER;
    v_days INTEGER;
    v_active_count INTEGER;
    v_due_date TIMESTAMPTZ;
    v_res RECORD;
BEGIN
    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response INTO v_res FROM public.checkout_idempotency WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN RETURN v_res; END IF;
    END IF;

    -- 2. Resolve Profile & Card
    SELECT lc.*, p.full_name, p.status as profile_status INTO v_card
    FROM public.library_cards lc JOIN public.profiles p ON p.id = lc.user_id
    WHERE lc.card_number = p_card_qr;

    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_FOUND', 'message', 'Invalid library card.'); END IF;
    IF v_card.status <> 'active' OR v_card.profile_status <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'This card or account is not active.');
    END IF;

    -- 3. Policy Validation
    SELECT 
        COALESCE((SELECT value::INTEGER FROM public.system_settings WHERE key = 'max_borrow_limit'), 5),
        COALESCE((SELECT value::INTEGER FROM public.system_settings WHERE key = 'loan_period_days'), 14)
    INTO v_limit, v_days;

    SELECT COUNT(*) INTO v_active_count FROM public.borrowing_records WHERE user_id = v_card.user_id AND status = 'ACTIVE';
    IF v_active_count >= v_limit THEN
        RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
    END IF;

    -- 4. Locate & Lock Book Copy
    SELECT bc.*, b.title INTO v_copy
    FROM public.book_copies bc JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.'); END IF;

    -- Check if it belongs to a READY reservation
    IF v_copy.status = 'RESERVED' THEN
        SELECT id INTO v_res FROM public.reservations 
        WHERE copy_id = v_copy.id AND user_id = v_card.user_id AND status = 'READY';
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is reserved for another student.');
        END IF;
    ELSIF v_copy.status <> 'AVAILABLE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is not currently available.');
    END IF;

    v_due_date := NOW() + make_interval(days => v_days);

    IF p_preview_only THEN
        RETURN jsonb_build_object('ok', true, 'preview', true, 'student_name', v_card.full_name, 'book_title', v_copy.title, 'due_date', v_due_date);
    END IF;

    -- 5. Commit Checkout
    UPDATE public.book_copies SET status = 'BORROWED', updated_at = NOW() WHERE id = v_copy.id;
    INSERT INTO public.borrowing_records (user_id, book_copy_id, processed_by, due_date, status)
    VALUES (v_card.user_id, v_copy.id, p_librarian_id, v_due_date, 'ACTIVE');

    -- Fulfill reservation if picker was the hold-owner
    UPDATE public.reservations SET status = 'FULFILLED', fulfilled_at = NOW() 
    WHERE copy_id = v_copy.id AND user_id = v_card.user_id AND status = 'READY';

    v_res := jsonb_build_object('ok', true, 'student_name', v_card.full_name, 'book_title', v_copy.title, 'due_date', v_due_date);
    
    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.checkout_idempotency (idempotency_key, response) VALUES (p_idempotency_key, v_res);
    END IF;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql;

-- UNIFIED ATOMIC RETURN
CREATE OR REPLACE FUNCTION public.process_qr_return(
    p_book_qr TEXT,
    p_librarian_id UUID,
    p_idempotency_key TEXT DEFAULT NULL,
    p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_copy RECORD;
    v_borrow RECORD;
    v_next_res RECORD;
    v_res JSONB;
    v_hold_days INTEGER;
BEGIN
    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response INTO v_res FROM public.return_idempotency WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN RETURN v_res; END IF;
    END IF;

    -- 2. Locate Copy & Borrow Record
    SELECT bc.*, b.title INTO v_copy
    FROM public.book_copies bc JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Invalid book QR.'); END IF;

    SELECT br.*, p.full_name INTO v_borrow
    FROM public.borrowing_records br JOIN public.profiles p ON p.id = br.user_id
    WHERE br.book_copy_id = v_copy.id AND br.status IN ('ACTIVE', 'OVERDUE')
    LIMIT 1 FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'Copy is not currently on loan.'); END IF;

    IF p_preview_only THEN
        RETURN jsonb_build_object('ok', true, 'preview', true, 'book_title', v_copy.title, 'student_name', v_borrow.full_name);
    END IF;

    -- 3. Close Loan
    UPDATE public.borrowing_records SET status = 'RETURNED', returned_at = NOW() WHERE id = v_borrow.id;

    -- 4. Check Reservations (Promotion)
    SELECT * INTO v_next_res FROM public.reservations 
    WHERE book_id = v_copy.book_id AND status = 'ACTIVE' 
    ORDER BY queue_position ASC, created_at ASC LIMIT 1 FOR UPDATE;

    IF FOUND THEN
        SELECT COALESCE(value::INTEGER, 7) INTO v_hold_days FROM public.system_settings WHERE key = 'hold_expiry_days';
        
        UPDATE public.reservations SET 
            status = 'READY', 
            copy_id = v_copy.id, 
            hold_expires_at = NOW() + make_interval(days => v_hold_days)
        WHERE id = v_next_res.id;

        UPDATE public.book_copies SET status = 'RESERVED' WHERE id = v_copy.id;
        v_res := jsonb_build_object('ok', true, 'book_title', v_copy.title, 'reservation_ready', true);
    ELSE
        UPDATE public.book_copies SET status = 'AVAILABLE' WHERE id = v_copy.id;
        v_res := jsonb_build_object('ok', true, 'book_title', v_copy.title, 'reservation_ready', false);
    END IF;

    -- 5. Finalize
    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.return_idempotency (idempotency_key, response) VALUES (p_idempotency_key, v_res);
    END IF;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql;


-- 5. DEFAULT SETTINGS SEED
INSERT INTO public.system_settings (key, value, description) VALUES
('max_borrow_limit', '5', 'Max books a student can borrow at once'),
('loan_period_days', '14', 'Standard loan duration in days'),
('hold_expiry_days', '3', 'Days a student has to pick up a reserved book')
ON CONFLICT (key) DO NOTHING;
