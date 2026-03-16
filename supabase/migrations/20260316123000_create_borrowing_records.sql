CREATE TABLE IF NOT EXISTS public.borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  renewal_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrowing_records_user_status
  ON public.borrowing_records(user_id, status);

CREATE INDEX IF NOT EXISTS idx_borrowing_records_copy_status
  ON public.borrowing_records(book_copy_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_records_active_copy
  ON public.borrowing_records(book_copy_id)
  WHERE status = 'active';

ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'borrowing_records'
      AND policyname = 'Allow authenticated full access to borrowing_records'
  ) THEN
    CREATE POLICY "Allow authenticated full access to borrowing_records"
      ON public.borrowing_records
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
