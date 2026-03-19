-- Harden settings/category infrastructure for production workflows.

-- Ensure canonical policy rows exist for settings UI and operational jobs.
INSERT INTO public.system_settings (key, value, description, data_type, updated_by)
SELECT
  s.key,
  s.value,
  s.description,
  'number',
  p.id
FROM (
  VALUES
    ('default_loan_period_days', '14', 'Default loan period in days'),
    ('max_borrow_limit', '5', 'Maximum books a student can borrow'),
    ('max_renewal_count', '3', 'Maximum renewals per borrowing record'),
    ('hold_expiry_days', '7', 'Days to hold a reserved book'),
    ('renewal_period_days', '14', 'Renewal extends due date by N days'),
    ('card_validity_years', '4', 'Library card validity in years'),
    ('overdue_fine_per_day', '0.50', 'Fine per day for overdue books (currency)'),
    ('fine_cap_amount', '50.00', 'Maximum fine per book (currency)')
) AS s(key, value, description)
CROSS JOIN LATERAL (
  SELECT id
  FROM public.profiles
  WHERE role IN ('admin', 'librarian')
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
) p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.system_settings existing
  WHERE existing.key = s.key
)
ON CONFLICT (key) DO NOTHING;

-- Ensure settings table has RLS + policies for admin/librarian writes and authenticated reads.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_settings'
      AND policyname = 'Authenticated can read system_settings'
  ) THEN
    CREATE POLICY "Authenticated can read system_settings"
      ON public.system_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_settings'
      AND policyname = 'Admin librarian can mutate system_settings'
  ) THEN
    CREATE POLICY "Admin librarian can mutate system_settings"
      ON public.system_settings
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'librarian')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'librarian')
        )
      );
  END IF;
END $$;

-- Keep updated_at fresh for setting updates.
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Categories consistency guards used by settings category module.
ALTER TABLE public.categories
  ALTER COLUMN is_active SET DEFAULT TRUE;

UPDATE public.categories
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE public.categories
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_is_active_name
  ON public.categories (is_active, name);
