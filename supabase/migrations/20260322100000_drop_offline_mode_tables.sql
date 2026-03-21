-- Remove offline-mode database artifacts

DROP INDEX IF EXISTS public.idx_offline_sessions_token;
DROP INDEX IF EXISTS public.idx_offline_pins_user_id;

DROP TABLE IF EXISTS public.offline_sessions;
DROP TABLE IF EXISTS public.offline_pins;
