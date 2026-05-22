-- LUMINA LMS: CLEAN INSTALL SCHEMA
-- Version: 1.2 (Unified Production-Grade Edition)
-- This file contains the complete database structure, excluding sample data.
-- Setup is ordered strictly to resolve topological dependencies, RLS constraints, and execution requirements.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. CUSTOM TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('super_admin', 'librarian', 'student', 'student_assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public."BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public."ReservationStatus" AS ENUM ('ACTIVE', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.book_copy_qr_seq START WITH 10000;
CREATE SEQUENCE IF NOT EXISTS public.book_accession_seq START WITH 1;

-- 4. TABLES (IN TOPO-DEPENDENT ORDER)

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books Table
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    cover_url TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    location TEXT,
    section TEXT,
    total_copies INTEGER DEFAULT 0,
    available_copies INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    dewey_decimal TEXT,
    description TEXT,
    published_year INTEGER,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(isbn, '')), 'C')
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book Copies Table
CREATE TABLE IF NOT EXISTS public.book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
    qr_string TEXT UNIQUE NOT NULL DEFAULT ('QR-'::text || nextval('public.book_copy_qr_seq'::regclass)),
    status TEXT DEFAULT 'AVAILABLE'::text CHECK (status = ANY (ARRAY['AVAILABLE'::text, 'BORROWED'::text, 'MAINTENANCE'::text, 'LOST'::text, 'RESERVED'::text])),
    condition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    accession_number TEXT UNIQUE DEFAULT ('ACC-'::text || lpad((nextval('public.book_accession_seq'::regclass))::text, 5, '0'::text))
);

-- Profiles Table (Referencing auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role public.user_role DEFAULT 'student'::public.user_role,
    student_id TEXT UNIQUE,
    department TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text, 'GRADUATED'::text, 'DELETED'::text, 'ARCHIVED'::text])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{}'::jsonb
);

-- Library Cards Table
CREATE TABLE IF NOT EXISTS public.library_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'EXPIRED'::text, 'ARCHIVED'::text])),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Borrowing Records Table
CREATE TABLE IF NOT EXISTS public.borrowing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    book_copy_id UUID REFERENCES public.book_copies(id) NOT NULL,
    processed_by UUID REFERENCES public.profiles(id),
    borrowed_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    status public."BorrowStatus" DEFAULT 'ACTIVE'::public."BorrowStatus",
    returned_by UUID REFERENCES public.profiles(id),
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    book_id UUID REFERENCES public.books(id) NOT NULL,
    copy_id UUID REFERENCES public.book_copies(id),
    status public."ReservationStatus" DEFAULT 'ACTIVE'::public."ReservationStatus",
    queue_position INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    hold_expires_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT DEFAULT 'string'::text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb
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

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'SYSTEM'::text,
    priority TEXT DEFAULT 'medium'::text,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in_at TIMESTAMPTZ DEFAULT NOW(),
    check_out_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UI Preferences Table
CREATE TABLE IF NOT EXISTS public.ui_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
    is_active BOOLEAN DEFAULT TRUE,
    target_role public.user_role,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);


-- Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id),
    user_id UUID REFERENCES auth.users(id),
    notes TEXT,
    status TEXT DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'resolved'::text, 'dismissed'::text])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deleted Profiles Archive Table
CREATE TABLE IF NOT EXISTS public.deleted_profile_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_profile_id UUID UNIQUE REFERENCES public.profiles(id),
    anonymized_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deletion_reason TEXT,
    retained_borrow_count INTEGER DEFAULT 0 NOT NULL
);

-- Rate Limit Log Table
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    action_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 5. INDEXES & VECTOR OPTIMIZATIONS
CREATE INDEX IF NOT EXISTS books_search_vector_idx ON public.books USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS book_copies_qr_idx ON public.book_copies(qr_string);
CREATE INDEX IF NOT EXISTS profiles_student_id_idx ON public.profiles(student_id);

