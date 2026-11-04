# Ponytail Audit — Lumina LMS (full list)

_Date: 2026-11-04 · Scope: whole repo, second pass · Report only, no code changed._

**What this repo does:** Lumina LMS is a Next.js + Supabase library system for STI College Alabang. Staff scan QR codes to lend and take back books, students reserve titles and check in to the library, and a daily cron job marks overdue loans and sends emails.

**Load assumed:** one college library with a few staff desks working at once, a few hundred to a few thousand students, and a catalog of 1,000+ titles, on Vercel Hobby (10-second limit per function run).

This version lists **every problem found** (no 20-item cap). Numbers are stable, so you can say "fix 3 and 12".

---

## Must fix

### 1. Anyone on the internet can log in as Super Admin with one click
`components/hero.tsx:L42-61`, `L130-170`; `README.md:L414-425`

- **What this is:** The public landing page has "Quick Demo Access" buttons. They sign in as `admin@lumina.test` / `librarian@lumina.test` / … with the password `Password123!`, which is written in the browser code and in the README.
- **Problem:** The block is wrapped in `{true && (…)}`, so it always shows, even in production (the comment above it says "Hide"). Any visitor becomes super admin. From there they can suspend every student (annual reset), forge audit logs, and read all personal data.
- **Fix:** Show the block only when `process.env.NEXT_PUBLIC_DEMO_MODE === "true"`. Change the demo passwords in Supabase, or delete those accounts on any database that holds real data.
- **If we skip it:** The whole system is open to anyone who visits the site.

### 2. A librarian can make themselves super admin
`supabase/schema_clean_install.sql:L1181-1196` (policy "Admins can update profiles"), `L514-532` (`fn_guard_profile_updates`)

- **What this is:** Database rules (RLS, "row-level security") decide who may edit which rows in `profiles`.
- **Problem:** The rule and the trigger let any librarian edit any column on any profile. A librarian can open the browser console and run `supabase.from('profiles').update({role:'super_admin'}).eq('id', me)`. The checks in the API never run, because this call goes straight to the database.
- **Fix:** In the trigger, let only `super_admin` (or the service role) change `role` and `permissions`, or change a `super_admin` row. Librarians fall through to the same checks students get.
- **If we skip it:** Any librarian account can take over the whole system.

### 3. Every logged-in user can read every profile
`schema_clean_install.sql:L1167-1169`

- **What this is:** The SELECT rule on `profiles` is `USING (true)`.
- **Problem:** Using the public anon key, any signed-in user can download all emails, student IDs, phone numbers, addresses and staff permissions with one query. Because of finding 4, "signed-in user" includes anyone with a Microsoft account.
- **Fix:** Use `USING (id = auth.uid() OR public.is_staff())`. If students need other people's names (for example on the activity ticker), expose a view with only those columns.
- **If we skip it:** Personal data of every student leaks. That is a Data Privacy Act problem, and it is easy to find.

### 4. The school-email check never runs, so anyone can sign up
`app/(auth)/callback/route.ts:L39-75`; `schema_clean_install.sql:L480-512` (trigger `handle_new_user`), `L367-420` (`auto_set_student_id`)

- **What this is:** After Microsoft sign-in, the callback is meant to reject emails that are not `@alabang.sti.edu.ph` (or `@lumina.test`).
- **Problem:** The check only runs when no profile exists yet. But the database trigger `handle_new_user` creates the profile the moment the auth user is created, before the callback runs. So the check (and the profile insert below it) is dead code, and any personal Microsoft account gets in as a PENDING student. There is a second problem: the student-ID trigger also takes digits from non-school emails. If `anything.376536@outlook.com` signs up first, it takes `STU-376536`. The unique constraint on `student_id` then makes the real student's sign-up fail.
- **Fix:** Enforce the domain inside `handle_new_user` (raise an exception when the domain is not allowed), and only parse student numbers from `sti.edu.ph` emails. Then delete the dead branch in the callback.
- **If we skip it:** Outsiders get accounts (and with finding 3, all student data), and real students can be locked out of signing up.

### 5. Open redirect in the login links
`app/(auth)/callback/route.ts:L12`, `L91`; `app/(auth)/confirm/route.ts:L12`, `L23`

