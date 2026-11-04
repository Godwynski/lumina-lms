# Ponytail Audit — Part 2 (the parts not checked before)

_Date: 2026-11-04 · Scope: UI components, Realtime, session handling, docs, plus running the tests and the build · Report only, no code changed._

**What this repo does:** Lumina LMS is a Next.js + Supabase library system for STI College Alabang. Staff scan QR codes to lend and take back books, students reserve titles and check in to the library, and a daily cron job marks overdue loans and sends emails.

**Load assumed:** one college library with a few staff desks working at once, a few hundred to a few thousand students (many with the app open at the same time during the day), and a catalog of 1,000+ titles, on Vercel Hobby (10-second limit per function run).

Numbers continue from part 1 (`docs/PONYTAIL_AUDIT.md`, findings 1–39). As asked, the demo-access item (part 1, #1) is left out.

**What I ran:**
- `vitest`: 49 files, 1,072 tests, all pass.
- `tsc --noEmit`: clean.
- `eslint`: 1 warning.
- `next build`: passes.

All green, but the tests mock the database, so they can't catch most of what is listed below.

---

## Additions to part 1

- **#3 (everyone can read every profile)** also leaks through Realtime (Supabase's live-update feature that pushes database changes to open browsers). The dashboard (`components/dashboard/DashboardClient.tsx:L160`) and analytics page subscribe to all `profiles` changes. Because RLS on `profiles` is `USING (true)`, every open browser receives the full changed row, including phone and address, whenever any profile changes. Fixing #3 fixes this too.
- **#6 (server downloads any URL)** has a fourth place: `uploadCoverFromUrl` in `lib/actions/catalog/import-export.ts:L39-85` fetches the ISBN cover URL with no checks and no size limit. Use the same shared `fetchImage` helper.

---

## Must fix

### 40. Users get logged out at random: there is no session-refresh proxy
`lib/supabase/server.ts:L20-27`; missing `proxy.ts` (it was deleted as "deprecated middleware" in commit `87bf0f8`); `hooks/use-notifications.ts:L49-51`

- **What this is:** Supabase login uses a short-lived access token (1 hour) plus a refresh token in cookies. On the server, only Next.js middleware (called `proxy.ts` in Next 16) can write refreshed cookies back to the browser.
- **Problem:** There is no middleware or proxy. When a user comes back after an hour, a server component refreshes the token. It can't save the new cookies (`setAll` swallows the error in an empty `catch`), so the browser keeps the old refresh token. Supabase treats the reuse of an already-used refresh token as theft and ends the session, so the user is kicked to the login page on the next navigation. `use-notifications.ts` even says "the middleware already refreshes the session", but that file no longer exists.
- **Fix:** Add `proxy.ts` at the root using the standard `@supabase/ssr` `updateSession` pattern (about 30 lines: create the server client with request/response cookies, call `supabase.auth.getUser()`, return the response). Set a matcher that skips static files.
- **If we skip it:** Staff and students get logged out mid-shift, often in the middle of a checkout.

### 41. Batch import times out halfway, and retrying doubles the copies
`lib/actions/catalog/import-export.ts:L114-320`; `components/inventory/ModernInventoryClient.tsx:L183-215`, `L244-260`

- **What this is:** The inventory page imports up to 500 books from a spreadsheet in one server action.
- **Problem:** Each row makes 2–3 database calls one after another (insert book, insert copies, maybe create category). 500 rows is 1,000–1,500 round trips, far more than the 10-second limit allows. The import stops partway, the user sees an error, and the books written so far stay. When the user uploads the file again, every row that was already imported counts as a "duplicate" and gets its copies **added again**. Importing the same file twice always doubles the copies. Also, `stock` has no upper limit (`addBookCopies` caps at 50, but import doesn't), so a typo like `10000` creates 10,000 copies. And the import writes no audit log.
- **Fix:**
  - Insert all new books in one `insert([...])` call, then all their copies in one more.
  - Treat a duplicate as "skip", not "add copies". Make adding copies to existing books a separate checkbox that is off by default.
  - Cap `stock` at 50, as `addBookCopies` does.
  - Write one audit entry with the counts.
- **If we skip it:** Large imports fail, and inventory counts quietly go wrong.

---

## Should fix

### 42. Live updates trigger refresh storms
`app/(authenticated)/student-catalog/StudentCatalogClient.tsx:L70-105`; `app/(authenticated)/analytics/AnalyticsClient.tsx:L60-82`; `components/catalog/BookDetailModal.tsx:L281-300`; `app/(authenticated)/users/[id]/UserDetailClient.tsx:L46-110`

- **What this is:** These pages subscribe to every change on `books`, `book_copies`, `borrowing_records`, `reservations`, etc., and call `router.refresh()` (re-run the whole server page) on each event.
- **Problem:** There is no debounce (waiting a moment so that many events cause only one refresh). The dashboard has one, but these four pages don't. One checkout fires at least 2 events (the `book_copies` update, plus the `books` count update from the `fn_sync_book_counts` trigger). If 200 students have the catalog open, one checkout causes 400+ full page reloads on the server. A 300-book import causes hundreds of thousands. On the analytics page, every attendance scan at the gate reloads a full year of data. Every subscriber also makes Supabase run an RLS check per event, which loads the database.
- **Fix:** Copy the 500 ms `debouncedRefresh` from `DashboardClient.tsx:L105-114` into these four pages. On the student catalog, drop the `book_copies` and `borrowing_records` listeners. The `books` count columns already change when a copy is lent or returned, and students only receive their own loan events anyway.
- **If we skip it:** The site slows down for everyone at peak hours and burns through Supabase and Vercel limits.

### 43. Holding a card in front of the gate camera times the student in and then out
`lib/actions/attendance.ts:L84-150`; `app/(authenticated)/attendance/AttendanceClient.tsx:L84`

- **What this is:** One scan toggles attendance: if the student is timed in, the scan times them out, and otherwise it times them in.
- **Problem:** The only guard is a 2.5-second check in the browser. A student who holds the card up for 3 seconds, or scans again because no beep was heard, is timed in and immediately timed out. Two gate devices scanning the same card at once can also race.
- **Fix:** On the server, if the open record is less than 60 seconds old, return "Already timed in" instead of timing out.
- **If we skip it:** Attendance shows a lot of 3-second visits, and students have to scan again.

### 44. The return screen never shows the due date
`supabase/schema_clean_install.sql:L906-913` (return preview); `hooks/use-circulation-wizard.ts:L136-147`; `components/circulation/CirculationWizard.tsx:L119-120`

- **What this is:** Before confirming a return, staff see a review card with the "borrowed" and "due" dates.
- **Problem:** In preview mode, the SQL returns only `book_title` and `student_name`. So the return review always shows "Due date: N/A", never shows the borrowed date, and never warns that the book is overdue. On checkout, the due date is shown as a raw timestamp (`2026-11-18T03:12:44.12+00:00`).
- **Fix:** Add `'borrowed_at', v_borrow.borrowed_at, 'due_date', v_borrow.due_date` to the preview JSON. Format both dates with `format(new Date(d), 'MMM dd, yyyy')` in the hook.
- **If we skip it:** Staff can't see at the desk that a returned book is late.

### 45. A failed avatar upload deletes the old photo
`components/settings/profile/AvatarManager.tsx:L58-87`

- **What this is:** Changing the profile photo.
- **Problem:** The code deletes all existing files in the user's avatar folder first, then uploads the new one. If the upload fails (network drop, file too big), the old file is gone, but `profiles.avatar_url` still points to it. The user and their library card show a broken image.
- **Fix:** Upload the new file first, call `updateAvatarUrl`, and only then remove the old files (all except the new name).
- **If we skip it:** Users lose their photo on a bad connection.

### 46. Spreadsheet import drops leading zeros from ISBNs
`components/inventory/ModernInventoryClient.tsx:L183-210`

- **What this is:** `XLSX.utils.sheet_to_json(worksheet)` reads cells as raw values.
- **Problem:** Excel stores an ISBN like `0131103628` as a number, so it comes through as `131103628`. The book is saved with a wrong ISBN, and the duplicate check misses the existing book.
- **Fix:** Use `sheet_to_json(worksheet, { raw: false, defval: "" })` to get the displayed text.
- **If we skip it:** Wrong ISBNs and duplicate books.

### 47. Six database tables are not used by the app
`supabase/schema_clean_install.sql:L223-270`, `L1377-1432`; `types/database.ts`

- **What this is:** `announcements`, `reports`, `deleted_profile_info`, `rate_limit_log`, `checklist_items` and `checklist_dropdown_options`. Each has its own RLS policies, indexes, seed data, and (for some) a Realtime publication.
- **Problem:** No app code reads or writes any of them (grep over `app`, `components`, `lib` and `hooks`; announcements go through `/api/notifications/bulk`, not the table). `reports` still lets any student insert rows with no limit, even though there is no UI for it. `rate_limit_log` is described in `docs/DATABASE_AUDIT.md` as "brute-force protection", but nothing writes to it, so there is no rate limiting.
- **Fix:** Drop the six tables, their policies and publication entries, and their lines in `seed.ts`, `clean.ts` and `types/database.ts`. Or build the feature if one of them is planned.
- **If we skip it:** More schema to secure and explain, and docs promise protections that don't exist.

### 48. After the annual reset, every student must be re-activated by hand
`app/api/admin/annual-reset/route.ts`; `app/(authenticated)/users/[id]/UserDetailClient.tsx:L148-200`

- **What this is:** Annual reset suspends all students. The only way back is opening each student's page and saving it as ACTIVE.
- **Problem:** With 2,000 returning students, that is 2,000 page visits and saves, and until then none of them can borrow or reserve.
- **Fix:** On the Users page, add a bulk "Re-activate selected" action (one RPC: `update profiles set status = 'ACTIVE' where id = any($1)`, plus their cards). Or make the reset only flag students for review instead of suspending them.
- **If we skip it:** The circulation desk is blocked at the start of every school year.

### 49. The docs claim protections the code doesn't have
`README.md` ("RLS 100% Hardened", "tamper-evident" audit), `docs/DATABASE_AUDIT.md` (rate-limit "brute-force protection"), `docs/ENTERPRISE_SAAS_QA_CHECKLIST.md` (API keys, `/developer/rate-limits`)

- **What this is:** About 240 KB of docs, and one test (`test/challenger-m2-rls-hardening.test.ts:L190`) that checks the docs say "100% (Hardened)".
- **Problem:** Part 1 findings 2, 3, 12, 20 and 23, plus #47 here, show these claims are false. Pages like `/developer/rate-limits` don't exist. A thesis panel or a new developer will trust the docs.
- **Fix:** After fixing the code, rewrite the security sections to describe what is actually there. Delete the checklist sections for features that don't exist, and delete the test that checks doc text.
- **If we skip it:** The documentation misleads reviewers.

---

## Nice to have

### 50. Live-update listeners that never fire
`components/providers/PreferencesProvider.tsx:L134-149`; `hooks/use-notifications.ts:L103-115`

- **What this is:** A listener on `ui_preferences`, and a DELETE listener on `notifications` filtered by `user_id`.
- **Problem:** `ui_preferences` is not in the Realtime publication (`schema_clean_install.sql:L1421-1432`), so its listener never gets events. Supabase can't filter DELETE events by column, and nothing deletes notifications anyway. Both cost an open subscription per tab for nothing.
- **Fix:** Delete both listeners (about 30 lines).
- **If we skip it:** Wasted connections and confusing code.

### 51. The unread badge stops counting at 50
`hooks/use-notifications.ts:L28-40`

- **What this is:** The bell's unread count is computed from the latest 50 notifications loaded in the browser.
- **Problem:** A student with 80 unread notifications sees at most "50", and the count drops as old ones scroll out.
- **Fix:** Get the count with `select('id', { count: 'exact', head: true }).eq('is_read', false)`.
- **If we skip it:** The count is wrong for heavy users.

### 52. The card component is written out eight times
`components/library/MyCardContainer.tsx:L360-630`

- **What this is:** `<DigitalCard …/>` is rendered 8 times (front/back × screen/export × two layouts), each with the same 13 props.
- **Problem:** Adding or renaming one card field means editing 8 places, and missing one makes the exported PNG differ from the screen.
- **Fix:** Build `const cardProps = {…}` once and render `<DigitalCard {...cardProps} side="front" />`. That saves about 100 lines.
- **If we skip it:** Easy drift between the screen and the exported card.

### 53. The `/catalog` route is dead code
`app/(authenticated)/catalog/page.tsx`, `app/(authenticated)/catalog/layout.tsx`

- **What this is:** The layout always redirects (to `/inventory` for librarians, `/student-catalog` for everyone else), so `page.tsx` and its own redirect never run.
- **Problem:** Two files exist only to redirect. A plain redirect does the same job in one place.
- **Fix:** Delete both and add `{ source: '/catalog', destination: '/student-catalog', permanent: false }` to `next.config.ts` redirects. Librarians already have `/inventory` in the nav. (Keep `CatalogContent.tsx`; `/inventory` imports it.)
- **If we skip it:** Minor clutter.

### 54. Lint warning in user detail
`app/(authenticated)/users/[id]/UserDetailClient.tsx:L111`

- **What this is:** ESLint reports `startTransition` as an unneeded `useEffect` dependency.
- **Problem:** It is harmless today, but it is the only lint warning, and it hides new ones in CI output.
- **Fix:** Remove `startTransition` from the dependency array.
- **If we skip it:** Noise in CI.

---

**Verdict:** Fix #40 first (add `proxy.ts`), since random logouts hit every user every day. Then #41 (import) and #42 (refresh storms), which break at normal school load. The rest can follow part 1's order.

**Lean:** about −600 lines possible here (six unused tables with their policies and seeds, dead listeners, the repeated card component, the dead catalog route, doc-checking tests). Combined with part 1: about −2,000 lines. No extra dependencies to drop beyond part 1.

**What was checked in this pass:**
- **UI:** the circulation wizard, the scanner hook, the attendance gate, inventory import, the avatar upload, my-card, notifications, the user detail editor, page guards for every authenticated route, and the settings actions.
- **Realtime:** all 16 subscriptions, plus the publication list.
- **Session handling:** the server and browser Supabase clients.
- **Docs:** the claims checked against the code.
- **Runs:** the test suite, typecheck, lint, and a production build.

**Not checked:**
- Pure layout and styling components (`components/ui/*`, `hero.tsx` visuals, charts).
- Accessibility.
- How the app behaves on real phones and cameras.
- Anything against a live Supabase project: findings 40, 42 and 47 come from reading the code and Supabase's documented behavior, not from watching it happen.
