-- Keep financial details out of the public copy row and Realtime publication.
CREATE TABLE IF NOT EXISTS public.book_copy_lifecycle (
  copy_id uuid PRIMARY KEY REFERENCES public.book_copies(id) ON DELETE CASCADE,
  acquisition_method text CHECK (acquisition_method IN ('PURCHASED', 'DONATED')),
  acquired_on date,
  purchase_price numeric(12,2) CHECK (purchase_price IS NULL OR (purchase_price >= 0 AND acquisition_method IS NOT DISTINCT FROM 'PURCHASED')),
  disposition_on date,
  sale_amount numeric(12,2) CHECK (sale_amount IS NULL OR (sale_amount >= 0 AND disposition_on IS NOT NULL)),
  last_lost_on date
);

ALTER TABLE public.book_copy_lifecycle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.book_copy_lifecycle FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.book_copy_lifecycle TO service_role;

ALTER TABLE public.book_copies DROP CONSTRAINT IF EXISTS book_copies_status_check;
ALTER TABLE public.book_copies ADD CONSTRAINT book_copies_status_check
  CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED', 'SOLD', 'DONATED_OUT'));

CREATE OR REPLACE FUNCTION public.guard_retired_copy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('SOLD', 'DONATED_OUT') THEN
      RAISE EXCEPTION 'This copy has already left circulation and its record must be kept.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('SOLD', 'DONATED_OUT') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This copy has already left circulation.';
  END IF;
  IF current_user IN ('anon', 'authenticated') AND NEW.status IN ('SOLD', 'DONATED_OUT', 'LOST') THEN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Record this change through Inventory.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_retired_copy ON public.book_copies;
CREATE TRIGGER guard_retired_copy
  BEFORE INSERT OR UPDATE OF status OR DELETE ON public.book_copies
  FOR EACH ROW EXECUTE FUNCTION public.guard_retired_copy();

