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
    CREATE TYPE public."BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST');
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
    total_copies INTEGER NOT NULL DEFAULT 0,
    available_copies INTEGER NOT NULL DEFAULT 0,
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT books_total_copies_check CHECK (total_copies >= 0),
    CONSTRAINT books_available_copies_check CHECK (available_copies >= 0),
    CONSTRAINT books_available_lte_total_check CHECK (available_copies <= total_copies),
    CONSTRAINT books_published_year_check CHECK (published_year IS NULL OR (published_year >= -3000 AND published_year <= 2100))
);

-- Book Copies Table
CREATE TABLE IF NOT EXISTS public.book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
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
    role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
    student_id TEXT UNIQUE,
    department TEXT,
    phone TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text, 'GRADUATED'::text, 'DELETED'::text, 'ARCHIVED'::text])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{}'::jsonb
);

-- Library Cards Table
CREATE TABLE IF NOT EXISTS public.library_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'EXPIRED'::text, 'ARCHIVED'::text])),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT library_cards_dates_check CHECK (expires_at IS NULL OR expires_at > issued_at)
);

-- Borrowing Records Table
CREATE TABLE IF NOT EXISTS public.borrowing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL CONSTRAINT borrowing_records_user_id_fkey REFERENCES public.profiles(id) ON DELETE RESTRICT,
    book_copy_id UUID NOT NULL CONSTRAINT borrowing_records_book_copy_id_fkey REFERENCES public.book_copies(id) ON DELETE RESTRICT,
    processed_by UUID CONSTRAINT borrowing_records_processed_by_fkey REFERENCES public.profiles(id) ON DELETE SET NULL,
    borrowed_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    status public."BorrowStatus" DEFAULT 'ACTIVE'::public."BorrowStatus",
    returned_by UUID CONSTRAINT borrowing_records_returned_by_fkey REFERENCES public.profiles(id) ON DELETE SET NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    overdue_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT borrowing_records_due_date_check CHECK (due_date >= borrowed_at),
    CONSTRAINT borrowing_records_returned_at_check CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL CONSTRAINT reservations_user_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL CONSTRAINT reservations_book_id_fkey REFERENCES public.books(id) ON DELETE CASCADE,
    copy_id UUID CONSTRAINT reservations_copy_id_fkey REFERENCES public.book_copies(id) ON DELETE SET NULL,
    status public."ReservationStatus" DEFAULT 'ACTIVE'::public."ReservationStatus",
    queue_position INTEGER NOT NULL CHECK (queue_position > 0),
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    hold_expires_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT reservations_hold_dates_check CHECK (hold_expires_at IS NULL OR hold_expires_at >= reserved_at),
    CONSTRAINT reservations_fulfilled_dates_check CHECK (fulfilled_at IS NULL OR fulfilled_at >= reserved_at)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT DEFAULT 'string'::text CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID CONSTRAINT system_settings_updated_by_fkey REFERENCES public.profiles(id) ON DELETE SET NULL
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
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'SYSTEM'::text,
    priority TEXT DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in_at TIMESTAMPTZ DEFAULT NOW(),
    check_out_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT attendance_checkout_check CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

-- UI Preferences Table
CREATE TABLE IF NOT EXISTS public.ui_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);



-- 5. INDEXES & VECTOR OPTIMIZATIONS
-- Full-text search vector index
CREATE INDEX IF NOT EXISTS books_search_vector_idx ON public.books USING GIN(search_vector);

-- Super admin singleton partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS one_super_admin_idx ON public.profiles(role) WHERE (role = 'super_admin'::public.user_role);

-- Mandatory Foreign Key B-Tree Indexes (prevents sequential scans on joins and parent deletes)
CREATE INDEX IF NOT EXISTS books_category_id_idx ON public.books(category_id);
CREATE INDEX IF NOT EXISTS book_copies_book_id_idx ON public.book_copies(book_id);
CREATE INDEX IF NOT EXISTS borrowing_records_user_id_idx ON public.borrowing_records(user_id);
CREATE INDEX IF NOT EXISTS borrowing_records_book_copy_id_idx ON public.borrowing_records(book_copy_id);
CREATE INDEX IF NOT EXISTS borrowing_records_processed_by_idx ON public.borrowing_records(processed_by);
CREATE INDEX IF NOT EXISTS borrowing_records_returned_by_idx ON public.borrowing_records(returned_by);
CREATE INDEX IF NOT EXISTS reservations_user_id_idx ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS reservations_book_id_idx ON public.reservations(book_id);
CREATE INDEX IF NOT EXISTS reservations_copy_id_idx ON public.reservations(copy_id);
CREATE INDEX IF NOT EXISTS system_settings_updated_by_idx ON public.system_settings(updated_by);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS attendance_user_id_idx ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON public.audit_logs(admin_id);