-- 6. TRIGGER & HELPER FUNCTIONS

-- Helper function to check if active actor is a staff role
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'librarian', 'student_assistant')
  );
END;
$$;

-- Auto student_id set based on email pattern matching
CREATE OR REPLACE FUNCTION public.auto_set_student_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_local_part TEXT;
  v_digit_match TEXT;
  v_student_id TEXT;
  v_domain TEXT;
BEGIN
  -- Only act if student_id is not already set
  IF NEW.student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Parse email parts
  v_local_part := lower(split_part(COALESCE(NEW.email, ''), '@', 1));
  v_domain     := lower(split_part(COALESCE(NEW.email, ''), '@', 2));

  IF v_local_part = '' THEN
    RETURN NEW;
  END IF;

  -- STI Alabang domain: alabang.sti.edu.ph
  IF v_domain ILIKE '%sti.edu.ph%' THEN
    -- Try to extract 6+ digit sequence (student number)
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];

    IF v_digit_match IS NOT NULL THEN
      -- Student: lastname.NUMBER@sti.edu.ph → STU-NUMBER
      v_student_id := 'STU-' || v_digit_match;
    ELSE
      -- Faculty/staff: no digit sequence → FAC-localpart
      v_student_id := 'FAC-' || v_local_part;
    END IF;
  ELSE
    -- Non-STI domain: try digits anyway (e.g. external students)
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];
    IF v_digit_match IS NOT NULL THEN
      v_student_id := 'STU-' || v_digit_match;
    END IF;
    -- Otherwise leave student_id NULL (admin/librarian can set manually)
  END IF;

  -- Sanitize and assign
  IF v_student_id IS NOT NULL THEN
    NEW.student_id := upper(regexp_replace(v_student_id, '[^A-Z0-9._\-]', '_', 'g'));
  END IF;

  RETURN NEW;
END;
$$;

-- Keeps books total_copies and available_copies counts dynamically updated
CREATE OR REPLACE FUNCTION public.fn_sync_book_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.books
        SET 
            total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id),
            available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND status = 'AVAILABLE'),
            updated_at = NOW()
        WHERE id = OLD.book_id;
    ELSE
        UPDATE public.books
        SET 
            total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = NEW.book_id),
            available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = NEW.book_id AND status = 'AVAILABLE'),
            updated_at = NOW()
        WHERE id = NEW.book_id;
        
        IF (TG_OP = 'UPDATE' AND OLD.book_id <> NEW.book_id) THEN
            UPDATE public.books
            SET 
                total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id),
                available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND status = 'AVAILABLE'),
                updated_at = NOW()
            WHERE id = OLD.book_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- Closes any open attendance records from previous days automatically
CREATE OR REPLACE FUNCTION public.auto_checkout_forgotten_attendance()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Close any open attendance records from previous days
  -- Setting checkout time to 5:00 PM (17:00:00) of that check-in day
  UPDATE public.attendance
  SET 
    check_out_at = (check_in_at::date + time '17:00:00')::timestamptz,
    notes = 'System auto-checkout: forgotten checkout'
  WHERE 
    check_out_at IS NULL 
    AND check_in_at < CURRENT_DATE;
END;
$$;

-- Creates user profiles & library cards automatically upon auth registration
-- All newly registered staff or students default to student role and PENDING status
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  card_number_val TEXT;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, avatar_url, email, status, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    'PENDING',
    'student'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

  -- Create library card with PENDING status
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '100 years')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- 7. TABLE TRIGGERS
CREATE OR REPLACE TRIGGER trg_auto_student_id
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_student_id();

CREATE OR REPLACE TRIGGER tr_sync_book_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.book_copies
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_book_counts();

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ATOMIC SECURITY-DEFINER RPCs