- **What this is:** Both routes send the user to the `next` query value after login.
- **Problem:** `next` is never checked. `/confirm?…&next=https://evil.com` redirects straight there. `/callback?…&next=@evil.com` builds `https://stilumina.vercel.app@evil.com`, which also lands on evil.com. A phishing email can use a real Lumina login link that ends on a fake page.
- **Fix:** Accept `next` only if it starts with `/` and not `//` or `/@`; otherwise use `/dashboard`. Two lines in each route.
- **If we skip it:** Your domain can be used to make phishing links look trusted.

### 6. The server will download any URL it is given
`lib/actions/profile.ts:L10-45` → `lib/library-card-assets.server.ts:L155-182`; `app/api/upload/route.ts:L45-110`; `app/api/catalog/export/covers/route.ts:L46-70`

- **What this is:** Three places make the server download a URL. `updateAvatarUrl` is a server action (a server function the browser can call directly) that any student can call with any URL, and the server then downloads it for the card photo. `/api/upload` downloads cover URLs for staff. The cover export downloads every book's `cover_url`.
- **Problem:** The first two only check the hostname text. They miss `172.17-31.*`, IPv6 `[::1]`, DNS names that point to private IPs, and redirects (`fetch` follows them). The cover export has no check at all. None of them limit size: the whole body goes into memory, so a link to a 2 GB file can crash the function. Also, if `sharp` fails, `/api/upload` stores the raw bytes labeled as WebP. The `avatars` and `book-covers` buckets have no type or size limit.
- **Fix:** Make one shared `fetchImage(url)` helper that all three use: `redirect:'error'`, reject if `content-length` is over 5 MB, stop reading past 5 MB, and require `image/*`. In `updateAvatarUrl`, accept only URLs on your own Supabase storage domain. Return a 400 when `sharp` fails. Set `file_size_limit` and `allowed_mime_types` on both buckets.
- **If we skip it:** Students can make the server hit internal addresses or run out of memory.

### 7. Library cards can be forged from a student's email
`lib/library-card-assets.server.ts:L234-256`; `schema_clean_install.sql:L1306` (bucket `library-cards`, `public: true`); `lib/library-card-assets.ts:L83-90`

- **What this is:** The QR on a student's library card is what staff scan to lend books and log attendance.
- **Problem:** The sign-up trigger creates a random card number (`LIB-2026-AB12CD34`), but `ensureStaticLibraryCardAssets` then overwrites it with the student ID (`STU-376536`). The student ID is just the digits in the student's email. Anyone can make a QR for any student and borrow books on their account. Separately, the card images live in a public bucket under guessable names (`qr_STU-376536.png`, `profile_STU-376536.webp`). The SQL comment says this bucket is excluded from public read, but files in a public bucket load by direct URL whatever the RLS says.
- **Fix:** Keep the random `LIB-…` card number as the QR payload, and stop overwriting `card_number`. Make the bucket private and serve the images with `createSignedUrl` (short expiry).
- **If we skip it:** Books get borrowed under other students' names, and student photos leak.

### 8. Expired holds skip the waiting line; the queue logic exists four times
`lib/notifications.ts:L196-230`; `lib/actions/reservations.ts:L11-52`; `schema_clean_install.sql:L665-669`, `L851`, `L923-960`

- **What this is:** When a held copy is not picked up, the daily job cancels the hold.
- **Problem:** The job sets the copy to AVAILABLE and does not give it to the next person in the queue. The next person to click "Reserve" gets it, ahead of everyone who was waiting. The job ignores `hold_expires_at` and the `hold_expiry_days` setting (it hard-codes 3 days from `updated_at`), and it writes `CANCELLED` where the SQL writes `EXPIRED`. "Give this copy to the next person" is written separately in `process_qr_return`, in `reassignCopy` (TypeScript), and in `create_reservation_atomic`, and the cron job is missing it. The default hold length is 3 days in one place and 7 in another. If the setting row is missing, the reserve function gets NULL and the hold never expires.
- **Fix:** Write one SQL function, `release_copy(copy_id)`, that gives the copy to the next ACTIVE reservation or marks it AVAILABLE, with one default (`COALESCE(…, 3)`). Call it from return, cancel, cron expiry (`hold_expires_at < now()`), and the copy-status change. Delete `reassignCopy`.
- **If we skip it:** Students lose their place in line, and the admin's hold-days setting does nothing.

### 9. One account can reserve every available copy
`schema_clean_install.sql:L595-690` (`create_reservation_atomic`); `lib/actions/policy-constants.ts:L47` (`max_reservations_per_student`)

