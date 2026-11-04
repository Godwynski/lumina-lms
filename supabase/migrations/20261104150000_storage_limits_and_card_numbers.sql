-- B3.4 (docs/AUDIT_CHECKLIST.md). Mirrored in supabase/schema_clean_install.sql.
-- C6: size and type limits on the public image buckets (the app only uploads JPEG/WebP there).
-- C5: the library-cards bucket holds the card QR images, so it becomes private (served through
--     signed URLs), and card numbers stop being the student ID: the QR encodes the card number,
--     so it must not be guessable. Old QR images stay in the bucket but encode numbers that no
--     longer exist.
BEGIN;

UPDATE storage.buckets
SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'book-covers');

UPDATE storage.buckets SET public = false WHERE id = 'library-cards';

-- Same format as handle_new_user. Every existing card gets a new random number.
UPDATE public.library_cards
SET card_number = 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    updated_at = now()
WHERE card_number NOT LIKE 'LIB-%';

COMMIT;