-- Atomic reservation queue position compressor
CREATE OR REPLACE FUNCTION public.compress_reservation_queue(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    WITH updated_queue AS (
        SELECT id, row_number() OVER (ORDER BY created_at ASC) as new_pos
        FROM reservations
        WHERE book_id = p_book_id AND status = 'ACTIVE'
    )
    UPDATE reservations r
    SET queue_position = u.new_pos, updated_at = NOW()
    FROM updated_queue u
    WHERE r.id = u.id AND r.queue_position IS DISTINCT FROM u.new_pos;
END;
$$;

-- Atomic transaction-safe reservation procedure
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(p_actor_id uuid, p_book_id uuid, p_target_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
    v_actor_role     user_role;
BEGIN
    -- Authorization Enforcements:
    -- 1. Enforce that if auth.uid() is not null (invoked from authenticated client),
    --    the p_actor_id must match auth.uid().
    IF auth.uid() IS NOT NULL AND p_actor_id <> auth.uid() THEN
        RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Actor ID must match authenticated user.');
    END IF;

    -- 2. If reserving on behalf of another user, verify that p_actor_id has a staff role.
    IF v_target_id <> p_actor_id THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'student_assistant') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF v_profile_status = 'SUSPENDED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUSPENDED', 'message', 'User account is suspended.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    -- Expire old READY reservations
    WITH expired_holds AS (
        UPDATE public.reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE book_id = p_book_id 
          AND status = 'READY' 
          AND hold_expires_at < NOW()
        RETURNING copy_id
    )
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = NOW()
    WHERE id IN (SELECT copy_id FROM expired_holds);

    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';
        
        v_expiry := NOW() + (v_hold_days || ' days')::interval;
        
        UPDATE public.book_copies SET status = 'RESERVED', updated_at = NOW() WHERE id = v_copy_id;
        
        INSERT INTO public.reservations (user_id, book_id, copy_id, queue_position, status, hold_expires_at)
        VALUES (v_target_id, p_book_id, v_copy_id, 1, 'READY', v_expiry)
        RETURNING id INTO v_res_id;
        
        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'READY', 'copy_id', v_copy_id, 'hold_expires_at', v_expiry);
    ELSE
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_queue_pos
        FROM public.reservations WHERE book_id = p_book_id AND status = 'ACTIVE';
        
        INSERT INTO public.reservations (user_id, book_id, queue_position, status)
        VALUES (v_target_id, p_book_id, v_queue_pos, 'ACTIVE')
        RETURNING id INTO v_res_id;
        
        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'ACTIVE', 'queue_position', v_queue_pos);
    END IF;
END;
$$;