-- High-Frequency Composite & Partial Indexes
CREATE INDEX IF NOT EXISTS borrowing_records_user_status_idx ON public.borrowing_records(user_id, status);
CREATE INDEX IF NOT EXISTS borrowing_records_user_borrowed_idx ON public.borrowing_records(user_id, borrowed_at DESC);
CREATE INDEX IF NOT EXISTS borrowing_records_due_active_idx ON public.borrowing_records(due_date) WHERE status = 'ACTIVE' AND reminder_sent = false;
CREATE INDEX IF NOT EXISTS borrowing_records_overdue_unnotified_idx ON public.borrowing_records(due_date) WHERE status IN ('ACTIVE', 'OVERDUE') AND overdue_notified = false;
CREATE INDEX IF NOT EXISTS reservations_queue_idx ON public.reservations(book_id, status, queue_position, created_at);
CREATE INDEX IF NOT EXISTS reservations_user_book_status_idx ON public.reservations(user_id, book_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_active_idx ON public.attendance(user_id) WHERE check_out_at IS NULL;
CREATE INDEX IF NOT EXISTS attendance_checkout_cron_idx ON public.attendance(check_in_at) WHERE check_out_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE is_read = false;

-- 6. TRIGGER & HELPER FUNCTIONS

-- Helper function to check if active actor is a staff role
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND status = 'ACTIVE'
    AND role IN ('super_admin', 'librarian', 'student_assistant')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- Active super_admin or librarian (is_staff() also includes student assistants).
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND status = 'ACTIVE'
    AND role IN ('super_admin', 'librarian')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, service_role;

-- Atomic transaction-safe ownership transfer function
CREATE OR REPLACE FUNCTION public.transfer_super_admin_ownership(p_current_admin_id uuid, p_new_admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
 AS $$
BEGIN
  -- Verify caller is service_role OR an authenticated super_admin whose UID matches p_current_admin_id
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> p_current_admin_id THEN
      RAISE EXCEPTION 'Unauthorized: Only the current super admin can transfer ownership.';
    END IF;
  END IF;

  -- Verify p_current_admin_id is indeed a super_admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_current_admin_id AND role = 'super_admin'::public.user_role) THEN
    RAISE EXCEPTION 'Current user is not the super admin';
  END IF;

  -- Verify p_new_admin_id exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_new_admin_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;

  -- 1. Demote current super admin to librarian first to avoid transient uniqueness violation
  UPDATE public.profiles
  SET role = 'librarian'::public.user_role
  WHERE id = p_current_admin_id;

  -- 2. Promote target user to super admin
  UPDATE public.profiles
  SET role = 'super_admin'::public.user_role
  WHERE id = p_new_admin_id;
END;
$$;


-- Auto student_id set based on email pattern matching
CREATE OR REPLACE FUNCTION public.auto_set_student_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
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

  -- Only school emails get an ID; anything else stays NULL (staff can set it manually).
  IF v_domain = 'sti.edu.ph' OR v_domain LIKE '%.sti.edu.ph' THEN
    -- Try to extract 6+ digit sequence (student number)
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];

    IF v_digit_match IS NOT NULL THEN
      -- Student: lastname.NUMBER@sti.edu.ph → STU-NUMBER
      v_student_id := 'STU-' || v_digit_match;
    ELSE
      -- Faculty/staff: no digit sequence → FAC-localpart
      v_student_id := 'FAC-' || v_local_part;
    END IF;
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
 SET search_path = public, pg_temp
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
 SET search_path = public, pg_temp
AS $$
BEGIN
  -- Close any open attendance records from previous days
  -- Setting checkout time to 5:00 PM (17:00:00) Asia/Manila time of that check-in day
  UPDATE public.attendance
  SET 
    check_out_at = ((check_in_at AT TIME ZONE 'Asia/Manila')::date + time '17:00:00') AT TIME ZONE 'Asia/Manila',
    notes = 'System auto-checkout: forgotten checkout'
  WHERE 
    check_out_at IS NULL 
    AND (check_in_at AT TIME ZONE 'Asia/Manila')::date < (NOW() AT TIME ZONE 'Asia/Manila')::date;
END;
$$;

