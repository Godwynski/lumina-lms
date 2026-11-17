-- GAP-027: anon can no longer read book_copies (QR strings) or system_settings.
-- Notifications: users may delete their own (the "Clear read" button).

DROP POLICY IF EXISTS "Book copies are viewable by everyone" ON public.book_copies;
DROP POLICY IF EXISTS "Book copies are viewable by signed-in users" ON public.book_copies;
CREATE POLICY "Book copies are viewable by signed-in users" ON public.book_copies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System settings are viewable by everyone" ON public.system_settings;
DROP POLICY IF EXISTS "System settings are viewable by signed-in users" ON public.system_settings;
CREATE POLICY "System settings are viewable by signed-in users" ON public.system_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
