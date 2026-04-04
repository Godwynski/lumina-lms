-- Performance Optimization Migration: RLS & Indexing
-- Aligned with the '2026 Ultimate Optimization Checklist'

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. REPORTS TABLE RLS OPTIMIZATION
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins and librarians can view all reports" ON public.reports;

CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins and librarians can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (select auth.uid()) AND role IN ('admin', 'librarian', 'staff')
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. INDEX OPTIMIZATION
-- ──────────────────────────────────────────────────────────────────────────────

-- Composite index for Catalog filtering (Category + Active status)
CREATE INDEX IF NOT EXISTS idx_books_category_active 
  ON public.books (category_id, is_active);

-- Index for borrowing records by status and date (common in dashboard)
CREATE INDEX IF NOT EXISTS idx_borrowing_records_status_date
  ON public.borrowing_records (status, borrowed_at DESC);

-- Index for due date (overdue checks)
CREATE INDEX IF NOT EXISTS idx_borrowing_records_due_date
  ON public.borrowing_records (due_date)
  WHERE status = 'active';

-- Index for violation lookups
CREATE INDEX IF NOT EXISTS idx_violations_user_status
  ON public.violations (user_id, status);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ADDITIONAL PERFORMANCE TWEAKS
-- ──────────────────────────────────────────────────────────────────────────────
-- Ensure all profiles have optimized SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view basic profiles." ON public.profiles;
CREATE POLICY "Authenticated users can view basic profiles."
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
