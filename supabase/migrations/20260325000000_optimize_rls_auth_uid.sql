-- Migration: Optimize RLS policies by wrapping auth.uid() in (select auth.uid())
-- This prevents per-row function evaluation in set-returning queries.
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- The index statements are commented out below — apply them manually via the Supabase
-- SQL editor or a separate script (not via supabase db push).

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;

CREATE POLICY "Users can view their own profile."
  ON profiles FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile."
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. BOOKS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
-- Replace any auth.uid() bare calls in book policies.
-- Pattern: only staff/admin users (role in profiles) can write; all auth users can read.

DROP POLICY IF EXISTS "Authenticated users can view active books." ON books;
DROP POLICY IF EXISTS "Staff can manage books." ON books;

CREATE POLICY "Authenticated users can view active books."
  ON books FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Staff check using a subquery to avoid per-row evaluation.
CREATE POLICY "Staff can manage books."
  ON books FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'librarian', 'staff')
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. BORROWING_RECORDS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own borrowing records." ON borrowing_records;
DROP POLICY IF EXISTS "Staff can view all borrowing records." ON borrowing_records;

CREATE POLICY "Users can view their own borrowing records."
  ON borrowing_records FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Staff can view all borrowing records."
  ON borrowing_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'librarian', 'staff')
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. LIBRARY_CARDS TABLE
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own library card." ON library_cards;
DROP POLICY IF EXISTS "Admin and librarians can manage library cards." ON library_cards;

CREATE POLICY "Users can view their own library card."
  ON library_cards FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admin and librarians can manage library cards."
  ON library_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'librarian')
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- MANUAL STEP: Apply indexes with CONCURRENTLY outside of a transaction.
-- Run these in the Supabase SQL Editor (not inside a migration transaction):
-- ──────────────────────────────────────────────────────────────────────────────
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_borrowing_records_user_status
--   ON borrowing_records (user_id, status);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_borrowing_records_status
--   ON borrowing_records (status);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_library_cards_status
--   ON library_cards (status);
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role
--   ON profiles (role);