-- Creates user profiles & library cards automatically upon auth registration
-- All newly registered staff or students default to student role and PENDING status
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  card_number_val TEXT;
BEGIN
  -- Only school accounts may sign up (@lumina.test is for the demo accounts)
  IF lower(COALESCE(new.email, '')) !~ '^[^@]+@(alabang\.sti\.edu\.ph|lumina\.test)$' THEN
    RAISE EXCEPTION 'Sign-up is limited to @alabang.sti.edu.ph accounts';
  END IF;

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

-- Prevents patron/student self-promotion or status/permission escalation
CREATE OR REPLACE FUNCTION public.fn_guard_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role public.user_role;
BEGIN
  -- The service role (server code, transfer_super_admin_ownership) and direct database sessions
  -- with no API JWT (SQL editor, cron) can update all fields. Checking current_user would not
  -- work here: in a SECURITY DEFINER trigger it is always the function owner.
  IF COALESCE((auth.jwt() ->> 'role'), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles
  WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE';

  -- There is only one super admin, so they must use the transfer flow instead
  IF OLD.id = (SELECT auth.uid()) AND OLD.role = 'super_admin'::public.user_role
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'The super admin cannot change their own role or status; transfer ownership instead';
  END IF;

  IF v_actor_role = 'super_admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Only the super admin may change roles or permissions, or edit the super admin's row
  IF OLD.role = 'super_admin'::public.user_role THEN
    RAISE EXCEPTION 'Only the super admin can edit a super admin profile';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role: only the super admin can change roles';
  END IF;

  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'Cannot modify permissions: only the super admin can change permissions';
  END IF;

  -- Librarians may also change status and student_id (approvals, corrections)
  IF v_actor_role = 'librarian'::public.user_role THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify status: unauthorized status escalation';
  END IF;

  -- Users cannot set or change their own student_id (it is set from the school email)
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Cannot modify student_id: it is assigned by the system or staff';
  END IF;

  RETURN NEW;
END;
$$;

-- 7. TABLE TRIGGERS
CREATE OR REPLACE TRIGGER trg_auto_student_id
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_student_id();

CREATE OR REPLACE TRIGGER tr_sync_book_counts
    AFTER INSERT OR UPDATE OF status, book_id OR DELETE ON public.book_copies
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_book_counts();

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER trg_guard_profile_updates
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profile_updates();

-- 8. ATOMIC SECURITY-DEFINER RPCs

-- Atomic reservation queue position compressor
CREATE OR REPLACE FUNCTION public.compress_reservation_queue(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
    WITH updated_queue AS (
        SELECT id, row_number() OVER (ORDER BY created_at ASC) as new_pos
        FROM public.reservations
        WHERE book_id = p_book_id AND status = 'ACTIVE'
    )
    UPDATE public.reservations r
    SET queue_position = u.new_pos, updated_at = NOW()
    FROM updated_queue u
    WHERE r.id = u.id AND r.queue_position IS DISTINCT FROM u.new_pos;
END;
$$;

-- Atomic transaction-safe release_copy procedure (M1)
CREATE OR REPLACE FUNCTION public.release_copy(p_copy_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_book_id          UUID;
  v_now              TIMESTAMPTZ := NOW();
  v_next_reservation RECORD;
  v_hold_days        INTEGER;
  v_hold_expires_at  TIMESTAMPTZ;
  v_student_name     TEXT;
BEGIN
  -- Lock the copy and read its book_id
  SELECT bc.book_id
  INTO v_book_id
  FROM public.book_copies bc
  WHERE bc.id = p_copy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'reservation_ready', false);
  END IF;

  -- Serialize queue changes per book
  PERFORM pg_advisory_xact_lock(hashtextextended(v_book_id::text, 0));

  -- Find the next ACTIVE reservation in line
  SELECT r.id, r.user_id
  INTO v_next_reservation
  FROM public.reservations r
  WHERE r.book_id = v_book_id
    AND r.status  = 'ACTIVE'
  ORDER BY r.queue_position ASC, r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3)
    INTO v_hold_days
    FROM public.system_settings
    WHERE key = 'hold_expiry_days';

    v_hold_days := GREATEST(COALESCE(v_hold_days, 3), 1);
    v_hold_expires_at := v_now + make_interval(days => v_hold_days);

    UPDATE public.reservations
    SET
      status          = 'READY',
      copy_id         = p_copy_id,
      fulfilled_at    = v_now,
      hold_expires_at = v_hold_expires_at,
      updated_at      = v_now
    WHERE id = v_next_reservation.id;

    UPDATE public.book_copies
    SET status = 'RESERVED', updated_at = v_now
    WHERE id = p_copy_id;

    PERFORM public.compress_reservation_queue(v_book_id);

    SELECT full_name INTO v_student_name
    FROM public.profiles
    WHERE id = v_next_reservation.user_id;

    RETURN jsonb_build_object(
      'ok',                true,
      'reservation_ready', true,
      'reservation_id',    v_next_reservation.id,
      'user_id',           v_next_reservation.user_id,
      'reserved_for',      COALESCE(v_student_name, 'Reserved Student'),
      'hold_expires_at',   v_hold_expires_at
    );
  ELSE
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = v_now
    WHERE id = p_copy_id;

    PERFORM public.compress_reservation_queue(v_book_id);

    RETURN jsonb_build_object(
      'ok',                true,
      'reservation_ready', false
    );
  END IF;
END;
$$;

-- Atomic transaction-safe reservation procedure
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(p_actor_id uuid, p_book_id uuid, p_target_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_exp_copy_id    UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
    v_actor_role     user_role;
    v_max_res        INTEGER;
BEGIN
    -- Authorization Enforcements:
    -- 1. Require authentication: anonymous callers are prohibited unless executed via service_role.
    IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
        IF (SELECT auth.uid()) IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Authentication required.');
        END IF;

        IF p_actor_id <> (SELECT auth.uid()) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Actor ID must match authenticated user.');
        END IF;
    END IF;

    -- 2. If reserving on behalf of another user, verify that p_actor_id has an active staff role.
    IF v_target_id <> p_actor_id THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id AND status = 'ACTIVE';
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'student_assistant') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF UPPER(COALESCE(v_profile_status, '')) <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Only active accounts can reserve books.');
    END IF;

    -- Lock the user, then the book, so the per-user hold count below can't race
    PERFORM pg_advisory_xact_lock(hashtextextended(v_target_id::text, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    -- Expire old READY reservations and hand their copies to the next person in line (or AVAILABLE)
    FOR v_exp_copy_id IN
        UPDATE public.reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE book_id = p_book_id
          AND status = 'READY'
          AND hold_expires_at < NOW()
        RETURNING copy_id
    LOOP
        IF v_exp_copy_id IS NOT NULL THEN
            PERFORM public.release_copy(v_exp_copy_id);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3) INTO v_max_res
    FROM public.system_settings WHERE key = 'max_reservations_per_student';

    IF (SELECT COUNT(*) FROM public.reservations
        WHERE user_id = v_target_id AND status IN ('ACTIVE', 'READY')) >= COALESCE(v_max_res, 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_LIMIT', 'message', 'Reservation limit reached.');
    END IF;

    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';

        v_hold_days := GREATEST(COALESCE(v_hold_days, 3), 1);
        v_expiry := NOW() + make_interval(days => v_hold_days);

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

-- Earliest due date among a book's current loans. Returns only the date, so students
-- can see when a copy comes back without reading other people's loan rows.
CREATE OR REPLACE FUNCTION public.get_next_due_date(p_book_id uuid)
 RETURNS timestamptz
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
  SELECT MIN(br.due_date)
  FROM public.borrowing_records br
  JOIN public.book_copies bc ON bc.id = br.book_copy_id
  WHERE bc.book_id = p_book_id AND br.status IN ('ACTIVE', 'OVERDUE');
$$;

-- Atomic transaction-safe QR checkout procedure
CREATE OR REPLACE FUNCTION public.process_qr_checkout(p_librarian_id uuid, p_card_qr text, p_book_qr text, p_idempotency_key text DEFAULT NULL::text, p_preview_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
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

  -- Serialize checkouts per student so two desks can't both pass the limit check
  PERFORM pg_advisory_xact_lock(hashtextextended(v_card.user_id::text, 0));

  -- Check current loan count (overdue loans still count)
  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status IN ('ACTIVE', 'OVERDUE');

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.book_id, bc.status, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE OF bc;

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
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_copy              RECORD;
  v_borrow            RECORD;
  v_existing          JSONB;
  v_release           JSONB;
  v_result            JSONB;
  v_now               TIMESTAMPTZ := NOW();
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
  FOR UPDATE OF bc;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  -- Find the active borrowing record
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
        'student_name', COALESCE(v_borrow.full_name, 'Student'),
        'borrowed_at',  v_borrow.borrowed_at,
        'due_date',     v_borrow.due_date
      );
    END IF;

    -- Mark borrow record as returned
    UPDATE public.borrowing_records
    SET status = 'RETURNED', returned_at = v_now, updated_at = v_now
    WHERE id = v_borrow.id;
  END IF;

  -- Release copy to the next queued reservation or mark AVAILABLE
  v_release := public.release_copy(v_copy.id);

  IF COALESCE((v_release ->> 'reservation_ready')::boolean, false) THEN
    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', true,
      'reserved_for',      COALESCE(v_release ->> 'reserved_for', 'Reserved Student')
    );
  ELSE
    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
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

-- M8: Annual student reset in one atomic statement (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.annual_student_reset()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE' AND role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can run annual reset';
    END IF;
  END IF;

  WITH updated_profiles AS (
    UPDATE public.profiles
    SET status = 'SUSPENDED', updated_at = NOW()
    WHERE role = 'student'
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM updated_profiles;

  UPDATE public.library_cards lc
  SET status = 'SUSPENDED', updated_at = NOW()
  FROM public.profiles p
  WHERE lc.user_id = p.id
    AND p.role = 'student';

  RETURN v_count;
END;
$$;

-- M8 & M9: Analytics summary aggregated in SQL in Asia/Manila time (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_range text DEFAULT '30d')
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_now_local         timestamp := NOW() AT TIME ZONE 'Asia/Manila';
  v_group             text;
  v_start_local       timestamp;
  v_end_local         timestamp;
  v_step              interval;
  v_fmt               text;
  v_start_timestamptz timestamptz;
  v_attendance_trends jsonb;
  v_borrowing_trends  jsonb;
  v_peak_hours        jsonb;
  v_category_dist     jsonb;
  v_popular_books     jsonb;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  IF p_range = '7d' THEN
    v_group       := 'day';
    v_start_local := date_trunc('day', v_now_local) - interval '6 days';
    v_end_local   := date_trunc('day', v_now_local);
    v_step        := interval '1 day';
    v_fmt         := 'Mon DD';
  ELSIF p_range = '1y' THEN
    v_group       := 'month';
    v_start_local := date_trunc('month', v_now_local - interval '364 days');
    v_end_local   := date_trunc('month', v_now_local);
    v_step        := interval '1 month';
    v_fmt         := 'Mon YYYY';
  ELSE
    v_group       := 'day';
    v_start_local := date_trunc('day', v_now_local) - interval '29 days';
    v_end_local   := date_trunc('day', v_now_local);
    v_step        := interval '1 day';
    v_fmt         := 'Mon DD';
  END IF;

  v_start_timestamptz := v_start_local AT TIME ZONE 'Asia/Manila';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_attendance_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, check_in_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.attendance
    WHERE check_in_at >= v_start_timestamptz
    GROUP BY 1
  ) c ON c.bucket = s.bucket;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_borrowing_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, borrowed_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.borrowing_records
    WHERE borrowed_at >= v_start_timestamptz
    GROUP BY 1
  ) c ON c.bucket = s.bucket;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hour', CASE
        WHEN h.hr = 12 THEN '12 PM'
        WHEN h.hr > 12 THEN (h.hr - 12)::text || ' PM'
        ELSE h.hr::text || ' AM'
      END,
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY h.hr
  ), '[]'::jsonb)
  INTO v_peak_hours
  FROM generate_series(8, 18) AS h(hr)
  LEFT JOIN (
    SELECT EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Manila'))::int AS hr,
           count(*)::int AS cnt
    FROM public.attendance
    WHERE check_in_at >= v_start_timestamptz
      AND EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Manila'))::int BETWEEN 8 AND 18
    GROUP BY 1
  ) c ON c.hr = h.hr;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('name', cat_name, 'value', cnt)
    ORDER BY cnt DESC, cat_name ASC
  ), '[]'::jsonb)
  INTO v_category_dist
  FROM (
    SELECT COALESCE(cat.name, 'General') AS cat_name,
           count(*)::int AS cnt
    FROM public.borrowing_records br
    LEFT JOIN public.book_copies bc ON bc.id = br.book_copy_id
    LEFT JOIN public.books b ON b.id = bc.book_id
    LEFT JOIN public.categories cat ON cat.id = b.category_id
    WHERE br.borrowed_at >= v_start_timestamptz
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', book_id, 'title', title, 'count', cnt)
    ORDER BY cnt DESC, title ASC
  ), '[]'::jsonb)
  INTO v_popular_books
  FROM (
    SELECT b.id AS book_id,
           b.title,
           count(*)::int AS cnt
    FROM public.borrowing_records br
    JOIN public.book_copies bc ON bc.id = br.book_copy_id
    JOIN public.books b ON b.id = bc.book_id
    WHERE br.borrowed_at >= v_start_timestamptz
    GROUP BY b.id, b.title
    ORDER BY cnt DESC, b.title ASC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'attendanceTrends', v_attendance_trends,
    'borrowingTrends', v_borrowing_trends,
    'categoryDistribution', v_category_dist,
    'peakHours', v_peak_hours,
    'popularBooks', v_popular_books
  );