-- Atomic transaction-safe QR checkout procedure
CREATE OR REPLACE FUNCTION public.process_qr_checkout(p_librarian_id uuid, p_card_qr text, p_book_qr text, p_idempotency_key text DEFAULT NULL::text, p_preview_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_card              RECORD;
  v_copy              RECORD;
  v_active_borrows    INTEGER := 0;
  v_max_borrow_limit  INTEGER;
  v_loan_days         INTEGER;
  v_due_date          TIMESTAMPTZ;
  v_borrowing_id      UUID;
  v_existing          JSONB;
  v_result            JSONB;
  v_res_id            UUID := NULL;
BEGIN
  -- Idempotency check
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Resolve student card → profile
  SELECT lc.user_id, lc.card_number, lc.status as card_status, p.full_name, p.student_id, p.status as profile_status
  INTO v_card
  FROM public.library_cards lc
  JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_FOUND', 'message', 'Library card not found.');
  END IF;

  -- Use UPPER() for case-insensitive status check
  IF UPPER(v_card.card_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_INACTIVE', 'message', 'Library card is not active.');
  END IF;

  -- Check if the profile (account) itself is active
  IF UPPER(v_card.profile_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Student account is not active.');
  END IF;

  -- Read policy settings from system_settings
  SELECT
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit'      THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days'      THEN value::INTEGER END), 14)
  INTO v_max_borrow_limit, v_loan_days
  FROM public.system_settings
  WHERE key IN ('max_borrow_limit', 'loan_period_days');

  -- Check active borrow count
  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status = 'ACTIVE';

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.book_id, bc.status, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  -- Handle RESERVED copies
  IF v_copy.status = 'RESERVED' THEN
    SELECT r.id
    INTO v_res_id
    FROM public.reservations r
    WHERE r.copy_id   = v_copy.id
      AND r.user_id   = v_card.user_id
      AND r.status    = 'READY'
    LIMIT 1;

    IF v_res_id IS NULL THEN
      -- Reserved for someone else
      RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is reserved for another student.');
    END IF;
  ELSIF v_copy.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is not available for checkout.');
  END IF;

  v_due_date := NOW() + make_interval(days => v_loan_days);

  -- Preview mode: return info without committing
  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true, 'preview', true,
      'student_name', v_card.full_name,
      'book_title',   v_copy.title,
      'due_date',     v_due_date
    );
  END IF;

  -- Commit: mark copy as BORROWED, create borrowing record
  UPDATE public.book_copies
  SET status = 'BORROWED', updated_at = NOW()
  WHERE id = v_copy.id;

  INSERT INTO public.borrowing_records (user_id, book_copy_id, processed_by, borrowed_at, due_date, status)
  VALUES (v_card.user_id, v_copy.id, p_librarian_id, NOW(), v_due_date, 'ACTIVE')
  RETURNING id INTO v_borrowing_id;

  -- Fulfill reservation if applicable
  IF v_res_id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'FULFILLED', updated_at = NOW()
    WHERE id = v_res_id;
  END IF;

  v_result := jsonb_build_object(
    'ok',           true,
    'borrowing_id', v_borrowing_id,
    'student_name', v_card.full_name,
    'book_title',   v_copy.title,
    'due_date',     v_due_date
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.checkout_idempotency
      (idempotency_key, response)
    VALUES
      (p_idempotency_key, v_result)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- Atomic transaction-safe QR return procedure
CREATE OR REPLACE FUNCTION public.process_qr_return(p_librarian_id uuid, p_book_qr text, p_idempotency_key text DEFAULT NULL::text, p_preview_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_copy              RECORD;
  v_borrow            RECORD;
  v_existing          JSONB;
  v_result            JSONB;
  v_now               TIMESTAMPTZ := NOW();
  v_next_reservation  RECORD;
  v_hold_expiry_days  INTEGER := 7;
  v_hold_expires_at   TIMESTAMPTZ;
  v_student_name      TEXT;
BEGIN
  -- Idempotency check
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.status, bc.book_id, bc.qr_string, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  -- Find the active borrowing record
  -- Fix: Specify "FOR UPDATE OF br" to avoid locking the nullable side of the LEFT JOIN
  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, p.full_name
  INTO v_borrow
  FROM public.borrowing_records br
  LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id AND br.status IN ('ACTIVE', 'OVERDUE')
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE OF br;

  IF NOT FOUND THEN
    IF v_copy.status = 'BORROWED' THEN
      -- Auto-recover orphaned copy state
      IF p_preview_only THEN
        RETURN jsonb_build_object(
          'ok', true, 'preview', true,
          'book_title',   v_copy.title,
          'student_name', 'System Recovery (No Record)'
        );
      END IF;
      -- No record to update, skip updating borrowing_records
    ELSE
      IF v_copy.status = 'AVAILABLE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'This book copy is already Available.');
      ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'This book copy is not borrowed (Status: ' || v_copy.status || ').');
      END IF;
    END IF;
  ELSE
    -- Preview mode
    IF p_preview_only THEN
      RETURN jsonb_build_object(
        'ok', true, 'preview', true,
        'book_title',   v_copy.title,
        'student_name', COALESCE(v_borrow.full_name, 'Student')
      );
    END IF;

    -- Mark borrow record as returned
    UPDATE public.borrowing_records
    SET status = 'RETURNED', returned_at = v_now, updated_at = v_now
    WHERE id = v_borrow.id;
  END IF;

  -- Atomically check for next queued reservation for this book
  SELECT r.id, r.user_id
  INTO v_next_reservation
  FROM public.reservations r
  WHERE r.book_id = v_copy.book_id
    AND r.status  = 'ACTIVE'
  ORDER BY r.queue_position ASC, r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Promote the next reservation to READY and assign this copy
    SELECT COALESCE(NULLIF(value, '')::INTEGER, 7)
    INTO v_hold_expiry_days
    FROM public.system_settings
    WHERE key = 'hold_expiry_days'
    LIMIT 1;

    v_hold_expires_at := v_now + make_interval(days => GREATEST(v_hold_expiry_days, 1));

    UPDATE public.reservations
    SET
      status         = 'READY',
      copy_id        = v_copy.id,
      fulfilled_at   = v_now,
      hold_expires_at = v_hold_expires_at,
      updated_at     = v_now
    WHERE id = v_next_reservation.id;

    -- Mark copy as RESERVED for the next student
    UPDATE public.book_copies
    SET status = 'RESERVED', updated_at = v_now
    WHERE id = v_copy.id;

    -- Fetch name for the librarian notification
    SELECT full_name INTO v_student_name
    FROM public.profiles
    WHERE id = v_next_reservation.user_id;

    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', true,
      'reserved_for',      COALESCE(v_student_name, 'Reserved Student')
    );
  ELSE
    -- No one waiting — release copy to AVAILABLE
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = v_now
    WHERE id = v_copy.id;

    v_result := jsonb_build_object(
      'ok',           true,
      'book_title',   v_copy.title,
      'returned_at',  v_now,
      'student_name', COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', false
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency
      (idempotency_key, response)
    VALUES
      (p_idempotency_key, v_result)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_profile_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_preferences ENABLE ROW LEVEL SECURITY;

-- 10. CONSOLIDATED RLS POLICIES

-- announcements Policies
CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::public.user_role, 'librarian'::public.user_role])));