- **What this is:** The policies page lets admins set "max reservations per student".
- **Problem:** Nothing reads that setting. The SQL function also blocks only SUSPENDED users, so PENDING and ARCHIVED accounts can reserve too. A script that loops over the catalog turns every AVAILABLE copy into RESERVED for 3 days. With finding 4, an outsider's PENDING account can do this.
- **Fix:** In `create_reservation_atomic`, require `status = 'ACTIVE'`, and count the user's ACTIVE+READY reservations against `max_reservations_per_student`. Return the `RESERVATION_LIMIT` code the API already maps.
- **If we skip it:** One person can empty the shelves.

### 10. Checking out with a student ID always fails
`lib/actions/circulation.ts:L77-97`, `L178-188`

- **What this is:** If no card number matches a scan, `resolveScan` falls back to looking up the student ID.
- **Problem:** For a student ID, it returns the student ID as `cardNumber`. `checkoutBook` then looks up `library_cards` by that value, so the eligibility check is skipped, and the SQL function returns "Library card not found". The screen shows the student as found, and checkout still fails. (Today this is hidden only because of finding 7, which makes card number = student ID. Fixing 7 exposes this bug.)
- **Fix:** In the fallback, return the real `card_number` (look up the card by `user_id`), or drop the fallback.
- **If we skip it:** Staff who type a student ID get a confusing error.

### 11. Each checkout and return writes two audit rows
`lib/actions/circulation.ts:L240-260`, `L354-375`

- **What this is:** The handler calls `logAuditActivity` itself, and it also passes `auditAction` to `createSafeAction`, which logs again.
- **Problem:** The second row has the entity id `"system"` and a generic message.
- **Fix:** Delete `auditAction` and `auditEntity` from both options objects.
- **If we skip it:** The audit log and its exports overcount circulation by 2×.

### 12. Overdue emails can be lost or sent twice
`lib/notifications.ts:L60-190`; `app/api/cron/route.ts:L6`; `app/api/notifications/maintenance/route.ts`

- **What this is:** The daily job marks a loan OVERDUE first, then sends the notice and email (5 at a time over SMTP, the mail-sending protocol). Admins can also run it with a button.
- **Problem:** The function has a 10-second limit. After a holiday, 50+ overdue loans can take longer than that. Loans already marked OVERDUE are never notified again. If the button and the cron run at the same time (or the button is double-clicked), both runs read the same rows, and students get two emails. Errors from the status update are ignored.
- **Fix:** Add an `overdue_notified` flag like `reminder_sent`. Claim each row before sending with `update … set flag = true where id = ? and flag = false returning id`, and only email rows you claimed. Clear the flag if the send fails.
- **If we skip it:** Students miss overdue notices or get duplicates.

### 13. Email HTML injection
`lib/mail.ts:L142-147` and the other templates

- **What this is:** `userName` and `bookTitle` are pasted into the email HTML as-is.
- **Problem:** Students can edit their own `full_name`. A student can set it to `<a href="https://evil">Pay fine here</a>`, and the official library email then carries that link.
- **Fix:** Add a 5-line `escapeHtml()` and wrap each value placed in the HTML with it.
- **If we skip it:** Phishing links get sent under the school's name.

### 14. Changing a copy's status quietly rewrites loans and holds
`lib/actions/catalog/copies.ts:L83-128` (`updateBookCopyStatus`)

- **What this is:** Librarians can set a copy to AVAILABLE, BORROWED, MAINTENANCE or LOST.
- **Problem:** Setting LOST (or MAINTENANCE/AVAILABLE) marks the open loan as **RETURNED** with today's date, so a student who lost a book looks like they returned it. Setting AVAILABLE on a RESERVED copy leaves the READY hold pointing at a copy anyone can now take. Setting BORROWED creates no loan record, so the copy is stuck. Errors from the loan update are ignored.
- **Fix:** Refuse status changes on copies that are BORROWED or RESERVED (tell staff to use Return first). For LOST, set the loan to a `LOST` status, not RETURNED. Drop BORROWED from the allowed values. After a change to AVAILABLE, call `release_copy` from finding 8.
- **If we skip it:** Loan history becomes wrong, and lost books vanish from records.

### 15. A decimal policy value breaks every checkout
`app/api/admin/policy-settings/route.ts:L13-19`; `schema_clean_install.sql:L740-745`