END;
$$;

-- M8: Bulk notifications via INSERT ... SELECT (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.send_bulk_notifications_by_target(
  p_target text,
  p_title text,
  p_content text,
  p_type text DEFAULT 'SYSTEM',
  p_priority text DEFAULT 'high',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    SELECT
      p.id,
      p_title,
      p_content,
      COALESCE(p_type, 'SYSTEM'),
      COALESCE(p_priority, 'high'),
      COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    WHERE p_target = 'all'
       OR (p_target = 'students' AND p.role = 'student')
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

-- M23: Bulk re-activate selected users and their library cards
CREATE OR REPLACE FUNCTION public.reactivate_users_bulk(p_user_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role public.user_role;
  v_count       integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin or librarian can reactivate users';
    END IF;
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = (SELECT auth.uid());
  ELSE
    v_caller_role := 'super_admin'::public.user_role;
  END IF;

  IF p_user_ids IS NULL OR coalesce(array_length(p_user_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  -- Cards follow only the profiles this call re-activated (librarians: students only).
  WITH updated AS (
    UPDATE public.profiles
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE id = ANY(p_user_ids)
      AND (v_caller_role = 'super_admin'::public.user_role OR role = 'student'::public.user_role)
    RETURNING id
  ), cards AS (
    UPDATE public.library_cards
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE user_id IN (SELECT id FROM updated)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_preferences ENABLE ROW LEVEL SECURITY;

-- 10. CONSOLIDATED RLS POLICIES

-- attendance Policies (recorded by staff only; no self check-in/out)
CREATE POLICY "Staff can insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can view all attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- audit_logs Policies
CREATE POLICY "Staff can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- book_copies Policies
CREATE POLICY "Librarians can delete book_copies" ON public.book_copies
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)));

-- Writes are librarian/super_admin only; student assistants go through the circulation RPCs
CREATE POLICY "Librarians can insert book_copies" ON public.book_copies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY "Book copies are viewable by everyone" ON public.book_copies
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Librarians can update book_copies" ON public.book_copies
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- books Policies
CREATE POLICY "Librarians can delete books" ON public.books
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)));

