-- Final Consolidated Migration for Lumina LMS
-- Standardized Enums: Uppercase (ACTIVE, PENDING, RETURNED, etc.)
-- Removed: Reservations, Digital Assets

-- 1. EXTENSIONS & SCHEMA
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;

-- 2. ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'librarian', 'staff', 'student');
  END IF;
END
$$;

-- 3. CORE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
  full_name TEXT,
  email TEXT,
  student_id TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    setweight(to_tsvector('english', coalesce(isbn, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_books_search ON public.books USING GIN (search_vector);

CREATE SEQUENCE IF NOT EXISTS public.book_copy_qr_seq;

CREATE TABLE IF NOT EXISTS public.book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  qr_string VARCHAR(50) UNIQUE DEFAULT 'QR-' || nextval('public.book_copy_qr_seq'),
  status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST')),
  condition VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SYSTEM SETTINGS & INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settings (key, value) VALUES 
('max_borrow_limit', '5'),
('loan_period_days', '14'),
('max_outstanding_fines', '100')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.library_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_display_name TEXT, -- For anonymized records
  book_copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST')),
  renewal_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_records_active_copy
  ON public.borrowing_records(book_copy_id)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'CANCELLED')),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrowing_record_id UUID REFERENCES public.borrowing_records(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'OPEN', 'CANCELLED')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LOGGING & ANONYMIZATION
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deleted_profile_info (
  original_profile_id UUID PRIMARY KEY,
  deletion_reason TEXT,
  retained_borrow_count INTEGER DEFAULT 0,
  anonymized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. OFFLINE PROTOCOL
CREATE TABLE IF NOT EXISTS public.offline_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.offline_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. IDEMPOTENCY
CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  librarian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  book_qr TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  librarian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_qr TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TRIGGERS & FUNCTIONS
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
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_available_copies ON public.book_copies;
CREATE TRIGGER trigger_update_available_copies
AFTER INSERT OR UPDATE OR DELETE ON public.book_copies
FOR EACH ROW EXECUTE FUNCTION public.update_available_copies();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  student_id_val TEXT;
  card_number_val TEXT;
BEGIN
  IF new.email LIKE '%.%@alabang.sti.edu.ph' THEN
    student_id_val := split_part(split_part(new.email, '@', 1), '.', 2);
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, student_id, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url',
    student_id_val,
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '1 year')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

-- 9. RPC CORE FUNCTIONS
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
  v_max_borrow_limit INTEGER;
  v_loan_days INTEGER;
  v_fine_threshold NUMERIC;
  v_outstanding_fines NUMERIC := 0;
  v_due_date TIMESTAMPTZ;
  v_borrowing_id UUID;
  v_existing JSONB;
  v_result JSONB;
BEGIN
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing FROM public.checkout_idempotency WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing || jsonb_build_object('idempotent', true); END IF;
  END IF;

  SELECT lc.user_id, lc.card_number, lc.status, p.full_name, p.student_id
  INTO v_card FROM public.library_cards lc JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_FOUND'); END IF;
  IF v_card.status <> 'ACTIVE' THEN RETURN jsonb_build_object('ok', false, 'code', 'CARD_INACTIVE'); END IF;

  SELECT 
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit' THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days' THEN value::INTEGER END), 14),
    COALESCE(MAX(CASE WHEN key = 'max_outstanding_fines' THEN value::NUMERIC END), 100)
  INTO v_max_borrow_limit, v_loan_days, v_fine_threshold FROM public.settings;

  SELECT COUNT(*) INTO v_active_borrows FROM public.borrowing_records WHERE user_id = v_card.user_id AND status = 'ACTIVE';
  IF v_active_borrows >= v_max_borrow_limit THEN RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED'); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_outstanding_fines FROM public.fines WHERE user_id = v_card.user_id AND status IN ('UNPAID', 'OPEN');
  IF v_outstanding_fines > v_fine_threshold THEN RETURN jsonb_build_object('ok', false, 'code', 'FINE_THRESHOLD'); END IF;

  SELECT bc.id, bc.book_id, bc.status, b.title INTO v_copy FROM public.book_copies bc JOIN public.books b ON b.id = bc.book_id WHERE bc.qr_string = p_book_qr FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND'); END IF;
  IF v_copy.status <> 'AVAILABLE' THEN RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE'); END IF;

  v_due_date := NOW() + make_interval(days => v_loan_days);
  IF p_preview_only THEN RETURN jsonb_build_object('ok', true, 'preview', true, 'student_name', v_card.full_name, 'book_title', v_copy.title, 'due_date', v_due_date); END IF;

  UPDATE public.book_copies SET status = 'BORROWED', updated_at = NOW() WHERE id = v_copy.id;
  INSERT INTO public.borrowing_records (user_id, book_copy_id, processed_by, borrowed_at, due_date, status)
  VALUES (v_card.user_id, v_copy.id, p_librarian_id, NOW(), v_due_date, 'ACTIVE')
  RETURNING id INTO v_borrowing_id;

  v_result := jsonb_build_object('ok', true, 'borrowing_id', v_borrowing_id, 'student_name', v_card.full_name, 'book_title', v_copy.title, 'due_date', v_due_date);
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.checkout_idempotency (idempotency_key, librarian_id, card_number, book_qr, response)
    VALUES (p_idempotency_key, p_librarian_id, v_card.card_number, p_book_qr, v_result) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

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
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing FROM public.return_idempotency WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing || jsonb_build_object('idempotent', true); END IF;
  END IF;

  SELECT bc.id, bc.status, bc.qr_string, b.title INTO v_copy FROM public.book_copies bc JOIN public.books b ON b.id = bc.book_id WHERE bc.qr_string = p_book_qr FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND'); END IF;

  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, p.full_name
  INTO v_borrow FROM public.borrowing_records br LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id AND br.status = 'ACTIVE' ORDER BY br.borrowed_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED'); END IF;
  IF p_preview_only THEN RETURN jsonb_build_object('ok', true, 'preview', true, 'book_title', v_copy.title, 'student_name', COALESCE(v_borrow.full_name, 'Student')); END IF;

  UPDATE public.borrowing_records SET status = 'RETURNED', returned_at = v_now, updated_at = v_now WHERE id = v_borrow.id;
  UPDATE public.book_copies SET status = 'AVAILABLE', updated_at = v_now WHERE id = v_copy.id;

  v_result := jsonb_build_object('ok', true, 'book_title', v_copy.title, 'returned_at', v_now, 'student_name', COALESCE(v_borrow.full_name, 'Student'));
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency (idempotency_key, librarian_id, book_qr, response)
    VALUES (p_idempotency_key, p_librarian_id, v_copy.qr_string, v_result) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

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
  SELECT role::text INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_id <> p_user_id AND v_actor_role NOT IN ('admin', 'librarian') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden');
  END IF;

  SELECT full_name INTO v_display_name FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Not Found'); END IF;

  SELECT COUNT(*) INTO v_borrow_count FROM public.borrowing_records WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET full_name = 'DELETED_USER_' || SUBSTRING(p_user_id::TEXT, 1, 8),
      email = 'deleted_' || SUBSTRING(p_user_id::TEXT, 1, 8) || '@deleted.local',
      status = 'DELETED', updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE public.borrowing_records SET user_id = NULL, user_display_name = COALESCE(v_display_name, 'Unknown User') WHERE user_id = p_user_id;

  INSERT INTO public.deleted_profile_info (original_profile_id, deletion_reason, retained_borrow_count)
  VALUES (p_user_id, COALESCE(p_reason, 'User requested deletion'), v_borrow_count)
  ON CONFLICT (original_profile_id) DO UPDATE SET anonymized_at = NOW();

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, reason)
  VALUES (v_actor_id, 'profile', p_user_id, 'hard_delete', p_reason);

  RETURN jsonb_build_object('success', true, 'retained_borrow_count', v_borrow_count);
END;
$$;

-- 10. POLICIES (Simplified for dev)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Full access for admins" ON public.categories FOR ALL TO authenticated USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'librarian'));

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Full access for admins" ON public.books FOR ALL TO authenticated USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'librarian'));

ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to book_copies" ON public.book_copies FOR SELECT USING (true);
CREATE POLICY "Full access for admins" ON public.book_copies FOR ALL TO authenticated USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'librarian'));

ALTER TABLE public.library_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own card" ON public.library_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Full access for admins" ON public.library_cards FOR ALL TO authenticated USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'librarian'));

ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own borrows" ON public.borrowing_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Full access for admins" ON public.borrowing_records FOR ALL TO authenticated USING ((SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'librarian'));