- **What this is:** Policy values are checked with `Number.isFinite`, then read in SQL with `value::INTEGER`.
- **Problem:** Saving `loan_period_days = 1.5` passes validation. Every later checkout then fails with "invalid input syntax for type integer", and so does every return when `hold_expiry_days` is a decimal.
- **Fix:** Add `Number.isInteger(parsed)` for integer settings (add `integer: true` to their config), and reject unknown keys.
- **If we skip it:** One typo on the policies page stops the circulation desk.

### 16. Known-vulnerable dependencies in production code
`package.json` (`npm audit --omit=dev`: 1 critical, 8 high)

- **What this is:** These packages ship with the app.
- **Problem:**
  - `next@16.2.6` has a critical advisory: denial of service and SSRF (server-side request forgery, making the server fetch a URL an attacker chooses) in Server Actions, which this app uses everywhere.
  - `sharp@0.34` has libvips/libheif CVEs. It processes images that students supply (finding 6).
  - `xlsx@0.18.5` has prototype pollution and ReDoS (a crafted regex input that freezes the process) when reading spreadsheets. It parses uploaded files, and npm has no fixed version.
  - `nodemailer`, `zod` and `ws` also have high-severity advisories.
- **Fix:** Run `npm audit fix`, then bump `next` and `sharp` (sharp to 0.35.x). Replace `xlsx` with the SheetJS CDN build (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) or `exceljs`.
- **If we skip it:** Public exploits work against the deployed site.

---

## Should fix

### 17. `/api/users` GET and POST are unused, and POST lets librarians demote the admin
`app/api/users/route.ts:L10-140`

- **What this is:** The UI uses only PATCH on this route. Inviting users goes through `inviteUser` in `lib/actions/users.ts`.
- **Problem:** POST still works. It has none of `inviteUser`'s librarian checks. A librarian can POST the admin's email with `role:"student"` and the admin becomes a PENDING student. If `role` is left out, `role` is set to `null`.
- **Fix:** Delete GET and POST (about 140 lines) and their tests.
- **If we skip it:** A librarian can lock the admin out, and two copies of the invite rules keep drifting.

### 18. Many lists silently stop at 1,000 rows
- `app/api/admin/annual-reset/route.ts:L37-55`
- `lib/actions/analytics.ts:L50-67`
- `lib/actions/catalog/import-export.ts:L123-126`
- `app/api/notifications/bulk/route.ts:L45-55`
- `app/api/admin/audit-logs/export/route.ts:L43`
- `lib/actions/attendance.ts:L186-200`

- **What this is:** Supabase returns at most 1,000 rows per query by default, with no error.
- **Problem:**
  - Annual reset leaves cards past row 1,000 ACTIVE.
  - Analytics on 90 days or 1 year undercounts (100 visits a day passes 1,000 rows in two weeks).
  - Batch import misses duplicates past 1,000 titles and creates them again.
  - "Notify all students" skips students past 1,000.
  - Audit export asks for 5,000 rows but gets 1,000.
  - Attendance "all" shows only 1,000.
- **Fix:**
  - Annual reset: one SQL statement through an RPC.
  - Analytics: count in SQL (`date_trunc` + `group by`).
  - Import: check `.in('isbn', batchIsbns)`.
  - Bulk notify: insert via `insert … select id from profiles` in an RPC.
  - Export and attendance: page through with `.range()`.
- **If we skip it:** Wrong numbers and missing people once the library grows, with no visible error.

### 19. Dates and times use UTC instead of Manila time
`lib/actions/analytics.ts:L145-161`; `app/api/admin/audit-logs/route.ts:L78-79`; `app/api/admin/audit-logs/export/route.ts:L47-48`, `L151`

- **What this is:** Vercel servers run in UTC (8 hours behind Manila).
- **Problem:** The analytics day buckets use `isSameDay` in server time, so a 7:30 AM Manila visit counts as the previous day. The audit date filter uses `T00:00:00.000Z`, so "Nov 4" covers 8 AM Nov 4 to 8 AM Nov 5 Manila time. The export prints UTC times with no zone label.
- **Fix:** Use `+08:00` in the date filters (`${startDate}T00:00:00+08:00`). Format and group with `timeZone: 'Asia/Manila'` (`Intl.DateTimeFormat` or `date-fns-tz`).
- **If we skip it:** Reports and audit searches are off by 8 hours.

### 20. Students can fake their own attendance
`schema_clean_install.sql:L1029-1031`, `L1050-1053`