CREATE POLICY "Staff can insert books" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Active books are viewable by everyone" ON public.books
  FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Staff can view all books" ON public.books
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can update books" ON public.books
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- borrowing_records Policies
CREATE POLICY "Librarians can insert borrowing records" ON public.borrowing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY "Staff can view all borrowing records" ON public.borrowing_records
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can view own borrowing records" ON public.borrowing_records
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Librarians can update borrowing records" ON public.borrowing_records
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- categories Policies
CREATE POLICY "Librarians can delete categories" ON public.categories
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)));

CREATE POLICY "Staff can insert categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Staff can update categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- checkout_idempotency Policies
CREATE POLICY "Staff can manage checkout idempotency" ON public.checkout_idempotency
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- library_cards Policies
CREATE POLICY "Users can view own library card" ON public.library_cards
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can view all library cards" ON public.library_cards
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- notifications Policies
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- profiles Policies
CREATE POLICY "Users can view own profile, staff can view all" ON public.profiles
  FOR SELECT TO authenticated
  -- No sub-select here: the update policies below query profiles, which would make it policy recursion
  USING (id = auth.uid() OR public.is_staff());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    AND permissions IS NOT DISTINCT FROM (SELECT p.permissions FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)
    )
  );

-- reservations Policies
CREATE POLICY "Users can view own reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can view all reservations" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Librarians can manage reservations" ON public.reservations
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- return_idempotency Policies
CREATE POLICY "Staff can manage return idempotency" ON public.return_idempotency
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- system_settings Policies
CREATE POLICY "System settings are viewable by everyone" ON public.system_settings
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)
    )
  );

