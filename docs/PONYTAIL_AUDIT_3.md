# Ponytail Audit — Part 3 (database proof, accessibility, UI kit, charts)

_Date: 2026-11-04 · Scope: everything parts 1 and 2 listed as "not checked" · Report only, no project code changed._

**What this repo does:** Lumina LMS is a Next.js + Supabase library system for STI College Alabang. Staff scan QR codes to lend and take back books, students reserve titles and check in to the library, and a daily cron job marks overdue loans and sends emails.

**Load assumed:** one college library, a few staff desks, a few hundred to a few thousand students, and 1,000+ titles, on Vercel Hobby.

Numbers continue from part 2 (`docs/PONYTAIL_AUDIT_2.md`, up to #54). Part 1 is `docs/PONYTAIL_AUDIT.md`.

---

## A. The SQL findings, run on a real database

Parts 1 and 2 said the SQL findings came "from reading only". This time I ran them.

**How:** Docker and `psql` are not installed on this machine, so I used **PGlite**: real PostgreSQL compiled to WebAssembly, runnable from Node. I installed it only in my temporary scratchpad folder, not in your project. I loaded your real `supabase/schema_clean_install.sql` with small stand-ins for Supabase's built-in parts:
- the `auth.users` table, and the `auth.uid()` and `auth.jwt()` functions;
- the `storage` tables;
- the `anon`, `authenticated` and `service_role` roles, with Supabase's default grants.

Then I acted as each user type and tried each attack. The schema loaded without errors, and so did `supabase/sample_data.sql` (with book copy counts correct).

Each line below is a real query result, not a guess:

| Finding | What I did | Result |
| :--- | :--- | :--- |
| Part 1 #2 | As a librarian: `UPDATE profiles SET role='student'` on the admin, then `role='super_admin'` on self | **Both succeeded.** Roles became `student` / `super_admin`. |
| Part 1 #3 | As a PENDING outsider (`random.person@gmail.com`): read another student's row | **Got** their email, phone `+63 917 000 0000` and address. A student read all 7 profiles. |
| Part 1 #4 | Inserted an auth user `random.person@gmail.com` | **Profile created automatically** (`student`, `PENDING`), so the callback's domain check never runs. |
| Part 1 #4 | Outsider `fake.555555@gmail.com` signs up first, then `real.555555@alabang.sti.edu.ph` | **Real student's sign-up fails:** `duplicate key value violates unique constraint "profiles_student_id_key"`. |
| Part 1 #4 | Outsider with no student ID runs `UPDATE profiles SET student_id='STU-999999'` on self | **Succeeded.** Anyone can claim an unused real student number. |
| Part 1 #8 | Deleted the `hold_expiry_days` setting, then reserved an available copy | Hold created with **`hold_expires_at: null`**, so it never expires. |
| Part 1 #9 | PENDING outsider calls `create_reservation_atomic` on two books | **Both READY.** The books' `available_copies` went to 0. No status or limit check. |
| Part 1 #13 | Student sets own `full_name` to `<a href="https://evil">Pay</a>` and changes own `email` column | **Succeeded.** |
| Part 1 #15 | Set `loan_period_days = '1.5'`, then checked out | **Checkout fails:** `invalid input syntax for type integer: "1.5"`. |
| Part 1 #20 | Student inserts own attendance dated 30 days ago, 6 hours long | **Inserted.** |
| Part 1 #21 | Student assistant with `permissions = {}` closes a loan with a direct `UPDATE borrowing_records` | **1 row changed.** |
| Part 1 #25 | Super admin sets own role to `librarian` | **Succeeded. 0 super admins left.** |
| Part 1 #28 | Book on loan to student 2: student 1 counts active loans of it | **Student sees 0, staff sees 1**, so "next available" is always empty for students. |
| Part 1 #29 | Borrow limit 1, student has 1 OVERDUE loan, then checks out another | **Checkout allowed.** |
| Part 2 #44 | Return preview | Returns only `{ok, preview, book_title, student_name}`, with **no `due_date` or `borrowed_at`**. |
| Part 2 #47 | Student inserts 500 rows into the unused `reports` table | **Inserted 500.** |

**Things that work correctly (checked, no action needed):**
- A student can't change their own `role`: the trigger blocks it.
- A student can't call `process_qr_checkout` directly: permission denied.
- Returning a book gives the copy to the next person in the queue (`reservation_ready: true`).
- The history function shows a student only their own rows.
- The copy-count trigger stays correct.

### Update to part 1 #32 (tests don't test the real system)

The harness above shows you can test the real SQL without Docker. **Better fix for #32:** add `@electric-sql/pglite` as a dev dependency. Copy the stand-ins plus these checks into one vitest file (`test/db-real.test.ts`). It runs in about 2 seconds in normal CI, with no Supabase project and no Docker. Every row in the table above becomes a test that must fail once its finding is fixed. The harness is at `C:\Users\Godwyn\AppData\Local\Temp\claude\cdb28bc65b220841\c7a08d2e-9f9a-4f24-9ba2-7282dd610a2e\scratchpad\pgtest\run.mjs` if you want to start from it. It is temporary, so copy it out soon.

---

## Should fix

### 55. Much of the small grey text is too faint to read
Used across the app: `text-muted-foreground/40` (53 uses), `/50` (28), `/60` (50), `/70` (20), `/80` (36). There are also 374 uses of 8–10px text (`text-[8px]`, `text-[9px]`, `text-[10px]`).

- **What this is:** Labels, hints and captions drawn in grey at lower opacity, often very small.
- **Problem:** I computed the contrast against your real light-mode colors (`--muted-foreground: 215 16% 38%` on `--background: 210 20% 98%`):
  - full strength: 6.3:1 (fine);
  - `/80`: 3.97:1;
  - `/70`: 3.2:1;
  - `/60`: 2.6:1;
  - `/50`: 2.2:1;
  - `/40`: 1.8:1.

  WCAG AA, the usual accessibility bar, needs 4.5:1 for normal text, so everything at `/80` and below fails. Many of these are also 8–10px, for example the "Waiting for activity..." chart text at `/40` and 9px.
- **Fix:** For text, use plain `text-muted-foreground`, and keep the `/40`–`/60` forms only for icons and decorative lines. Raise text smaller than 11px to `text-[11px]` at minimum. This can be a find-and-replace on `text-muted-foreground/` inside `<span>`, `<p>` and `<label>`.
- **If we skip it:** Many labels are hard to read on a phone in daylight, and it fails an accessibility review.

### 56. The Users list can't be opened with a keyboard
`components/common/LuminaTable.tsx:L108-118`, `L168-176`; used by `app/(authenticated)/users/UsersContent.tsx:L250`

- **What this is:** The users table opens a user when you click a row (`onClick` on a `<tr>` / `<div>`).
- **Problem:** Rows have no `tabIndex`, `role` or key handler, and the row cells contain no link. Keyboard and screen-reader users can't open any user's page. `ModernBookCard` and `StudentBookCard` already do this correctly, with `tabIndex={0}` and `onKeyDown`.
- **Fix:** When `onRowClick` is set, give the row `tabIndex={0}`, `role="button"`, and `onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onRowClick(item)}`. Or render the name cell as a `<Link href={`/users/${id}`}>`.
- **If we skip it:** Staff who use the keyboard (or assistive tech) can't manage users.

### 57. "Popular books" ignores the selected date range
`lib/actions/analytics.ts:L63-67`, `L116-131`; shown in `app/(authenticated)/analytics/AnalyticsClient.tsx:L209-240`

- **What this is:** The analytics page has a 7 days / 30 days / 1 year switch, and a top-5 popular books list.
- **Problem:** The popular-books query takes the last 500 loans with no date filter. With "7 Days" selected, the list still shows the top books from the last 500 loans, which can span months. The other charts on the page do follow the range.
- **Fix:** Add `.gte('borrowed_at', startDate.toISOString())` to that query, or count from `borrowingData`, which already has the range.
- **If we skip it:** The report shows the wrong "popular this week" books.

---

## Nice to have

### 58. Animations ignore the "reduce motion" setting
`components/providers/animation-provider.tsx:L7`; `app/globals.css:L206-215`

- **What this is:** The CSS rule turns off CSS animations for users who chose "reduce motion" in their operating system.
- **Problem:** Most motion here comes from framer-motion, which animates with JavaScript, so the CSS rule doesn't stop it. Page transitions (`NavAnimatePresence`), the landing page stagger and the 3D card flip still play for users who get motion sickness.
- **Fix:** Wrap the provider's children in `<MotionConfig reducedMotion="user">`. One line.
- **If we skip it:** It is uncomfortable for motion-sensitive users.

### 59. Three controls have no name for screen readers
- `components/admin/policies/PolicyLayout.tsx:L464` — dialog with no `DialogTitle`. Radix logs an error, and screen readers announce an unnamed dialog.
- `components/auth/UpdatePasswordForm.tsx:L72-80` — show/hide password button.
- `components/circulation/steps/ScanStep.tsx:L82` — scanning tips help button.

- **What this is:** Icon-only controls, and a dialog without a title.
- **Problem:** A screen reader reads them as just "button" or "dialog", with no purpose.
- **Fix:** Add `aria-label="Show password"` / `aria-label="Scanning tips"`, and a `<DialogTitle className="sr-only">…</DialogTitle>` in the policy dialog.
- **If we skip it:** Small accessibility gaps.

### 60. The security policy allows `eval` in production
`next.config.ts` (`script-src 'self' 'unsafe-inline' 'unsafe-eval' …`)

- **What this is:** The Content-Security-Policy header limits which scripts can run, to blunt XSS (injected scripts).
- **Problem:** `'unsafe-eval'` is only needed by Next's dev server. In production it lets an injected script use `eval()` / `new Function()`, which makes several XSS tricks easier.
- **Fix:** Add `'unsafe-eval'` only when `process.env.NODE_ENV !== 'production'`.
- **If we skip it:** It is a weaker second line of defense if an XSS bug appears.

---

**Verdict:** The database run confirms the part 1 security findings are real (librarian escalation, open profile data, open sign-up, unlimited reservations). Fix those first, then #40 from part 2 (no session-refresh proxy). From this part, #55–57 are the most visible to users.

**Lean:** nothing new to delete in this part. The `components/ui/*` kit is all in use (knip and grep agree). The `sidebar.tsx` (746 lines) is the stock shadcn file, so leave it.

**What was checked in this pass:**
- The full schema and sample data, loaded into real Postgres (PGlite), with 25 checks run as admin, librarian, assistant, student, outsider and service role.
- **Accessibility:** contrast computed from your color tokens, keyboard access on clickable rows and cards, icon-button labels, dialog titles, reduced motion, the `lang` attribute, image `alt` text (none missing), and focus outlines.
- **UI kit:** usage of every `components/ui` file.
- **Charts:** the data processing behind them.
- **Security headers:** the CSP and the other headers in `next.config.ts`.

**Not checked (can't be done from here):**
- **Supabase's hosted services:**
  - Realtime and Storage behavior. PGlite has no Realtime server and no storage API, so part 2 #42 and the public-bucket part of #7 are still from docs and code reading.
  - Auth refresh-token reuse (part 2 #40), which needs the hosted Auth server.
- **Real devices:**
  - Cameras and QR scanning.
  - Dark-mode contrast: I couldn't find the dark color tokens in `globals.css`, so I didn't measure them.
- **Load:** a real load test (many users at once).