- **What this is:** The RLS rules "Users can self check-in" and "Users can self check-out".
- **Problem:** Through the anon key, a student can insert attendance rows with any `check_in_at` and edit their own rows. The app only records attendance through staff scans, so these rules are not needed.
- **Fix:** Drop both policies.
- **If we skip it:** Attendance reports can't be trusted.

### 21. Student-assistant permissions are not enforced in the database or in catalog actions
`schema_clean_install.sql:L1073-1116`, `L1221-1224`; `lib/actions/catalog/auth.ts:L8-17`

- **What this is:** `is_staff()` is true for every ACTIVE student assistant (SA), and `assertStaffCatalogAccess` only checks the role.
- **Problem:** An SA without `manage_circulation` can still mark loans RETURNED, or copies AVAILABLE, from the browser console. Any SA can bulk-import books and export the catalog, even though the UI hides inventory from them.
- **Fix:** Limit UPDATE/INSERT on `book_copies`, `borrowing_records` and `reservations` to `super_admin` and `librarian` (the app writes through service-role RPCs anyway). Make `assertStaffCatalogAccess` allow only `super_admin` and `librarian`.
- **If we skip it:** The permission toggles in the UI don't protect anything.

### 22. Permission checks are written by hand in a dozen places, and they disagree
These routes: `upload`, `test-email`, `annual-reset`, `audit-logs` (list, export, import), `notifications/bulk`, `notifications/maintenance`, `catalog/export/covers`, `circulation/reservations`, `admin/categories` (which uses three different styles itself)

- **What this is:** `withAuthApi` (`lib/api-utils.ts`) already handles login, roles, archived accounts and disabled SAs.
- **Problem:**
  - `upload` and `covers` let a deactivated SA through.
  - `annual-reset`, `import` and `bulk` don't reject ARCHIVED accounts.
  - `reservations` lets PENDING and ARCHIVED students reserve.
  - `categories` POST returns 500 "Failed to create category" when the user is not allowed, because `assertRole` throws.
- **Fix:** Wrap each route with `withAuthApi({ allowedRoles: […] })` and delete the copied checks (about 200 lines).
- **If we skip it:** Every new edit fixes one copy and misses the others.

### 23. Super admins can forge audit history
`app/api/admin/audit-logs/import/route.ts:L97-112`

- **What this is:** Import accepts `admin_id` and `created_at` from the uploaded file.
- **Problem:** The README calls the log "tamper-evident", but anyone with import access can backdate entries in another person's name. With finding 1, that is anyone. There is also an empty `if` block at L97.
- **Fix:** Always set `admin_id` to the importer, tag imported rows with `details.imported = true`, and delete the empty `if`. Or remove import.
- **If we skip it:** The audit log can't be trusted as evidence.

### 24. Invite ignores a failed super-admin transfer
`lib/actions/users.ts:L123-135`

- **What this is:** When the super admin hands over the role, `inviteUser` calls `transfer_super_admin_ownership`.
- **Problem:** The call is wrapped in `try {} catch {}` "for unit test environments". Also, `rpc()` returns `{ error }` and doesn't throw, so failures are never noticed. The code then tries to set the target to super_admin anyway, and the user sees a confusing unique-index error instead of the real one.
- **Fix:** `const { error } = await adminClient.rpc(...); if (error) throw error;`. Fix the test mock, not the production code.
- **If we skip it:** Ownership transfer fails with misleading errors.

### 25. The super admin can remove the last super admin
`app/api/users/route.ts:L221-250`, `L255-268`

- **What this is:** PATCH lets the super admin change any profile's role and status, including their own.
- **Problem:** A super admin who sets their own role to `librarian`, or their status to ARCHIVED, leaves the system with no active super admin. Only a database edit can fix that.
- **Fix:** Refuse role or status changes when `id === user.id` and the requester is `super_admin`. They must use the transfer flow.
- **If we skip it:** One misclick needs direct database access to undo.

### 26. Cover export will time out on a real catalog
`app/api/catalog/export/covers/route.ts:L46-77`

- **What this is:** The export downloads every cover at the same moment and builds the ZIP in memory.
- **Problem:** With 500+ books, that is 500 parallel downloads inside a 10-second function, so it times out and the user gets nothing. Books with the same ISBN, or no ISBN and the same title, overwrite each other in the ZIP.
- **Fix:** Download at most 10 at a time, and add `-${index}` to file names. For large catalogs, build the ZIP in the browser from the public cover URLs instead.
- **If we skip it:** The export button stops working once the catalog grows.

