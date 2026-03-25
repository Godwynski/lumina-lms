-- Create violations table for tracking school violations (no money involved)
CREATE TABLE IF NOT EXISTS public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'late_return', 'damaged_book', 'lost_book', 'noise', 'food_drink',
    'disruptive_behavior', 'theft', 'talking_loudly', 'phone_usage',
    'unauthorized_area', 'policy_violation', 'other'
  )),
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'major', 'severe')),
  points INTEGER NOT NULL DEFAULT 1 CHECK (points >= 0),
  description TEXT NOT NULL,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'appealed', 'expired')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own violations"
  ON public.violations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Librarians can manage violations"
  ON public.violations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'librarian', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'librarian', 'staff')
    )
  );

CREATE INDEX IF NOT EXISTS idx_violations_user_id ON public.violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON public.violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_status ON public.violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON public.violations(created_at DESC);

CREATE OR REPLACE FUNCTION public.update_violations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_violations_updated_at ON public.violations;
CREATE TRIGGER trg_violations_updated_at
BEFORE UPDATE ON public.violations
FOR EACH ROW EXECUTE FUNCTION public.update_violations_updated_at();

-- Drop old fines table if exists
DROP TABLE IF EXISTS public.fines CASCADE;
