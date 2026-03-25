-- Clean up duplicate QR columns in book_copies
-- Drop the qr_code column (keep qr_string as the canonical one)
ALTER TABLE public.book_copies DROP COLUMN IF EXISTS qr_code;

-- Drop the sync trigger if it exists
DROP TRIGGER IF EXISTS trg_sync_book_copy_qr ON public.book_copies;
DROP FUNCTION IF EXISTS public.sync_book_copy_qr();

-- Add comment to clarify qr_string is the canonical field
COMMENT ON COLUMN public.book_copies.qr_string IS 'Canonical QR payload for this copy. Format: QR-N';
