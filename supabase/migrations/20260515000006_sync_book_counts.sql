-- Migration: Synchronize Book Counts
-- Description: Adds triggers to automatically update total_copies and available_copies on the books table.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.fn_sync_book_counts()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_sync_book_counts ON public.book_copies;
CREATE TRIGGER tr_sync_book_counts
AFTER INSERT OR UPDATE OR DELETE ON public.book_copies
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_book_counts();

-- 3. Initial synchronization for all existing books
UPDATE public.books b
SET 
    total_copies = (SELECT COUNT(*) FROM public.book_copies bc WHERE bc.book_id = b.id),
    available_copies = (SELECT COUNT(*) FROM public.book_copies bc WHERE bc.book_id = b.id AND bc.status = 'AVAILABLE'),
    updated_at = NOW();
