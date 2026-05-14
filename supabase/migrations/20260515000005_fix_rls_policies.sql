-- Migration: Fix RLS Policies for Staff Access
-- Objective: Restore visibility for borrow history and other locked-down tables for staff members.

-- Helper function to check if user is staff (avoiding repetition)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'librarian', 'staff', 'student_assistant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. borrowing_records
CREATE POLICY "Staff can view all borrowing records" ON public.borrowing_records
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can update borrowing records" ON public.borrowing_records
  FOR UPDATE TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can insert borrowing records" ON public.borrowing_records
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- 2. reservations
CREATE POLICY "Users can view own reservations" ON public.reservations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can manage reservations" ON public.reservations
  FOR ALL TO authenticated USING (public.is_staff());

-- 3. system_settings
CREATE POLICY "System settings are viewable by everyone" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage system settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.is_staff());

-- 4. audit_logs
CREATE POLICY "Staff can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true); -- Usually inserted by triggers/actions

-- 5. renewals
CREATE POLICY "Users can view own renewals" ON public.renewals
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM borrowing_records 
      WHERE borrowing_records.id = renewals.borrowing_record_id 
      AND borrowing_records.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all renewals" ON public.renewals
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can manage renewals" ON public.renewals
  FOR ALL TO authenticated USING (public.is_staff());

-- 6. reports
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can manage reports" ON public.reports
  FOR ALL TO authenticated USING (public.is_staff());

-- 7. checkout_idempotency & return_idempotency
CREATE POLICY "Staff can manage checkout idempotency" ON public.checkout_idempotency
  FOR ALL TO authenticated USING (public.is_staff());

CREATE POLICY "Staff can manage return idempotency" ON public.return_idempotency
  FOR ALL TO authenticated USING (public.is_staff());

-- 8. deleted_profile_info
CREATE POLICY "Staff can view deleted profile info" ON public.deleted_profile_info
  FOR SELECT TO authenticated USING (public.is_staff());

-- 9. rate_limit_log
CREATE POLICY "Staff can view rate limit logs" ON public.rate_limit_log
  FOR SELECT TO authenticated USING (public.is_staff());