### 27. "Sort by availability" shows unavailable books first
`lib/actions/books-core.ts:L83`; `app/(authenticated)/student-catalog/page.tsx:L69` vs `StudentCatalogClient.tsx:L196`

- **What this is:** The student catalog has a sort dropdown.
- **Problem:** The code passes `sortOrder: 'desc'` for availability, then orders with `ascending: sortOrder === 'desc'`, which flips it, so books with 0 copies come first. Also, with no `?sort=` in the URL, the server sorts by "newest" but the dropdown says "Title".
- **Fix:** Use `ascending: sortOrder === 'asc'`, and use the same default (`'newest'`) in both files.
- **If we skip it:** Students see unavailable books first, and the dropdown doesn't match the list.

### 28. Students never see when a book comes back
`lib/actions/reservations.ts:L59-80` (`getBookAvailabilityStatus`)

- **What this is:** The book page shows a "next available" date, taken from the earliest due date of the copies on loan.
- **Problem:** The query uses the student's own database client, and RLS shows a student only their own loans. So `nextAvailableDate` is always empty for students. It only works for staff.
- **Fix:** Read the earliest due date with the admin client (return only the date), or add a small SECURITY DEFINER SQL function.
- **If we skip it:** A promised feature silently doesn't work for its main users.

### 29. Two desks can push a student past the borrow limit
`schema_clean_install.sql:L748-755`

- **What this is:** The limit counts only `status = 'ACTIVE'` loans, and no lock is taken on the student.
- **Problem:** Two desks checking out books for the same student at the same moment can both pass the limit check. Overdue loans also don't count toward the limit in SQL.
- **Fix:** Add `PERFORM pg_advisory_xact_lock(hashtext(v_card.user_id::text));` before the count, and count `IN ('ACTIVE','OVERDUE')`.
- **If we skip it:** It happens rarely at this load, but the limit is not guaranteed.

### 30. `npm run clean` and `npm run seed` wipe whatever database `.env.local` points to
`scripts/clean.ts:L36-60`, `scripts/seed.ts:L40-58`

- **What this is:** Both scripts delete every row from every table, using the service-role key.
- **Problem:** Neither checks which database it is pointed at. If `.env.local` holds production keys, one command erases all real data. Errors from each delete are ignored.
- **Fix:** Exit unless the URL contains `localhost`/`127.0.0.1` or `--yes-really` is passed. Check `error` after each delete.
- **If we skip it:** One mistyped command loses everything.

### 31. Seed data holds what look like real people's phone numbers
`scripts/seed.ts:L18-30`, `L94-101`

- **What this is:** The seed script creates profiles named after the team (Neri, Calinog, Floriano, Dadea, …), with mobile numbers and home areas.
- **Problem:** If these are real numbers, that is personal data committed to git, and it gets copied to every database that is seeded.
- **Fix:** Replace them with clearly fake values (`+63 900 000 0001`, "Sample City").
- **If we skip it:** Privacy exposure for the team, and it can't be removed from git history easily.

### 32. Tests don't test the real system
`test/challenger-m2-rls-hardening.test.ts`; `test/auth-callback.test.ts:L152-200`; all `lib/actions/__tests__`

- **What this is:** All 1,060+ tests use a mocked Supabase.
- **Problem:** The "RLS tests" only match regular expressions against the SQL file's text. One even checks that `docs/DATABASE_AUDIT.md` says "100% (Hardened)". The callback test proves the domain check works on a path that can't happen in production (finding 4). None of the SQL functions or RLS rules ever runs in a test, which is why findings 2, 3, 4, 8, 9 and 20 passed.
- **Fix:** Add one test file that runs against a local Supabase (`supabase start` in CI), with four checks: a librarian can't set `role = 'super_admin'`; a student can't read another profile; returning a reserved book gives it to the next in line; an outside email can't sign up. Delete the tests that only check file text.
- **If we skip it:** The riskiest logic can break with all tests green.

### 33. The password-reset link leads to a 404
`components/auth/ForgotPasswordForm.tsx:L35`

- **What this is:** The reset email sends users to `/auth/update-password`.
- **Problem:** The page lives at `app/(auth)/update-password`. A folder in parentheses is a route group and is not part of the URL, so the real path is `/update-password`. `/auth/update-password` does not exist.
- **Fix:** Change it to `${window.location.origin}/update-password`. One line.
- **If we skip it:** Nobody can reset a password.

