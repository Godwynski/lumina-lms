-- Add missing columns to profiles
ALTER TABLE "profiles" ADD COLUMN "phone" TEXT;

-- Create enums
DO $$ BEGIN
    CREATE TYPE "BookStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RETIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "data_type" TEXT NOT NULL DEFAULT 'string',
    "updated_by" uuid NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_settings_key_key" UNIQUE ("key")
);

-- Create categories table
CREATE TABLE IF NOT EXISTS "categories" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_name_key" UNIQUE ("name"),
    CONSTRAINT "categories_slug_key" UNIQUE ("slug")
);

-- Create books table
CREATE TABLE IF NOT EXISTS "books" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "category_id" uuid NOT NULL,
    "tags" TEXT[],
    "location" TEXT,
    "cover_url" TEXT,
    "description" TEXT,
    "total_copies" INTEGER NOT NULL DEFAULT 1,
    "available_copies" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "books_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "books_isbn_key" UNIQUE ("isbn"),
    CONSTRAINT "books_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT
);

CREATE INDEX "books_category_id_idx" ON "books"("category_id");
CREATE INDEX "books_is_active_idx" ON "books"("is_active");

-- Create book_copies table
CREATE TABLE IF NOT EXISTS "book_copies" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "book_id" uuid NOT NULL,
    "qr_code" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT NOT NULL DEFAULT 'good',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "book_copies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "book_copies_qr_code_key" UNIQUE ("qr_code"),
    CONSTRAINT "book_copies_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT
);

CREATE INDEX "book_copies_book_id_idx" ON "book_copies"("book_id");
CREATE INDEX "book_copies_qr_code_idx" ON "book_copies"("qr_code");
CREATE INDEX "book_copies_status_idx" ON "book_copies"("status");

-- Create library_cards table
CREATE TABLE IF NOT EXISTS "library_cards" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "card_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "library_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "library_cards_card_number_key" UNIQUE ("card_number"),
    CONSTRAINT "library_cards_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "library_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX "library_cards_card_number_idx" ON "library_cards"("card_number");
CREATE INDEX "library_cards_status_idx" ON "library_cards"("status");

-- Create borrowing_records table
CREATE TABLE IF NOT EXISTS "borrowing_records" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid,
    "user_display_name" TEXT,
    "book_copy_id" uuid NOT NULL,
    "processed_by" uuid NOT NULL,
    "returned_by" uuid,
    "borrowed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "returned_at" TIMESTAMPTZ(6),
    "renewal_count" INTEGER NOT NULL DEFAULT 0,
    "status" "BorrowStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "borrowing_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "borrowing_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL,
    CONSTRAINT "borrowing_records_book_copy_id_fkey" FOREIGN KEY ("book_copy_id") REFERENCES "book_copies"("id") ON DELETE RESTRICT,
    CONSTRAINT "borrowing_records_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "profiles"("id") ON DELETE RESTRICT,
    CONSTRAINT "borrowing_records_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "borrowing_records_user_id_idx" ON "borrowing_records"("user_id");
CREATE INDEX "borrowing_records_book_copy_id_idx" ON "borrowing_records"("book_copy_id");
CREATE INDEX "borrowing_records_status_idx" ON "borrowing_records"("status");
CREATE INDEX "borrowing_records_due_date_idx" ON "borrowing_records"("due_date");

-- Create renewals table
CREATE TABLE IF NOT EXISTS "renewals" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "borrowing_record_id" uuid NOT NULL,
    "renewed_by" uuid NOT NULL,
    "renewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "new_due_date" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "renewals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "renewals_borrowing_record_id_fkey" FOREIGN KEY ("borrowing_record_id") REFERENCES "borrowing_records"("id") ON DELETE CASCADE,
    CONSTRAINT "renewals_renewed_by_fkey" FOREIGN KEY ("renewed_by") REFERENCES "profiles"("id") ON DELETE RESTRICT
);

CREATE INDEX "renewals_borrowing_record_id_idx" ON "renewals"("borrowing_record_id");

-- Create reservations table
CREATE TABLE IF NOT EXISTS "reservations" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "book_id" uuid NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "hold_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "fulfilled_at" TIMESTAMPTZ(6),
    "queue_position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "reservations_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE
);

CREATE INDEX "reservations_user_id_idx" ON "reservations"("user_id");
CREATE INDEX "reservations_book_id_idx" ON "reservations"("book_id");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
CREATE INDEX "reservations_hold_expires_at_idx" ON "reservations"("hold_expires_at");

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" uuid NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" uuid,
    "action" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "profiles"("id") ON DELETE RESTRICT
);

CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs"("admin_id");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Create deleted_profile_info table
CREATE TABLE IF NOT EXISTS "deleted_profile_info" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "original_profile_id" uuid NOT NULL,
    "anonymized_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "deletion_reason" TEXT,
    "retained_borrow_count" INTEGER NOT NULL DEFAULT 0,
    "retained_fine_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "deleted_profile_info_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deleted_profile_info_original_profile_id_key" UNIQUE ("original_profile_id"),
    CONSTRAINT "deleted_profile_info_original_profile_id_fkey" FOREIGN KEY ("original_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

-- Trigger: Prevent physical deletion of book_copies
CREATE OR REPLACE FUNCTION prevent_book_copies_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of book_copies is prohibited. Use status=RETIRED instead.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_book_copies_deletion_trigger ON book_copies;
CREATE TRIGGER prevent_book_copies_deletion_trigger
BEFORE DELETE ON book_copies
FOR EACH ROW
EXECUTE FUNCTION prevent_book_copies_deletion();

-- Trigger: Log audit changes to system_settings
CREATE OR REPLACE FUNCTION audit_system_settings_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    END IF;

    INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (
        COALESCE(NEW.updated_by, OLD.updated_by),
        'system_setting',
        COALESCE(NEW.id, OLD.id),
        v_action,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)::text ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)::text ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_system_settings_changes_trigger ON system_settings;
CREATE TRIGGER audit_system_settings_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION audit_system_settings_changes();

-- Create improved checkout function that uses system_settings
CREATE OR REPLACE FUNCTION public.process_qr_checkout_with_policies(
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
  v_book RECORD;
  v_active_borrows INTEGER := 0;
  v_max_borrow_limit INTEGER := 5;
  v_loan_days INTEGER := 14;
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

  -- Check idempotency
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Fetch library card
  SELECT
    lc.id,
    lc.user_id,
    lc.card_number,
    lc.status,
    lc.expires_at,
    p.full_name
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

  IF v_card.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CARD_EXPIRED',
      'message', 'Student card has expired.'
    );
  END IF;

  -- Get policy settings from system_settings table
  SELECT COALESCE(NULLIF(value, '')::INTEGER, 5)
  INTO v_max_borrow_limit
  FROM public.system_settings
  WHERE key = 'max_borrow_limit'
  LIMIT 1;

  SELECT COALESCE(NULLIF(value, '')::INTEGER, 14)
  INTO v_loan_days
  FROM public.system_settings
  WHERE key = 'default_loan_period_days'
  LIMIT 1;

  -- Count active borrows
  SELECT COUNT(*)
  INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id
    AND status = 'ACTIVE';

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BORROW_LIMIT_EXCEEDED',
      'message', 'Student has reached maximum borrow limit of ' || v_max_borrow_limit || '.'
    );
  END IF;

  -- Fetch book copy
  SELECT
    bc.id,
    bc.book_id,
    bc.qr_code,
    bc.status,
    b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_code = p_book_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  IF v_copy.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_UNAVAILABLE',
      'message', 'Book copy is not available.'
    );
  END IF;

  -- Calculate due date
  v_due_date := NOW() + (v_loan_days || ' days')::INTERVAL;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'type', 'checkout_preview',
      'book_title', v_copy.title,
      'due_date', v_due_date::TEXT,
      'card_number', v_card.card_number,
      'book_qr', p_book_qr
    );
  END IF;

  -- Lock and update book copy
  UPDATE public.book_copies
  SET status = 'BORROWED'
  WHERE id = v_copy.id
  RETURNING id INTO v_copy.id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_LOCKED',
      'message', 'This book copy is being processed by another session.'
    );
  END IF;

  -- Create borrowing record
  INSERT INTO public.borrowing_records (
    user_id,
    book_copy_id,
    processed_by,
    borrowed_at,
    due_date,
    status
  ) VALUES (
    v_card.user_id,
    v_copy.id,
    p_librarian_id,
    NOW(),
    v_due_date,
    'ACTIVE'
  ) RETURNING id INTO v_borrowing_id;

  -- Update available copies count
  UPDATE public.books
  SET available_copies = GREATEST(0, available_copies - 1)
  WHERE id = v_copy.book_id;

  -- Create idempotency record
  v_result := jsonb_build_object(
    'ok', true,
    'type', 'checkout_confirmed',
    'borrowing_id', v_borrowing_id::TEXT,
    'book_title', v_copy.title,
    'due_date', v_due_date::TEXT,
    'card_number', v_card.card_number,
    'book_qr', p_book_qr
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
    );
  END IF;

  RETURN v_result;
END;
$$;
