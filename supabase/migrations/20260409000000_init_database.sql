-- Migration: 20260311140031_create_profiles_table.sql
-- Create a secure schema for auth operations if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Define user roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'librarian', 'staff', 'student');
  END IF;
END
$$;

-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
  updated_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  avatar_url TEXT
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies

-- 1. Profiles are viewable by everyone in the system (or you could restrict this)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

-- 2. Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile EXCEPT the role
-- We need to make sure regular users can't elevate their own role
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    (
      -- If they are trying to change their role, it must remain what it currently is
      -- unless they are an admin (handled by a separate policy)
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 4. Admins have full access to all profiles
DROP POLICY IF EXISTS "Admins have full access." ON public.profiles;
CREATE POLICY "Admins have full access." ON public.profiles
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role 
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
  );

-- Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Migration: 20260315144244_module3_catalog.sql
-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
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
CREATE TABLE IF NOT EXISTS public.books (
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
CREATE INDEX IF NOT EXISTS idx_books_search ON public.books USING GIN (search_vector);

-- Sequence for physical QR codes
CREATE SEQUENCE public.book_copy_qr_seq;

-- Create book_copies table
CREATE TABLE IF NOT EXISTS public.book_copies (
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

DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
CREATE POLICY "Allow public read access to categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access to books" ON public.books;
CREATE POLICY "Allow public read access to books" ON public.books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access to book_copies" ON public.book_copies;
CREATE POLICY "Allow public read access to book_copies" ON public.book_copies FOR SELECT USING (true);

-- Allow authenticated users all rights for now
DROP POLICY IF EXISTS "Allow authenticated full access to categories" ON public.categories;
CREATE POLICY "Allow authenticated full access to categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated full access to books" ON public.books;
CREATE POLICY "Allow authenticated full access to books" ON public.books FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated full access to book_copies" ON public.book_copies;
CREATE POLICY "Allow authenticated full access to book_copies" ON public.book_copies FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- Migration: 20260316000000_offline_pin_protocol.sql
-- Create offline_pins table
CREATE TABLE IF NOT EXISTS public.offline_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Create offline_sessions table
CREATE TABLE IF NOT EXISTS public.offline_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for pin lookups
CREATE INDEX IF NOT EXISTS idx_offline_pins_user_id ON public.offline_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_token ON public.offline_sessions(session_token);


-- Migration: 20260316110000_qr_checkout_flow.sql
CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  librarian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  book_qr TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_idempotency_created_at
  ON public.checkout_idempotency(created_at DESC);

CREATE OR REPLACE FUNCTION public.process_qr_checkout(
  p_librarian_id UUID,
  p_card_qr TEXT,
  p_book_qr TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_copy RECORD;
  v_active_borrows INTEGER := 0;
  v_max_borrow_limit INTEGER := 5;
  v_loan_days INTEGER := 14;
  v_fine_threshold NUMERIC := 100;
  v_outstanding_fines NUMERIC := 0;
  v_due_date TIMESTAMPTZ;
  v_borrowing_id UUID;
  v_existing JSONB;
  v_result JSONB;
BEGIN
  IF p_librarian_id IS NULL OR p_card_qr IS NULL OR p_book_qr IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required checkout fields.'
    );
  END IF;

  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  SELECT
    lc.user_id,
    lc.card_number,
    lc.status,
    p.full_name,
    p.student_id
  INTO v_card
  FROM public.library_cards lc
  JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CARD_NOT_FOUND',
      'message', 'Student card was not recognized.'
    );
  END IF;

  IF LOWER(v_card.status) <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CARD_INACTIVE',
      'message', 'Student card is not active.'
    );
  END IF;

  IF to_regclass('public.settings') IS NOT NULL THEN
    SELECT
      COALESCE(MAX(CASE WHEN key IN ('max_borrow_limit', 'borrow_limit') THEN NULLIF(value, '')::INTEGER END), 5),
      COALESCE(MAX(CASE WHEN key IN ('loan_period_days', 'borrow_days') THEN NULLIF(value, '')::INTEGER END), 14),
      COALESCE(MAX(CASE WHEN key IN ('max_outstanding_fines', 'fine_threshold') THEN NULLIF(value, '')::NUMERIC END), 100)
    INTO v_max_borrow_limit, v_loan_days, v_fine_threshold
    FROM public.settings;
  END IF;

  IF to_regclass('public.borrowing_records') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_active_borrows
    FROM public.borrowing_records
    WHERE user_id = v_card.user_id
      AND status = 'active';
  END IF;

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_EXCEEDED',
      'message', 'Student has reached the maximum borrow limit.'
    );
  END IF;

  IF to_regclass('public.fines') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        SELECT COALESCE(SUM(amount), 0)
        FROM public.fines
        WHERE user_id = $1
          AND status IN (''unpaid'', ''open'')
      '
      INTO v_outstanding_fines
      USING v_card.user_id;
    EXCEPTION
      WHEN undefined_column THEN
        v_outstanding_fines := 0;
    END;
  END IF;

  IF v_outstanding_fines > v_fine_threshold THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FINE_THRESHOLD_EXCEEDED',
      'message', 'Student has fines above the allowed threshold.'
    );
  END IF;

  BEGIN
    SELECT
      bc.id,
      bc.book_id,
      bc.status,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COPY_LOCKED',
        'message', 'This book copy was just checked out by another session.'
      );
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  IF UPPER(v_copy.status) <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_UNAVAILABLE',
      'message', 'This book copy is no longer available.'
    );
  END IF;

  v_due_date := NOW() + make_interval(days => GREATEST(v_loan_days, 1));

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'student_name', COALESCE(v_card.full_name, 'Student'),
      'student_id', COALESCE(v_card.student_id, 'N/A'),
      'book_title', v_copy.title,
      'book_qr', p_book_qr,
      'card_number', v_card.card_number,
      'due_date', v_due_date
    );
  END IF;

  UPDATE public.book_copies
  SET status = 'BORROWED', updated_at = NOW()
  WHERE id = v_copy.id;

  INSERT INTO public.borrowing_records (
    user_id,
    book_copy_id,
    processed_by,
    borrowed_at,
    due_date,
    status,
    renewal_count
  ) VALUES (
    v_card.user_id,
    v_copy.id,
    p_librarian_id,
    NOW(),
    v_due_date,
    'active',
    0
  )
  RETURNING id INTO v_borrowing_id;

  v_result := jsonb_build_object(
    'ok', true,
    'preview', false,
    'borrowing_id', v_borrowing_id,
    'student_name', COALESCE(v_card.full_name, 'Student'),
    'student_id', COALESCE(v_card.student_id, 'N/A'),
    'book_title', v_copy.title,
    'book_qr', p_book_qr,
    'card_number', v_card.card_number,
    'due_date', v_due_date
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.checkout_idempotency (
      idempotency_key,
      librarian_id,
      card_number,
      book_qr,
      response
    ) VALUES (
      p_idempotency_key,
      p_librarian_id,
      v_card.card_number,
      p_book_qr,
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;


-- Migration: 20260316123000_create_borrowing_records.sql
CREATE TABLE IF NOT EXISTS public.borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  renewal_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrowing_records_user_status
  ON public.borrowing_records(user_id, status);

CREATE INDEX IF NOT EXISTS idx_borrowing_records_copy_status
  ON public.borrowing_records(book_copy_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_records_active_copy
  ON public.borrowing_records(book_copy_id)
  WHERE status = 'active';

ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'borrowing_records'
      AND policyname = 'Allow authenticated full access to borrowing_records'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated full access to borrowing_records" ON public.borrowing_records;
CREATE POLICY "Allow authenticated full access to borrowing_records" ON public.borrowing_records
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- Migration: 20260316130000_qr_return_flow.sql
CREATE TABLE IF NOT EXISTS public.return_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  librarian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_qr TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_idempotency_created_at
  ON public.return_idempotency(created_at DESC);

CREATE OR REPLACE FUNCTION public.process_qr_return(
  p_librarian_id UUID,
  p_book_qr TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copy RECORD;
  v_borrow RECORD;
  v_existing JSONB;
  v_result JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_librarian_id IS NULL OR p_book_qr IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required return fields.'
    );
  END IF;

  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  BEGIN
    SELECT
      bc.id,
      bc.status,
      bc.qr_string,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COPY_LOCKED',
        'message', 'This book copy is being processed by another session.'
      );
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  SELECT
    br.id,
    br.user_id,
    br.borrowed_at,
    br.due_date,
    p.full_name
  INTO v_borrow
  FROM public.borrowing_records br
  LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id
    AND br.status = 'active'
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_BORROWED',
      'message', 'This copy is not currently checked out.'
    );
  END IF;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'borrowing_id', v_borrow.id,
      'book_title', v_copy.title,
      'book_qr', v_copy.qr_string,
      'borrowed_at', v_borrow.borrowed_at,
      'due_date', v_borrow.due_date,
      'student_name', COALESCE(v_borrow.full_name, 'Student')
    );
  END IF;

  UPDATE public.borrowing_records
  SET status = 'returned', returned_at = v_now, updated_at = v_now
  WHERE id = v_borrow.id;

  UPDATE public.book_copies
  SET status = 'AVAILABLE', updated_at = v_now
  WHERE id = v_copy.id;

  v_result := jsonb_build_object(
    'ok', true,
    'preview', false,
    'borrowing_id', v_borrow.id,
    'book_title', v_copy.title,
    'book_qr', v_copy.qr_string,
    'returned_at', v_now,
    'student_name', COALESCE(v_borrow.full_name, 'Student')
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency (
      idempotency_key,
      librarian_id,
      book_qr,
      response
    ) VALUES (
      p_idempotency_key,
      p_librarian_id,
      v_copy.qr_string,
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;


-- Migration: 20260316134500_fix_qr_return_for_update.sql
CREATE OR REPLACE FUNCTION public.process_qr_return(
  p_librarian_id UUID,
  p_book_qr TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copy RECORD;
  v_borrow RECORD;
  v_existing JSONB;
  v_result JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_librarian_id IS NULL OR p_book_qr IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required return fields.'
    );
  END IF;

  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  BEGIN
    SELECT
      bc.id,
      bc.status,
      bc.qr_string,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr
    FOR UPDATE OF bc NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COPY_LOCKED',
        'message', 'This book copy is being processed by another session.'
      );
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  SELECT
    br.id,
    br.user_id,
    br.borrowed_at,
    br.due_date,
    (
      SELECT p.full_name
      FROM public.profiles p
      WHERE p.id = br.user_id
      LIMIT 1
    ) AS full_name
  INTO v_borrow
  FROM public.borrowing_records br
  WHERE br.book_copy_id = v_copy.id
    AND br.status = 'active'
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE OF br;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_BORROWED',
      'message', 'This copy is not currently checked out.'
    );
  END IF;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'borrowing_id', v_borrow.id,
      'book_title', v_copy.title,
      'book_qr', v_copy.qr_string,
      'borrowed_at', v_borrow.borrowed_at,
      'due_date', v_borrow.due_date,
      'student_name', COALESCE(v_borrow.full_name, 'Student')
    );
  END IF;

  UPDATE public.borrowing_records
  SET status = 'returned', returned_at = v_now, updated_at = v_now
  WHERE id = v_borrow.id;

  UPDATE public.book_copies
  SET status = 'AVAILABLE', updated_at = v_now
  WHERE id = v_copy.id;

  v_result := jsonb_build_object(
    'ok', true,
    'preview', false,
    'borrowing_id', v_borrow.id,
    'book_title', v_copy.title,
    'book_qr', v_copy.qr_string,
    'returned_at', v_now,
    'student_name', COALESCE(v_borrow.full_name, 'Student')
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency (
      idempotency_key,
      librarian_id,
      book_qr,
      response
    ) VALUES (
      p_idempotency_key,
      p_librarian_id,
      v_copy.qr_string,
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;


-- Migration: 20260316170000_add_published_year_to_digital_resources.sql
alter table public.digital_resources
add column if not exists published_year integer;

alter table public.digital_resources
drop constraint if exists digital_resources_published_year_check;

alter table public.digital_resources
add constraint digital_resources_published_year_check
check (published_year is null or (published_year >= 1000 and published_year <= 9999));


-- Migration: 20260317000000_improve_user_trigger.sql
-- Add unique constraint to library_cards user_id to ensure a user has only one card
-- and to support ON CONFLICT (user_id) in the trigger below.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'library_cards_user_id_key'
    ) THEN
        ALTER TABLE public.library_cards ADD CONSTRAINT library_cards_user_id_key UNIQUE (user_id);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student_id_val TEXT;
  card_number_val TEXT;
BEGIN
  -- Parse student_id from email if it follows the STI pattern: lastname.studentid@alabang.sti.edu.ph
  IF new.email LIKE '%.%@alabang.sti.edu.ph' THEN
    student_id_val := split_part(split_part(new.email, '@', 1), '.', 2);
  END IF;

  -- Insert profile (with conflict handling if already exists)
  -- This ensures that the email and full name from Microsoft/Azure are captured.
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    student_id, 
    email,
    updated_at
  )
  VALUES (
    new.id, 
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      new.raw_user_meta_data->>'name', 
      split_part(new.email, '@', 1)
    ), 
    new.raw_user_meta_data->>'avatar_url',
    student_id_val,
    new.email,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

  -- Generate card number LIB-YYYY-XXXXXXXX
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  -- Insert library card (with conflict handling)
  -- All registered users get a library card in 'pending' status by default.
  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (
    new.id,
    card_number_val,
    'pending',
    now() + interval '1 year'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;


-- Migration: 20260319000000_harden_hard_delete_user_profile.sql
-- Harden hard_delete_user_profile with in-function authorization checks.
-- This keeps self-delete working while blocking cross-user RPC abuse.

CREATE OR REPLACE FUNCTION public.hard_delete_user_profile(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_display_name TEXT;
  v_borrow_count INTEGER := 0;
  v_result JSONB;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Unauthorized'
    );
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Caller profile not found'
    );
  END IF;

  IF v_actor_id <> p_user_id AND v_actor_role NOT IN ('admin', 'librarian') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Forbidden'
    );
  END IF;

  SELECT full_name INTO v_display_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  SELECT COUNT(*) INTO v_borrow_count
  FROM public.borrowing_records
  WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    full_name = 'DELETED_USER_' || SUBSTRING(p_user_id::TEXT, 1, 8),
    email = 'deleted_' || SUBSTRING(p_user_id::TEXT, 1, 8) || '@deleted.local',
    phone = NULL,
    avatar_url = NULL,
    status = 'deleted',
    updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE public.borrowing_records
  SET
    user_id = NULL,
    user_display_name = COALESCE(v_display_name, 'Unknown User')
  WHERE user_id = p_user_id;

  UPDATE public.reservations
  SET status = CASE
    WHEN status::text = UPPER(status::text) THEN 'CANCELLED'
    ELSE 'cancelled'
  END
  WHERE user_id = p_user_id
    AND UPPER(status::text) = 'ACTIVE';

  INSERT INTO public.deleted_profile_info (
    original_profile_id,
    deletion_reason,
    retained_borrow_count
  ) VALUES (
    p_user_id,
    COALESCE(p_reason, 'User requested deletion'),
    v_borrow_count
  )
  ON CONFLICT (original_profile_id)
  DO UPDATE SET
    deletion_reason = EXCLUDED.deletion_reason,
    retained_borrow_count = EXCLUDED.retained_borrow_count,
    anonymized_at = NOW();

  INSERT INTO public.audit_logs (
    admin_id,
    entity_type,
    entity_id,
    action,
    reason
  ) VALUES (
    v_actor_id,
    'profile',
    p_user_id,
    'hard_delete',
    COALESCE(p_reason, 'GDPR Right to Erasure') || ' - Anonymization Complete'
  );

  v_result := jsonb_build_object(
    'success', true,
    'message', 'User profile has been anonymized per GDPR Right to Erasure',
    'user_id', p_user_id::TEXT,
    'original_name', v_display_name,
    'retained_borrow_count', v_borrow_count,
    'deleted_at', NOW()::TEXT,
    'note', 'User data anonymized; transaction history preserved for auditing'
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hard_delete_user_profile(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.hard_delete_user_profile(UUID, TEXT) TO authenticated;


-- Migration: 20260319010000_atomic_reservations_and_renewals.sql
-- Phase 1 hardening: transactional reservation queueing and renewal processing.

DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
  INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reservations'
    AND c.column_name = 'status';

  IF v_udt_name = 'ReservationStatus' THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active_user_book
      ON public.reservations (user_id, book_id)
      WHERE status = ''ACTIVE''
    ';
  ELSE
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active_user_book
      ON public.reservations (user_id, book_id)
      WHERE status IN (''ACTIVE'', ''active'')
    ';
  END IF;
END
$$;