---

## Nice to have

### 34. Dead code and tests that only test the mocks
- `components/common/QRScanner.tsx` (297 lines) and `scripts/seed-attendance-today.mjs`: knip found no imports, and grep found references only in old notes under `.agents/`.
- `test/mocks/stress.test.ts` and `test/mocks/query-chaining.test.ts` (about 560 lines): they test the fake Supabase, not the app.
- The profile-insert and domain branch in `app/(auth)/callback/route.ts:L39-75`: unreachable (finding 4).
- The empty `if` in `audit-logs/import/route.ts:L97`.

- **Problem:** This is extra code to read, maintain and run in CI.
- **Fix:** Delete all of it.
- **If we skip it:** Nothing breaks, but it costs time to read.

### 35. Two near-copies of the book search query
`lib/actions/catalog/books.ts:L14-94` (`getBooks`) and `lib/actions/books-core.ts:L19-100` (`fetchBooksCore`)

- **What this is:** Both build the same filtered, sorted, paged `books` query.
- **Problem:** They already disagree. The admin side sorts availability correctly, and the student side has it inverted (finding 27).
- **Fix:** Keep `fetchBooksCore`, add an `includeInactive` flag, and make `getBooks` call it.
- **If we skip it:** Fixes keep landing in only one copy.

### 36. The sitemap lists pages that don't exist
`app/sitemap.ts:L14`, `L20`

- **What this is:** The sitemap includes `/sign-up` and `/search`.
- **Problem:** Neither route exists, so search engines get 404s.
- **Fix:** Remove both entries.
- **If we skip it:** Small SEO noise.

### 37. Search drops letters like ñ
`lib/actions/books-core.ts:L47`

- **What this is:** Long queries are cleaned with `/[^\w\s]/g`.
- **Problem:** In JavaScript, `\w` matches only ASCII letters, so "Peña" becomes "Pe a" and the search finds the wrong books.
- **Fix:** Use `/[^\p{L}\p{N}\s]/gu`.
- **If we skip it:** Filipino names and titles are harder to find.

### 38. Category edits don't refresh the cached list
`app/api/admin/categories/[id]/route.ts` PUT and DELETE

- **What this is:** POST calls `revalidateTag("categories")`, but PUT and DELETE don't.
- **Problem:** A renamed or archived category keeps showing its old state in the catalog filters until the cache expires.
- **Fix:** Add the same `revalidateTag` and `revalidatePath` calls to PUT and DELETE.
- **If we skip it:** Staff think the edit failed.

### 39. Reservations are logged as "borrowing_record"
`app/api/circulation/reservations/route.ts:L100`

- **What this is:** The audit entry for a new reservation.
- **Problem:** It is logged with entity type `borrowing_record`, so filtering the audit log by "Reservations" misses it, and filtering by "Borrowing" shows it.
- **Fix:** Use `"reservation"`.
- **If we skip it:** The audit filters are misleading.

---

**Verdict:** Fix 1 first (public one-click super admin), then 2–7 (privilege escalation, data leak, open sign-up, open redirect, server fetches any URL, forgeable cards). All are small changes. Until they are done, the README's "RLS 100% hardened" claim is wrong, and the site should not hold real student data.

**Lean:** about −1,450 lines possible (unused `/api/users` GET/POST, hand-written auth checks, dead scanner file, tests of mocks and of file text, duplicate search builder, the duplicate queue logic and URL-fetch code). Dependencies: −1 if `xlsx` is replaced by `exceljs`, or swapped for the SheetJS CDN build.

**What was checked:**
- All API routes and all server actions.
- The auth callback and confirm routes, the landing page sign-in, and the authenticated layout gating.
- Mail, notifications/cron, library-card assets, the full SQL schema (functions, triggers, every RLS policy, storage buckets), the seed and clean scripts, the CI workflow and `next.config.ts`.
- A survey of the test suite.
- Tools run: knip, and `npm audit --omit=dev`.

**Not checked:** UI components beyond how they call the server; the Realtime subscription setup; `docs/` content. I did not run the tests, the build, or any SQL against a database. I did not try any finding against the live deployment. Each finding comes from reading the code. The uncommitted `lib/mail.ts` change looks fine, but it does not fix finding 13.