CREATE POLICY "Announcements are viewable by everyone" ON public.announcements
  FOR SELECT TO public
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()) AND (starts_at IS NULL OR starts_at <= now()));

-- attendance Policies
CREATE POLICY "Users can self check-in" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::public.user_role, 'librarian'::public.user_role, 'staff'::public.user_role, 'student_assistant'::public.user_role])));

CREATE POLICY "Staff can view all attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::public.user_role, 'librarian'::public.user_role, 'staff'::public.user_role, 'student_assistant'::public.user_role])));

CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::public.user_role, 'librarian'::public.user_role, 'staff'::public.user_role, 'student_assistant'::public.user_role])));

CREATE POLICY "Users can self check-out" ON public.attendance
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- audit_logs Policies
CREATE POLICY "Staff can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- book_copies Policies
CREATE POLICY "Staff can delete book_copies" ON public.book_copies
  FOR DELETE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Staff can insert book_copies" ON public.book_copies
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Book copies are viewable by everyone" ON public.book_copies
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Staff can update book_copies" ON public.book_copies
  FOR UPDATE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

-- books Policies
CREATE POLICY "Staff can delete books" ON public.books
  FOR DELETE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Staff can insert books" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Books are viewable by everyone" ON public.books
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Staff can update books" ON public.books
  FOR UPDATE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

-- borrowing_records Policies
CREATE POLICY "Staff can insert borrowing records" ON public.borrowing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can view all borrowing records" ON public.borrowing_records
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can view own borrowing records" ON public.borrowing_records
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can update borrowing records" ON public.borrowing_records
  FOR UPDATE TO authenticated
  USING (public.is_staff());

-- categories Policies
CREATE POLICY "Staff can delete categories" ON public.categories
  FOR DELETE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Staff can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Staff can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING ((SELECT (profiles.role)::text FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['super_admin'::text, 'librarian'::text, 'student_assistant'::text]));