-- ui_preferences Policies
CREATE POLICY "Users can insert own preferences" ON public.ui_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own preferences" ON public.ui_preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences" ON public.ui_preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own preferences" ON public.ui_preferences
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 11. SENSITIVE PRIVILEGE REVOCATIONS (REST/CLIENT-SIDE PROTECTION)
REVOKE EXECUTE ON FUNCTION public.process_qr_checkout(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_qr_return(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compress_reservation_queue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_checkout_forgotten_attendance() FROM PUBLIC, anon, authenticated;

-- Trigger functions revoked from direct execution
REVOKE EXECUTE ON FUNCTION public.auto_set_student_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_book_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_guard_profile_updates() FROM PUBLIC, anon, authenticated;

-- Administrative RPCs revoked from public/anon
REVOKE EXECUTE ON FUNCTION public.transfer_super_admin_ownership(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_super_admin_ownership(uuid, uuid) TO service_role;

-- Reservation RPC revoked from public/anon, granted to authenticated
REVOKE EXECUTE ON FUNCTION public.create_reservation_atomic(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_next_due_date(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_due_date(uuid) TO authenticated, service_role;

-- No role check inside: only the server (service role) and other SECURITY DEFINER functions call it.
REVOKE EXECUTE ON FUNCTION public.release_copy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_copy(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.annual_student_reset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annual_student_reset() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_analytics_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text, text, text, text, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reactivate_users_bulk(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_users_bulk(uuid[]) TO authenticated, service_role;

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
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  -- Private: the QR images are the library cards; the app serves them with signed URLs.
  ('library-cards', 'library-cards', false, 10000000, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('book-covers', 'book-covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Avatar Policies
CREATE POLICY "Avatar User Insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid())::text)));

CREATE POLICY "Avatar User Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid())::text)))
  WITH CHECK ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid())::text)));

CREATE POLICY "Avatar User Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid())::text)));

-- Book Cover Policies (Restricted to Staff)
CREATE POLICY "Staff insert book covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers'::text AND public.is_staff());

CREATE POLICY "Staff update book covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'book-covers'::text AND public.is_staff())
  WITH CHECK (bucket_id = 'book-covers'::text AND public.is_staff());

CREATE POLICY "Staff delete book covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers'::text AND public.is_staff());

-- Public Read access for public buckets (library-cards excluded to protect student PII)
CREATE POLICY "Public Read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('avatars', 'book-covers'));

-- Library Cards Privacy Policy (Only staff or card owner can view)
CREATE POLICY "Authorized view library cards" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'library-cards'::text AND (
      public.is_staff() OR
      (storage.foldername(name))[1] = ((SELECT auth.uid())::text) OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid())
        AND (
          name LIKE '%' || UPPER(REPLACE(student_id, '-', '_')) || '%' OR
          name LIKE '%' || UPPER(student_id) || '%' OR
          name LIKE '%' || ((SELECT auth.uid())::text) || '%'
        )
      )
    )
  );

-- Staff manage library cards in storage
CREATE POLICY "Staff manage library card assets" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'library-cards'::text AND public.is_staff())
  WITH CHECK (bucket_id = 'library-cards'::text AND public.is_staff());


-- 5. Enable Supabase Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_copies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.borrowing_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;



-- 6. RPC: High-Performance Unified Borrowing History & Timeline Search
CREATE OR REPLACE FUNCTION public.get_borrowing_history_v2(
  p_user_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  book_copy_id uuid,
  user_id uuid,
  status public."BorrowStatus",
  borrowed_at timestamptz,
  due_date timestamptz,
  returned_at timestamptz,
  book_id uuid,
  book_title text,
  book_author text,
  book_cover_url text,
  book_isbn text,
  copy_qr text,
  copy_accession text,
  profile_id uuid,
  profile_name text,
  profile_email text,
  profile_student_id text,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_norm_status public."BorrowStatus" := NULL;
BEGIN
  -- Restrict unauthorized/patron access to their own records only
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF (SELECT auth.uid()) IS NULL THEN
      RETURN;
    END IF;
    IF NOT public.is_staff() THEN
      p_user_id := (SELECT auth.uid());
    END IF;
  END IF;

  IF p_status IS NOT NULL AND p_status != 'all' AND p_status != '' THEN
    BEGIN
      v_norm_status := UPPER(p_status)::public."BorrowStatus";
    EXCEPTION WHEN OTHERS THEN
      v_norm_status := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT 
      br.id,
      br.book_copy_id,
      br.user_id,
      br.status,
      br.borrowed_at,
      br.due_date,
      br.returned_at,
      b.id AS book_id,
      b.title AS book_title,
      b.author AS book_author,
      b.cover_url AS book_cover_url,
      b.isbn AS book_isbn,
      bc.qr_string AS copy_qr,
      bc.accession_number AS copy_accession,
      p.id AS profile_id,
      p.full_name AS profile_name,
      p.email AS profile_email,
      p.student_id AS profile_student_id
    FROM borrowing_records br
    JOIN book_copies bc ON br.book_copy_id = bc.id
    JOIN books b ON bc.book_id = b.id
    LEFT JOIN profiles p ON br.user_id = p.id
    WHERE (p_user_id IS NULL OR br.user_id = p_user_id)
      AND (v_norm_status IS NULL OR br.status = v_norm_status)
      AND (
        p_search IS NULL OR p_search = '' OR (
          -- Borrower
          p.full_name ILIKE '%' || p_search || '%'
          OR p.student_id ILIKE '%' || p_search || '%'
          OR p.email ILIKE '%' || p_search || '%'
          -- Book
          OR b.title ILIKE '%' || p_search || '%'
          OR b.author ILIKE '%' || p_search || '%'
          OR b.isbn ILIKE '%' || p_search || '%'
          -- Copy / Barcode
          OR bc.qr_string ILIKE '%' || p_search || '%'
          OR bc.accession_number ILIKE '%' || p_search || '%'
          -- Status
          OR br.status::text ILIKE '%' || p_search || '%'
          -- Timeline: Borrowed (Local & UTC, full month & short month)
          OR to_char(br.borrowed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          OR to_char(br.borrowed_at, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          -- Timeline: Due Date (Local & UTC)
          OR to_char(br.due_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          OR to_char(br.due_date, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          -- Timeline: Returned Date (Local & UTC)
          OR (br.returned_at IS NOT NULL AND (
            to_char(br.returned_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
            OR to_char(br.returned_at, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          ))
        )
      )
  )
  SELECT 
    f.id,
    f.book_copy_id,
    f.user_id,
    f.status,
    f.borrowed_at,
    f.due_date,
    f.returned_at,
    f.book_id,
    f.book_title,
    f.book_author,
    f.book_cover_url,
    f.book_isbn,
    f.copy_qr,
    f.copy_accession,
    f.profile_id,
    f.profile_name,
    f.profile_email,
    f.profile_student_id,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.borrowed_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text) TO authenticated, service_role;

-- Ranked book search ("Best match"). See migrations/20261106120000_search_book_ids_ranked.sql.
CREATE OR REPLACE FUNCTION public.search_book_ids(
  p_query text,
  p_status text DEFAULT 'ACTIVE',
  p_category_ids uuid[] DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_available_only boolean DEFAULT false,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
 RETURNS TABLE(id uuid, total_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT
      lower(btrim(coalesce(p_query, ''))) AS raw,
      replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') AS esc,
      regexp_replace(lower(btrim(coalesce(p_query, ''))), '[^0-9a-z]', '', 'g') AS isbn_key
  ),
  words AS (
    SELECT w
    FROM q, regexp_split_to_table(regexp_replace(q.raw, '[^[:alnum:][:space:]]', ' ', 'g'), '\s+') AS w
    WHERE w <> ''
  ),
  tsq AS (
    SELECT CASE
             WHEN length((SELECT raw FROM q)) >= 3 AND EXISTS (SELECT 1 FROM words)
             THEN to_tsquery('english', (SELECT string_agg(w || ':*', ' & ') FROM words))
           END AS v
  ),
  matched AS (
    SELECT
      b.id,
      b.title,
      CASE
        WHEN q.isbn_key <> '' AND regexp_replace(lower(coalesce(b.isbn, '')), '[^0-9a-z]', '', 'g') = q.isbn_key THEN 0
        WHEN lower(b.title) = q.raw THEN 1
        WHEN lower(b.title) LIKE q.esc || '%' THEN 2
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.title, '')) @@ tsq.v)
          OR lower(b.title) LIKE '%' || q.esc || '%' THEN 3
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.author, '')) @@ tsq.v)
          OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%' THEN 4
        ELSE 5
      END AS tier,
      CASE WHEN tsq.v IS NOT NULL THEN ts_rank_cd(b.search_vector, tsq.v) ELSE 0 END AS score
    FROM public.books b, q, tsq
    WHERE q.raw <> ''
      AND (
        CASE
          WHEN length(q.raw) < 3 THEN lower(b.title) LIKE '%' || q.esc || '%'
          ELSE (tsq.v IS NOT NULL AND b.search_vector @@ tsq.v)
            OR lower(b.title) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.isbn, '')) LIKE '%' || q.esc || '%'
        END
      )
      AND (p_status = 'ALL'
           OR (p_status = 'ARCHIVED' AND b.is_active = false)
           OR (coalesce(p_status, 'ACTIVE') = 'ACTIVE' AND b.is_active = true))
      AND (p_category_ids IS NULL OR cardinality(p_category_ids) = 0 OR b.category_id = ANY (p_category_ids))
      AND (p_section IS NULL OR p_section = '' OR b.section = p_section)
      AND (NOT coalesce(p_available_only, false) OR b.available_copies > 0)
  )
  SELECT m.id, count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.tier, m.score DESC, lower(m.title), m.id
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.search_book_ids(text, text, uuid[], text, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_book_ids(text, text, uuid[], text, boolean, integer, integer) TO anon, authenticated, service_role;