CREATE OR REPLACE FUNCTION public.save_book_copy_acquisition(p_copy_id uuid, p_acquisition jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_method text := p_acquisition->>'method';
  v_date date := (p_acquisition->>'acquiredOn')::date;
  v_price text := p_acquisition->>'purchasePrice';
BEGIN
  IF v_price IS NOT NULL AND (v_method IS DISTINCT FROM 'PURCHASED' OR v_price !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$') THEN
    RAISE EXCEPTION 'Enter a valid purchase price for a bought copy.';
  END IF;
  IF v_date > (now() AT TIME ZONE 'Asia/Manila')::date THEN
    RAISE EXCEPTION 'Acquisition date cannot be in the future.';
  END IF;
  INSERT INTO public.book_copy_lifecycle (copy_id, acquisition_method, acquired_on, purchase_price)
  VALUES (p_copy_id, v_method, v_date, v_price::numeric)
  ON CONFLICT (copy_id) DO UPDATE
  SET acquisition_method = EXCLUDED.acquisition_method, acquired_on = EXCLUDED.acquired_on,
      purchase_price = EXCLUDED.purchase_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_book_copy_batch(p_copies jsonb)
RETURNS TABLE(id uuid, book_id uuid, qr_string text, accession_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_copy public.book_copies;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_copies) LOOP
    INSERT INTO public.book_copies AS c (book_id, status)
    VALUES ((v_item->>'book_id')::uuid, 'AVAILABLE') RETURNING c.* INTO v_copy;
    IF jsonb_typeof(v_item->'acquisition') = 'object' THEN
      PERFORM public.save_book_copy_acquisition(v_copy.id, v_item->'acquisition');
    END IF;
    RETURN QUERY SELECT v_copy.id, v_copy.book_id, v_copy.qr_string, v_copy.accession_number;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_catalog_book(p_book jsonb)
RETURNS public.books
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_book public.books := jsonb_populate_record(NULL::public.books, p_book);
BEGIN
  INSERT INTO public.books(title, author, isbn, category_id, cover_url, tags, location, section,
    is_active, dewey_decimal, description, published_year)
  VALUES (v_book.title, v_book.author, v_book.isbn, v_book.category_id, v_book.cover_url,
    coalesce(v_book.tags, '{}'::text[]), v_book.location, v_book.section, coalesce(v_book.is_active, true),
    v_book.dewey_decimal, v_book.description, v_book.published_year)
  RETURNING * INTO v_book;
  RETURN v_book;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_book_with_acquisition(p_book jsonb, p_count integer, p_acquisition jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_book public.books;
  v_copy_ids jsonb;
BEGIN
  v_book := public.insert_catalog_book(p_book);
  SELECT coalesce(jsonb_agg(created.id), '[]'::jsonb) INTO v_copy_ids FROM public.create_book_copy_batch(
    (SELECT coalesce(jsonb_agg(jsonb_build_object('book_id', v_book.id, 'acquisition', p_acquisition)), '[]'::jsonb)
     FROM generate_series(1, p_count))
  ) AS created;
  RETURN jsonb_build_object('id', v_book.id, 'copyIds', v_copy_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_spreadsheet(p_books jsonb, p_copies jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_metadata jsonb;
  v_book public.books;
  v_category_name text;
  v_category_id uuid;
  v_slug text;
  v_isbn text;
  v_book_copies jsonb;
  v_books jsonb := '[]'::jsonb;
  v_copy_ids jsonb := '[]'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-spreadsheet-import', 0));
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_books) LOOP
    v_metadata := v_item->'book';
    v_isbn := upper(regexp_replace(coalesce(v_metadata->>'isbn', ''), '[[:space:]-]', '', 'g'));
    IF v_isbn <> '' THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('catalog-isbn-' || v_isbn, 0));
    END IF;
    IF EXISTS (SELECT 1 FROM public.books b WHERE
      (v_isbn <> '' AND upper(regexp_replace(b.isbn, '[[:space:]-]', '', 'g')) = v_isbn)
      OR (lower(btrim(b.title)) = lower(btrim(v_metadata->>'title'))
        AND lower(btrim(b.author)) = lower(btrim(v_metadata->>'author')))
    ) THEN
      RAISE EXCEPTION 'A matching title was added during import. Review the spreadsheet and try again.';
    END IF;

    v_category_name := nullif(btrim(v_item->>'categoryName'), '');
    IF v_category_name IS NOT NULL THEN
      SELECT id INTO v_category_id FROM public.categories
      WHERE lower(name) = lower(v_category_name) ORDER BY id LIMIT 1;
      IF NOT FOUND THEN
        v_slug := trim(both '-' FROM regexp_replace(lower(v_category_name), '[^a-z0-9]+', '-', 'g'));
        IF v_slug = '' OR EXISTS (SELECT 1 FROM public.categories WHERE slug = v_slug) THEN
          v_slug := coalesce(nullif(v_slug, ''), 'category') || '-' || left(md5(v_category_name), 8);
        END IF;
        INSERT INTO public.categories(name, slug, is_active, description)
        VALUES (v_category_name, v_slug, true, 'Category created during batch import of books.')
        RETURNING id INTO v_category_id;
      END IF;
      v_metadata := v_metadata || jsonb_build_object('category_id', v_category_id);
    END IF;

    v_book := public.insert_catalog_book(v_metadata);
    SELECT coalesce(jsonb_agg(created.id), '[]'::jsonb) INTO v_book_copies
    FROM public.create_book_copy_batch((
      SELECT coalesce(jsonb_agg(jsonb_build_object('book_id', v_book.id, 'acquisition', a.value)), '[]'::jsonb)
      FROM jsonb_array_elements(v_item->'acquisitions') AS a
    )) AS created;
    v_books := v_books || jsonb_build_array(jsonb_build_object('id', v_book.id, 'title', v_book.title,
      'author', v_book.author, 'isbn', v_book.isbn, 'cover_url', v_book.cover_url, 'copyIds', v_book_copies));
    v_copy_ids := v_copy_ids || v_book_copies;
  END LOOP;
  SELECT v_copy_ids || coalesce(jsonb_agg(created.id), '[]'::jsonb) INTO v_copy_ids
  FROM public.create_book_copy_batch(p_copies) AS created;
  RETURN jsonb_build_object('books', v_books, 'copyIds', v_copy_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_book_copy(p_copy_id uuid, p_expected_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.book_copies WHERE id = p_copy_id FOR UPDATE;
  IF NOT FOUND OR v_status IS DISTINCT FROM p_expected_status OR coalesce(v_status, '') NOT IN ('LOST', 'MAINTENANCE') THEN
    RAISE EXCEPTION 'This copy changed while you were editing. Refresh and try again.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.borrowing_records WHERE book_copy_id = p_copy_id
      AND returned_at IS NULL AND status IN ('ACTIVE', 'OVERDUE', 'LOST')) THEN
    RAISE EXCEPTION 'This copy is still on a loan. Scan it at the return desk to close the loan.';
  END IF;
  RETURN public.release_copy(p_copy_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_book_copy_lifecycle(p_actor uuid, p_copy_id uuid, p_change jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_copy public.book_copies;
  v_before public.book_copy_lifecycle;
  v_after public.book_copy_lifecycle;
  v_status text := p_change->>'status';
  v_date date := (p_change->>'occurredOn')::date;
  v_sale text := p_change->>'saleAmount';
  v_action text;
  v_waiting boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_actor AND p.status = 'ACTIVE'
      AND p.role::text IN ('librarian', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized to manage copy records.';
  END IF;

  SELECT * INTO v_copy FROM public.book_copies WHERE id = p_copy_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Copy not found.'; END IF;
  SELECT * INTO v_before FROM public.book_copy_lifecycle WHERE copy_id = p_copy_id;

  IF v_status IS NULL AND jsonb_typeof(p_change->'acquisition') = 'object' THEN
    IF (p_change->'acquisition'->>'acquiredOn')::date > least(v_before.disposition_on, v_before.last_lost_on) THEN
      RAISE EXCEPTION 'Acquisition date cannot be after a recorded sale, donation, or loss.';
    END IF;
    PERFORM public.save_book_copy_acquisition(p_copy_id, p_change->'acquisition');
    v_action := 'update_copy_acquisition';
  ELSIF v_status IN ('SOLD', 'DONATED_OUT', 'LOST') THEN
    IF v_copy.status IN ('SOLD', 'DONATED_OUT') THEN
      RAISE EXCEPTION 'This copy has already left circulation.';
    END IF;
    IF v_date IS NULL OR v_date > (now() AT TIME ZONE 'Asia/Manila')::date THEN
      RAISE EXCEPTION 'Enter the event date, no later than today.';
    END IF;
    IF v_date < v_before.acquired_on THEN
      RAISE EXCEPTION 'The event date cannot be before the acquisition date.';
    END IF;
    IF v_date < v_before.last_lost_on OR EXISTS (
      SELECT 1 FROM public.borrowing_records WHERE book_copy_id = p_copy_id
        AND (greatest(borrowed_at, returned_at) AT TIME ZONE 'Asia/Manila')::date > v_date
    ) THEN
      RAISE EXCEPTION 'The event date cannot be before the latest loss or loan activity.';
    END IF;
    IF v_status = 'SOLD' AND (v_sale IS NULL OR v_sale !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$') THEN
      RAISE EXCEPTION 'Enter a valid sale amount.';
    ELSIF v_status <> 'SOLD' AND v_sale IS NOT NULL THEN
      RAISE EXCEPTION 'Sale amount only applies to a sold copy.';
    END IF;
    IF v_copy.status = 'RESERVED' OR EXISTS (
      SELECT 1 FROM public.reservations WHERE copy_id = p_copy_id AND status = 'READY'
    ) THEN
      RAISE EXCEPTION 'This copy is on hold. Resolve the hold before changing its status.';
    END IF;
    IF v_status <> 'LOST' AND (v_copy.status IN ('BORROWED', 'LOST') OR EXISTS (
      SELECT 1 FROM public.borrowing_records WHERE book_copy_id = p_copy_id
        AND returned_at IS NULL AND status IN ('ACTIVE', 'OVERDUE', 'LOST')
    )) THEN
      RAISE EXCEPTION 'Return or recover this copy before recording a sale or donation.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_copy.book_id::text, 0));
    v_waiting := EXISTS (
      SELECT 1 FROM public.reservations WHERE book_id = v_copy.book_id AND status IN ('ACTIVE', 'READY')
    ) AND NOT EXISTS (
      SELECT 1 FROM public.book_copies WHERE book_id = v_copy.book_id AND id <> p_copy_id
        AND status IN ('AVAILABLE', 'BORROWED', 'RESERVED')
    );
    IF v_waiting AND v_status <> 'LOST' THEN
      RAISE EXCEPTION 'This is the last copy that could serve the reservation queue.';
    END IF;

    UPDATE public.book_copies SET status = v_status WHERE id = p_copy_id AND status IS DISTINCT FROM v_status;
    IF v_status = 'LOST' THEN
      UPDATE public.borrowing_records SET status = 'LOST', updated_at = now()
      WHERE book_copy_id = p_copy_id AND returned_at IS NULL AND status IN ('ACTIVE', 'OVERDUE');
      INSERT INTO public.book_copy_lifecycle (copy_id, last_lost_on) VALUES (p_copy_id, v_date)
      ON CONFLICT (copy_id) DO UPDATE SET last_lost_on = EXCLUDED.last_lost_on;
    ELSE
      INSERT INTO public.book_copy_lifecycle (copy_id, disposition_on, sale_amount)
      VALUES (p_copy_id, v_date, v_sale::numeric)
      ON CONFLICT (copy_id) DO UPDATE SET disposition_on = EXCLUDED.disposition_on, sale_amount = EXCLUDED.sale_amount;
    END IF;
    v_action := 'update_copy_' || lower(v_status);
  ELSE
    RAISE EXCEPTION 'Choose a valid copy change.';
  END IF;

  SELECT * INTO v_after FROM public.book_copy_lifecycle WHERE copy_id = p_copy_id;
  IF v_before IS DISTINCT FROM v_after OR (v_status IS NOT NULL AND v_copy.status IS DISTINCT FROM v_status) THEN
    INSERT INTO public.audit_logs(admin_id, entity_type, entity_id, action, reason, details, old_value, new_value)
    VALUES (p_actor, 'book_copy', p_copy_id, v_action,
      CASE v_action WHEN 'update_copy_acquisition' THEN 'Updated copy acquisition'
        WHEN 'update_copy_sold' THEN 'Recorded sale' WHEN 'update_copy_donated_out' THEN 'Recorded outgoing donation'
        ELSE 'Reported copy lost' END || ' for ' || coalesce(v_copy.accession_number, v_copy.qr_string),
      jsonb_build_object('book_id', v_copy.book_id, 'book_copy_id', p_copy_id, 'occurred_on', coalesce(v_date, v_after.acquired_on)),
      coalesce(to_jsonb(v_before), '{}'::jsonb) || jsonb_build_object('status', v_copy.status),
      to_jsonb(v_after) || jsonb_build_object('status', coalesce(v_status, v_copy.status)));
  END IF;
  RETURN jsonb_build_object('id', p_copy_id, 'bookId', v_copy.book_id,
    'status', coalesce(v_status, v_copy.status), 'queueWaiting', v_waiting);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_book_copy_acquisition(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.insert_catalog_book(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_book_copy_batch(jsonb),
  public.create_book_with_acquisition(jsonb, integer, jsonb),
  public.apply_catalog_spreadsheet(jsonb, jsonb), public.recover_book_copy(uuid, text),
  public.change_book_copy_lifecycle(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_book_copy_batch(jsonb),
  public.create_book_with_acquisition(jsonb, integer, jsonb),
  public.apply_catalog_spreadsheet(jsonb, jsonb), public.recover_book_copy(uuid, text),
  public.change_book_copy_lifecycle(uuid, uuid, jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.fn_sync_book_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
    -- Lock the title before counting so simultaneous changes to different copies stay in sync.
    IF TG_OP = 'UPDATE' THEN
        PERFORM id FROM public.books WHERE id IN (OLD.book_id, NEW.book_id) ORDER BY id FOR NO KEY UPDATE;
    ELSIF TG_OP = 'INSERT' THEN
        PERFORM id FROM public.books WHERE id = NEW.book_id FOR NO KEY UPDATE;
    ELSE
        PERFORM id FROM public.books WHERE id = OLD.book_id FOR NO KEY UPDATE;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        UPDATE public.books
        SET 
            total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND coalesce(status, '') NOT IN ('SOLD', 'DONATED_OUT')),
            available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND status = 'AVAILABLE'),
            updated_at = NOW()
        WHERE id = OLD.book_id;
    ELSE
        UPDATE public.books
        SET 
            total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = NEW.book_id AND coalesce(status, '') NOT IN ('SOLD', 'DONATED_OUT')),
            available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = NEW.book_id AND status = 'AVAILABLE'),
            updated_at = NOW()
        WHERE id = NEW.book_id;
        
        IF (TG_OP = 'UPDATE' AND OLD.book_id <> NEW.book_id) THEN
            UPDATE public.books
            SET 
                total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND coalesce(status, '') NOT IN ('SOLD', 'DONATED_OUT')),
                available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = OLD.book_id AND status = 'AVAILABLE'),
                updated_at = NOW()
            WHERE id = OLD.book_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_copy(p_copy_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_copy_status text;
  v_book_id          UUID;
  v_now              TIMESTAMPTZ := NOW();
  v_next_reservation RECORD;
  v_hold_days        INTEGER;
  v_hold_expires_at  TIMESTAMPTZ;
  v_student_name     TEXT;
  v_book_title       TEXT;
BEGIN
  -- Lock the copy and read its book_id
  SELECT bc.book_id, bc.status
  INTO v_book_id, v_copy_status
  FROM public.book_copies bc
  WHERE bc.id = p_copy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'reservation_ready', false);
  END IF;

  IF v_copy_status IN ('SOLD', 'DONATED_OUT') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_RETIRED', 'reservation_ready', false);
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

    -- Tell the patron their hold is ready (every path that promotes a hold comes through here).
    SELECT title INTO v_book_title FROM public.books WHERE id = v_book_id;
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    VALUES (
      v_next_reservation.user_id,
      'Reservation Ready for Pickup',
      format('"%s" is ready for pickup. Please claim it by %s.',
             COALESCE(v_book_title, 'Your reserved book'),
             to_char(v_hold_expires_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY')),
      'RESERVATION',
      'high',
      jsonb_build_object('reservationId', v_next_reservation.id, 'bookId', v_book_id, 'holdExpiresAt', v_hold_expires_at)
    );

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
    v_fine_rate      NUMERIC;
    v_overdue_count  INTEGER;
    v_receivable     NUMERIC;
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
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'library_staff') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF UPPER(COALESCE(v_profile_status, '')) <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Only active accounts can reserve books.');
    END IF;

    -- Archived titles are out of circulation (P3-CAT-021).
    IF EXISTS (SELECT 1 FROM public.books WHERE id = p_book_id AND is_active = false) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BOOK_ARCHIVED', 'message', 'This title is archived and cannot be reserved.');
    END IF;

    -- Same borrowing block as checkout: overdue or lost loans and unpaid fines (GAP-033).
    SELECT COALESCE(MAX(NULLIF(value, '')::NUMERIC), 5) INTO v_fine_rate
    FROM public.system_settings WHERE key = 'overdue_fine_per_day';

    SELECT
        COUNT(*) FILTER (WHERE br.status IN ('OVERDUE', 'LOST') OR (br.status = 'ACTIVE' AND br.due_date < NOW())),
        COALESCE(SUM(CASE
            WHEN br.fine_settled_at IS NOT NULL THEN 0
            WHEN br.fine_amount IS NOT NULL THEN br.fine_amount
            WHEN br.returned_at IS NULL AND (br.status = 'OVERDUE' OR br.due_date < NOW())
                THEN GREATEST(1, ((NOW() AT TIME ZONE 'Asia/Manila')::date - (br.due_date AT TIME ZONE 'Asia/Manila')::date)) * COALESCE(v_fine_rate, 5)
            ELSE 0
        END), 0)
    INTO v_overdue_count, v_receivable
    FROM public.borrowing_records br
    WHERE br.user_id = v_target_id
      AND (br.status IN ('ACTIVE', 'OVERDUE', 'LOST') OR br.fine_settled_at IS NULL);

    IF v_overdue_count > 0 OR v_receivable > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BORROWING_BLOCKED', 'message',
            CASE
                WHEN v_overdue_count > 0 AND v_receivable > 0 THEN
                    format('User has %s overdue book(s) and ₱%s in unpaid fines. Please settle them before borrowing more.', v_overdue_count, to_char(v_receivable, 'FM999999990.00'))
                WHEN v_overdue_count > 0 THEN
                    format('User has %s overdue book(s). Please return them before borrowing more.', v_overdue_count)
                ELSE
                    format('User has ₱%s in unpaid fines. Please settle them before borrowing more.', to_char(v_receivable, 'FM999999990.00'))
            END);
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

    IF NOT EXISTS (
        SELECT 1 FROM public.book_copies WHERE book_id = p_book_id
          AND status IN ('AVAILABLE', 'BORROWED', 'RESERVED')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_CIRCULATING_COPIES', 'message', 'This title has no copies available for circulation.');
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

CREATE OR REPLACE FUNCTION public.catalog_import_apply_book(p_item uuid, p_lease uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i public.catalog_import_items;
  target uuid;
  v_copy_ids jsonb;
BEGIN
  SELECT * INTO i FROM public.catalog_import_items WHERE id = p_item FOR UPDATE;
  IF i.lease IS DISTINCT FROM p_lease OR i.status <> 'processing' THEN
    RAISE EXCEPTION 'Import lease expired';
  END IF;
  target := i.book_id;
  IF target IS NULL AND i.mode = 'enrich' THEN
    RAISE EXCEPTION 'Original book no longer exists';
  END IF;
  IF target IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('catalog-isbn-' || i.isbn, 0));
    SELECT id INTO target FROM public.books WHERE upper(regexp_replace(isbn, '[[:space:]-]', '', 'g')) = i.isbn LIMIT 1 FOR UPDATE;
    IF target IS NULL THEN
      IF NULLIF(p_data->>'title', '') IS NULL THEN
        RETURN NULL;
      END IF;
      INSERT INTO public.books(title, author, isbn, is_active)
      VALUES (p_data->>'title', COALESCE(p_data->>'author', ''), i.isbn, true)
      RETURNING id INTO target;
    END IF;
  END IF;
  UPDATE public.books SET
    title = COALESCE(NULLIF(title, ''), p_data->>'title', ''),
    author = COALESCE(NULLIF(author, ''), p_data->>'author', ''),
    description = COALESCE(NULLIF(description, ''), NULLIF(p_data->>'description', '')),
    dewey_decimal = COALESCE(NULLIF(dewey_decimal, ''), NULLIF(p_data->>'dewey_decimal', '')),
    published_year = COALESCE(published_year, NULLIF(p_data->>'published_year', '')::integer),
    tags = CASE WHEN COALESCE(cardinality(tags), 0) > 0 THEN tags ELSE ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'tags', '[]'))) END,
    updated_at = NOW()
  WHERE id = target;
  IF NOT i.copies_applied AND i.mode = 'create' THEN
    WITH created AS (
      INSERT INTO public.book_copies(book_id, status)
      SELECT target, 'AVAILABLE' FROM generate_series(1, i.requested_copies)
      RETURNING id
    )
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_copy_ids FROM created;
    IF jsonb_array_length(v_copy_ids) > 0 THEN
      INSERT INTO public.audit_logs AS audit (id, admin_id, entity_type, entity_id, action, reason, details)
      SELECT i.job_id, j.created_by, 'book_copy', NULL, 'create_isbn_import',
        'Created copies from an ISBN import',
        jsonb_build_object('bookIds', jsonb_build_array(target), 'copyIds', v_copy_ids, 'copiesCount', jsonb_array_length(v_copy_ids), 'jobId', i.job_id)
      FROM public.catalog_import_jobs j WHERE j.id = i.job_id
      ON CONFLICT (id) DO UPDATE SET details = audit.details || jsonb_build_object(
        'bookIds', (audit.details->'bookIds') || (EXCLUDED.details->'bookIds'),
        'copyIds', (audit.details->'copyIds') || (EXCLUDED.details->'copyIds'),
        'copiesCount', (audit.details->>'copiesCount')::int + (EXCLUDED.details->>'copiesCount')::int);
    END IF;
  END IF;
  UPDATE public.catalog_import_items
  SET book_id = target, copies_applied = true, title = (SELECT title FROM public.books WHERE id = target)
  WHERE id = i.id;
  RETURN target;
END;
$$;