-- checkout_idempotency Policies
CREATE POLICY "Staff can manage checkout idempotency" ON public.checkout_idempotency
  FOR ALL TO authenticated
  USING (public.is_staff());

-- deleted_profile_info Policies
CREATE POLICY "Staff can view deleted profile info" ON public.deleted_profile_info
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- library_cards Policies
CREATE POLICY "Users can view own library card" ON public.library_cards
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can view all library cards" ON public.library_cards
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::public.user_role, 'librarian'::public.user_role, 'staff'::public.user_role, 'student_assistant'::public.user_role])));

-- notifications Policies
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

-- rate_limit_log Policies
CREATE POLICY "Staff can view rate limit logs" ON public.rate_limit_log
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- reports Policies
CREATE POLICY "Staff can manage reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can view all reports" ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- reservations Policies
CREATE POLICY "Staff can manage reservations" ON public.reservations
  FOR ALL TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can view own reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can view all reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- return_idempotency Policies
CREATE POLICY "Staff can manage return idempotency" ON public.return_idempotency
  FOR ALL TO authenticated
  USING (public.is_staff());

-- system_settings Policies
CREATE POLICY "Staff can manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_staff());

CREATE POLICY "System settings are viewable by everyone" ON public.system_settings
  FOR SELECT TO public
  USING (true);

-- ui_preferences Policies
CREATE POLICY "Users can insert own preferences" ON public.ui_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own preferences" ON public.ui_preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences" ON public.ui_preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 11. SENSITIVE PRIVILEGE REVOCATIONS (REST/CLIENT-SIDE PROTECTION)
REVOKE EXECUTE ON FUNCTION public.process_qr_checkout(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_qr_return(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compress_reservation_queue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_checkout_forgotten_attendance() FROM PUBLIC, anon, authenticated;

-- 12. DEFAULT SYSTEM SETTINGS SEED VALUES
INSERT INTO public.system_settings (key, value, description, data_type) VALUES
('max_borrow_limit', '5', 'Max books a student can borrow at once', 'number'),
('loan_period_days', '14', 'Standard borrowing duration in days', 'number'),
('hold_expiry_days', '3', 'Days a student has to pick up a reserved book', 'number')
ON CONFLICT (key) DO NOTHING;


-- 13. STORAGE BUCKETS CONFIGURATION & STORAGE POLICIES
-- Setup default storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, null, null),
  ('library-cards', 'library-cards', true, 10000000, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('book-covers', 'book-covers', true, null, null)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Avatar Policies
CREATE POLICY "Avatar User Insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY "Avatar User Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
  WITH CHECK ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY "Avatar User Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

-- Book Cover Policies
CREATE POLICY "Book Covers Authenticated Insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers'::text);

CREATE POLICY "Book Covers Authenticated Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'book-covers'::text)
  WITH CHECK (bucket_id = 'book-covers'::text);

CREATE POLICY "Book Covers Authenticated Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers'::text);

-- Public Read access for public buckets
CREATE POLICY "Public Read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('avatars', 'book-covers', 'library-cards'));


-- =========================================================================
-- CHECKLIST & OPTIMIZED NOTES FOR DEV SANDBOX
-- =========================================================================

-- 1. Create table for dropdown options
CREATE TABLE IF NOT EXISTS public.checklist_dropdown_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'user_role' or 'module'
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (type, value)
);

-- 2. Create table for checklist items
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem TEXT NOT NULL,
    explanation TEXT,
    user_role TEXT,
    module TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.checklist_dropdown_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- 4. Add permissive public policies (No Auth required)
CREATE POLICY "Allow public read" ON public.checklist_dropdown_options FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.checklist_dropdown_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.checklist_dropdown_options FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.checklist_dropdown_options FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.checklist_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.checklist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.checklist_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.checklist_items FOR DELETE USING (true);

-- 5. Enable Supabase Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_dropdown_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;

