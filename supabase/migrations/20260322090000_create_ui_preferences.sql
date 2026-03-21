-- Store per-user UI preferences in Supabase instead of localStorage

CREATE TABLE IF NOT EXISTS public.ui_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ui_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ui_preferences'
      AND policyname = 'Users can read own ui_preferences'
  ) THEN
    CREATE POLICY "Users can read own ui_preferences"
      ON public.ui_preferences
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ui_preferences'
      AND policyname = 'Users can upsert own ui_preferences'
  ) THEN
    CREATE POLICY "Users can upsert own ui_preferences"
      ON public.ui_preferences
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_ui_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ui_preferences_updated_at ON public.ui_preferences;
CREATE TRIGGER trg_ui_preferences_updated_at
BEFORE UPDATE ON public.ui_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_ui_preferences_updated_at();
