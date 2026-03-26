-- Add address column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.address IS 'Residential or mailing address of the user.';

-- Note: The phone column already exists in the profiles table.
