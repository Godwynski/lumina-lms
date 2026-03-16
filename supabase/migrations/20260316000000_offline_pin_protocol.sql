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
