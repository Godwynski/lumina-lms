
-- Fix library_cards status consistency and constraints
ALTER TABLE public.library_cards 
  DROP CONSTRAINT IF EXISTS library_cards_status_check;

ALTER TABLE public.library_cards
  ADD CONSTRAINT library_cards_status_check 
  CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'EXPIRED'::text, 'ARCHIVED'::text]));

-- Fix default value to uppercase to match constraint
ALTER TABLE public.library_cards 
  ALTER COLUMN status SET DEFAULT 'PENDING';

-- Update existing records to uppercase
UPDATE public.library_cards 
SET status = UPPER(status);

-- Fix profile status check to include ARCHIVED if missing (though it might already be there)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text, 'GRADUATED'::text, 'DELETED'::text, 'ARCHIVED'::text]));
