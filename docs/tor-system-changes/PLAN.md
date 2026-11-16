# TOR System Changes — Implementation Plan

Source: `3_System_Changes_Laymans_Terms.pdf` (20 items agreed with Sir Ricson). Audited against the code on 2026-11-16.
Work is split into 8 work packages (WP). Run them **in order, one at a time** — they share files.

## Gap audit (what the code does today)

| # | Request | Status | Evidence |
|---|---|---|---|
| 1 | Inventory table view + report preview | Missing | `components/inventory/ModernInventoryClient.tsx` has cards + direct export only |
| 2 | Import template download | Missing | Batch Operations → Import shows text only |
| 3 | Export/print High Demand Catalog | Missing | `app/(authenticated)/analytics/AnalyticsClient.tsx:291` has no export |
| 4 | Book price / donated / purchase date | Missing (optional) | no columns anywhere |
| 5 | Library labels on Circulation Desk | Missing | `components/circulation/CirculationWizard.tsx:189-207`, `steps/ReviewStep.tsx:67,79` |
| 6 | Receivable / Paid / Condoned + Settlements | Partial | `fine_amount` + `fine_settled_at` exist; no resolution type, no remarks, tab is "Settled", no export |
| 7 | Block at card scan + override | Partial | `checkUserBorrowingEligibility` (`lib/actions/circulation.ts:17`) runs only in `checkoutBook`; ignores unpaid fines; ignores loans past due that are still `ACTIVE`; no override |
| 8 | Overdue + fine on patron dashboard | Missing | `lib/actions/dashboard.ts:115` fetches only `ACTIVE` loans |
| 9 | Borrowing history in User Directory | Missing | `app/(authenticated)/users/[id]/UserDetailClient.tsx` has no history section |
| 10 | Export & archive old logs | Missing | only `annual-reset` (suspends students) exists |
| 11 | Separate Check-In / Check-Out | Missing | single `toggleAttendanceByCard` (`lib/actions/attendance.ts:27`) |
| 12 | 60-second rule everywhere | Bug | guard is skipped when `isManual` or `confirmed` (`attendance.ts:101`) |
| 13 | Closing-time setting + "No Log Out" label | Partial | `auto_checkout_forgotten_attendance()` hard-codes 17:00; note not shown in table. Bug: a check-in after 17:00 gets a check-out *before* its check-in |
| 14 | Patron / Library Staff naming | Missing | `components/common/RoleBadge.tsx:18` and ~50 files |
| 15 | Inventory OFF by default for staff | Bug | `app/(authenticated)/inventory/page.tsx:40` lets in any SA with circulation/attendance permission; no `manage_inventory` permission exists |
| 16 | Library card for every role | Missing | card only on the student dashboard view; Catalog nav excludes admins (`ProtectedNav.tsx:74`) |
| 17 | Librarians see audit logs minus super admin | Half-open | API allows librarians and RLS shows them **everything**; only the page (`audit/page.tsx:27`) and nav block them |
| 18–20 | Thesis wording | Docs | `docs/user-guide.md`, `README.md`, `THESIS_VS_SYSTEM_ALIGNMENT_AUDIT.md` |

## Decisions (made so work is not blocked — change here if you disagree)

1. **Role rename goes into the database too** (changed 2026-11-16 at the owner's request; WP4 first shipped it display-only). Role values become `patron` and `library_staff`. See WP9.
2. **"Receivable" is derived, not stored**: fine > 0 and `fine_settled_at IS NULL`. Only the resolution (`PAID` / `CONDONED`) is stored.
3. **Override is for `librarian` and `super_admin` only**, needs a typed reason, and writes an audit log row.
4. **Archive moves rows into archive tables** (reversible) after an export; it never touches open loans or receivable fines.
5. **#4 book costing is deferred** to Scope & Limitations, as Sir Ricson allowed. Sketch in WP7.
6. Auto-close runs from the existing daily cron, so forgotten check-outs are closed at the next cron run and stamped with the closing time of their own day.

## Rules for every work package

- Read `AGENTS.md` and `CLAUDE.md` first. This Next.js version has breaking changes: read the matching guide in `node_modules/next/dist/docs/` before touching pages, route handlers or server actions.
- Authorization lives on the server (server action `allowedRoles` / route `withAuthApi`) **and** in RLS. Hiding a button is never the check.
- SQL: add a new file in `supabase/migrations/` (timestamp after `20261116141500`), mirror it in `supabase/schema_clean_install.sql`, add a rollback in `supabase/rollback/`, and cover it in `test/db-*.test.ts` (PGlite).
- Tests are mandatory and behavioral (happy path, bad input, boundary, role checks). No `it.skip`/`.only`/`todo`, no reading `.ts` source in tests, no mocking the unit under test. UI tests use `test/helpers/render.tsx`.
- UI: reuse `components/ui/*`; keep it usable at phone width and in dark mode; every control has an accessible name; keep filter/view state in the URL like the existing pages do.
- Exports reuse the `xlsx` package already used in `ModernInventoryClient.tsx`. Printing uses `window.print()` with a print stylesheet (no new dependency).
- Do not commit, push, or touch files outside the package's scope. Do not start work from another package.
- Finish by running `npx vitest run --exclude '**/.claude/**'` and `npm run typecheck`, then `graphify update .`. End the report with exact pass/fail counts and the line `WP<N> COMPLETE`.

---

## WP1 — Fines: Receivable / Paid / Condoned, Settlements, patron dashboard (#6, #8)

**DB** (`borrowing_records`): add `fine_resolution TEXT CHECK (fine_resolution IN ('PAID','CONDONED'))`, `fine_remarks TEXT`, `fine_settled_by UUID`. Backfill `fine_resolution = 'PAID'` where `fine_settled_at IS NOT NULL`. Add a constraint: resolution and `fine_settled_at` are set together. Update the borrowing-history RPC (the one handling `p_status = 'SETTLED'`, `schema_clean_install.sql` ~line 2136) to return the three new columns and accept an optional resolution filter.

**Server** (`lib/actions/history.ts` `settleBorrowingFine`, `lib/actions/circulation.ts` `returnBook`): take `resolution: 'PAID' | 'CONDONED'` and `remarks`. Remarks are optional for PAID, **required (≥ 5 chars) for CONDONED**, max 500. Store who settled it. Audit log reason says "Paid" or "Condoned" with amount and remarks. Settling twice still fails. The return-and-settle path in the Circulation wizard gets the same two choices.

**UI** (`app/(authenticated)/history/HistoryContent.tsx`, `components/circulation/CirculationWizard.tsx`):
- Unsettled fine shows a **Receivable** badge with the amount.
- Clicking an overdue/receivable record opens a dialog: **Mark as Paid**, **Mark as Condoned**, Remarks box.
- Rename the tab **Settled → Settlements** (keep `status=SETTLED` in the URL so old links work). Inside it: filter **All / Paid / Condoned**, columns for fine amount, resolution, remarks, settled date.
- **Export (xlsx) and Print** buttons on the Overdue and Settlements lists; export uses the current filters, not just the visible page.

**Patron dashboard** (`lib/actions/dashboard.ts:115`, `components/dashboard/ActivitySection.tsx`): "Current Borrows" includes `ACTIVE` and `OVERDUE` loans, overdue first, each with the fine owed so far (`₱…`, via `computeOverdueFine`). Returned loans with a receivable fine stay listed as "Fine owed" until settled. The patron's own Borrow History shows Paid / Condoned in a Settlements filter (read-only, no remarks editing).

**Tests**: PGlite (constraint, backfill, RPC filter, a student cannot update fine columns); action tests (paid, condoned without remarks rejected, double settle, role denied); UI test for the dialog and the Settlements filter; dashboard action returns overdue rows with fine.

## WP2 — Block at card scan + override (#7)

**Server** (`lib/actions/circulation.ts`):
- Make `checkUserBorrowingEligibility` return a result instead of throwing: `{ overdueCount, receivableTotal }`. Overdue = status `OVERDUE` **or** (`ACTIVE` and `due_date < now`). Receivable = sum of fines where `fine_settled_at IS NULL` and fine > 0.
- `resolveScan` (student branch) returns this as `block` so the wizard knows at step 1.
- `checkoutBook` accepts optional `overrideReason` (trimmed, 10–300 chars). If the patron is blocked: no reason → reject as today; reason given and caller is `librarian`/`super_admin` → proceed and write an audit row (`checkout_override`, reason, patron, counts); reason given by `student_assistant` → reject.

**UI** (`hooks/use-circulation-wizard.ts`, `components/circulation/CirculationWizard.tsx`, `MemberPreview.tsx`): right after the card scan, show a blocking panel listing overdue count and receivable total. Staff see only "Start over". Librarian/Super Admin also see **Override** → reason textarea → continue. The reason is carried to `checkoutBook`.

**Tests**: eligibility (overdue status, past-due ACTIVE, receivable fine, clean patron); override allowed/denied per role; short reason rejected; audit row written; wizard shows the block at step 1.

## WP3 — Attendance: separate modes, 60-second rule, closing time (#11, #12, #13)

**Server** (`lib/actions/attendance.ts`): replace the toggle with an explicit `mode: 'in' | 'out'` (keep the card / ID lookup). Rules, identical for QR and manual:
- `in`, no open record → check in.
- `in`, open record < 60 s old → overwrite `check_in_at` with now, return "updated".
- `in`, open record ≥ 60 s old → return `ALREADY_IN` with message "You are already checked in" (no write).
- `out`, open record → check out. `out`, no open record → `NOT_CHECKED_IN` (no write).
Remove the `confirmed` bypass. Update every caller.

**UI** (`app/(authenticated)/attendance/AttendanceClient.tsx`): two clear mode buttons, **Check-In** and **Check-Out**, driving both the scanner and the manual box; the active mode is obvious (colour + text, not colour alone). On `ALREADY_IN`, show the warning and disable Check-In for that person until they check out.

**Closing time**: new `system_settings` key `library_closing_time` (`HH:MM`, default `17:00`) in `lib/actions/policy-constants.ts` — add a `time` validation type to `PolicyValidation`/`PolicyField` and to `app/api/admin/policy-settings/route.ts` (reject anything not `HH:MM`). Editable by librarian and super admin. `auto_checkout_forgotten_attendance()` reads the setting, sets `check_out_at = GREATEST(check_in_at, closing time of the check-in day)` and `notes = 'No Log Out'`. Migrate old notes text to `'No Log Out'`.

**Logs table**: show a visible **No Log Out** badge on those rows and include it in the export.

**Tests**: all five mode outcomes for manual and QR; 59 s vs 61 s boundary; PGlite for the function (custom closing time, check-in after closing never yields check-out < check-in); bad time value rejected; UI test for mode buttons and the disabled state.

## WP4 — Roles, permissions, library cards, audit visibility (#14, #15, #16, #17)

**#14 labels**: one map in `components/common/RoleBadge.tsx` (export it) — `student → Patron`, `student_assistant → Library Staff`; use it everywhere a role is shown (`DashboardClient.tsx:221`, user forms, demo accounts, nav comments excluded). Add `profiles.patron_type TEXT NOT NULL DEFAULT 'student' CHECK (patron_type IN ('student','faculty'))`. In `users/new/NewUserClient.tsx`, onboarding (`lib/actions/onboarding.ts`) and `lib/validations/api.ts`: choosing Faculty makes course/department optional and hides the student-only fields. Field label "Student ID" → "Patron ID" in UI text (column name unchanged).

**#15 inventory**: add `manage_inventory` to the permissions type (`lib/types.ts`, `lib/auth/permissions.ts`) and to the permission toggles in `UserDetailClient.tsx`, default OFF. `inventory/page.tsx`, `inventory/add/page.tsx`, the nav item and `lib/actions/catalog/auth.ts` (`allowAssistants`) allow `student_assistant` **only** with `manage_inventory === true`. Check the catalog export/import routes under `app/api/catalog/` apply the same rule.

**#16 cards**: librarians and super admins get "My Library Card" on their dashboard and the Catalog nav item (remove `excludeRoles`). Verify every role actually has a `library_cards` row (creation trigger + a backfill migration for existing staff). Staff can then be scanned as borrowers; a staff member cannot check out to themself without a second staff member — if the code allows self-checkout, block it and test it.

**#17 audit**: replace the RLS policy "Librarians can view all audit logs" — super admin sees all; librarian sees rows whose actor (`admin_id`) is not a super admin (use a `SECURITY DEFINER` helper to avoid profiles-policy recursion; null actor = system rows, visible). Open the page (`audit/page.tsx`) and nav item to librarians. Import and annual-reset stay super-admin only. The options and export routes must return only what RLS allows — no admin-client bypass.

**Tests**: PGlite RLS (librarian cannot read super-admin rows through the table **or** the `audit_log_records` view; super admin reads all; staff/patron read none); inventory gate per role and permission; label map; faculty onboarding without course; card exists for each role.

## WP5 — Inventory & reports UI (#1, #2, #3, #5, #9)

- **#1** `ModernInventoryClient.tsx`: Cards / **Table** toggle (stored in the URL `view=table`); table columns: title, author, ISBN, category, copies total/available, status. In Batch Operations → Export add **View Report**: an on-screen preview table of exactly what will be exported (selected columns + current filters), with Export and **Print** buttons. The file is 1,200+ lines — put the table and the preview in new small components under `components/inventory/`.
- **#2** Batch Operations → Import: **Download Template** button producing an `.xlsx` with the exact accepted headers (from the importer's own column list, not a second hard-coded list) and one sample row. Test: the generated template round-trips through the import parser with zero errors.
- **#3** `AnalyticsClient.tsx`: **Export** (xlsx: summary numbers sheet + High Demand sheet for the selected date range) and **Print** buttons.
- **#5** Circulation wording: "Scan student card" → "Scan library card"; "Student ID" → "Patron ID"; "Book copy" / "Scan book copy" → "Book / Item" / "Scan item"; "Student account is…" errors → "Patron account is…" (also in `process_qr_checkout` messages). Keep Circulation, Check-out, Return, Review Check-out.
- **#9** `users/[id]/`: a **Borrowing History** section using the existing `getBorrowingHistory(userId, …)` — title, borrowed, due, returned, status, fine/resolution, paginated. Librarian and super admin only.

**Tests**: view toggle renders rows; preview matches export rows; template round-trip; analytics export contents; label text; history section visible to librarian, denied to staff.

## WP6 — Export & archive old records (#10)

Super admin only, on Settings & Policies next to Annual Reset.
- Tables `borrowing_records_archive`, `attendance_archive` (same columns + `archived_at`), RLS: super admin read only.
- RPC `archive_old_logs(p_before DATE)` (`SECURITY DEFINER`, checks caller is super admin): moves attendance rows with `check_out_at < p_before`, and borrowing rows that are `RETURNED`, older than `p_before`, and have no receivable fine. Never moves open loans, `LOST`, or unsettled fines. Returns counts. Refuses a cutoff less than 1 year old.
- Route `app/api/admin/archive/route.ts`: `GET ?before=` streams the xlsx backup of what would be archived; `POST` runs the RPC and writes an audit row. UI: pick school-year cutoff → shows counts → **Download backup** → then **Archive** is enabled, with a confirm dialog.

**Tests**: PGlite (only eligible rows move, counts match, non-admin denied, recent cutoff refused); route tests for roles and bad dates.

## WP7 — Book costing (#4) — deferred

Not built before defense; listed under Scope & Limitations (WP8). If built later: separate table `book_acquisitions (book_id, acquisition_type 'PURCHASED'|'DONATED', price, replacement_cost, acquired_on)` with staff-only RLS — a separate table is the only clean way to keep prices away from students, since `books` is readable by them.

## WP8 — Documentation (#18, #19, #20)

`docs/user-guide.md`, `README.md`, `docs/requirement documentation.md`, `THESIS_VS_SYSTEM_ALIGNMENT_AUDIT.md`:
- "Online Private Access" → **Restricted / Authenticated OPAC**; cite Koha and MARC 21 as reference systems.
- Student → **Patron** (students and faculty), Student Assistant → **Library Staff**.
- Scope & Limitations: cash and official receipts are handled manually in a physical ledger; the system computes fines and tracks Receivable / Paid / Condoned. Book costing (#4) is a limitation. Full digital accounting/receipts go under Future Recommendations.
- Update the user guide for every screen changed in WP1–WP6.

The thesis paper itself (`Capstone documentation.pdf` and its source document) is edited by hand — this package only produces a list of the exact passages to change.

## WP9 — Rename role values in the database (#14, follow-up)

Rename the role **values** everywhere: `student` → `patron`, `student_assistant` → `library_staff`. `super_admin` and `librarian` are unchanged.

**Not renamed** (these are not role values): the `student_id` column and `studentId` fields, `patron_type` values (`student` / `faculty`), route paths such as `/student-catalog`, file and component names, `annual_student_reset`, and non-role enums or parameters that happen to say "student" (for example `expectedType: 'student'` in `resolveScan`, broadcast audience values) — check each hit and rename only where the string is compared to, stored as, or typed as a user role.

**DB migration** (timestamp after `20261116190000`):
- `ALTER TYPE public.user_role RENAME VALUE 'student' TO 'patron'` and `'student_assistant' TO 'library_staff'`.
- Policies and column defaults follow the rename automatically, but **function bodies are stored as text**: `CREATE OR REPLACE` every function whose body mentions the old values (find them all in `schema_clean_install.sql`), including text comparisons such as `role::text = 'student'`.
- Update stored data that holds the old strings: `auth.users.raw_app_meta_data->>'role'` and `raw_user_meta_data->>'role'` (read by `lib/auth-helpers.ts:65`), and any JSON settings that store role names.
- Mirror everything in `schema_clean_install.sql` and `sample_data.sql`; add a rollback that renames back.

**Code**: the `Role` type and every comparison, `allowedRoles` list, `minRole`, Zod enum, demo account, seed script and test fixture. `normalizeUserRole` must also accept the two old strings and map them to the new ones, so sessions with an old token keep working until they refresh — test this.

**Tests**: PGlite — apply the migration on top of the previous schema with existing rows of each role, then prove sign-up default role, RLS for each role, and every recreated function still work; rollback restores the old values. Update existing tests to the new values without weakening any assertion.

**Docs**: where the Markdown docs quote the role values as code, use the new values.

Done when a search for `student_assistant` returns nothing outside old migrations, rollbacks and the back-compat mapping, and the full suite and typecheck pass.

## WP10 — Stale check-in fix and WP4 test hardening (follow-up)

**A. Forgotten check-out must not block the next check-in (#11/#13).** The auto-close cron runs once a day (08:00 Manila), so a person who forgot to check out yesterday and scans in before the cron gets `ALREADY_IN`. In `lib/actions/attendance.ts`, mode `in`: if the open record's check-in is on an earlier Manila calendar day, **or** the current Manila time is past that day's `library_closing_time`, close it first (`check_out_at = GREATEST(check_in_at, closing time of the check-in day)`, `notes = 'No Log Out'`) and then create the new check-in. Same-day open records before closing time keep the existing 60-second / `ALREADY_IN` rules. Mode `out` on such a stale record also closes it as `No Log Out` at the closing time (not at "now") and returns a clear message. Reuse one helper for the closing-time calculation; read `library_closing_time` from `system_settings` (default `17:00`).
Tests: yesterday's open record + check-in today → old row closed as No Log Out with the right timestamp, new row created; open record from after closing time yesterday → check-out is never earlier than check-in; same-day open record before closing → still `ALREADY_IN`; custom closing time respected; manual and QR behave the same.

**B. Strengthen WP4 tests** (no production change unless a test exposes a bug — then fix the bug, never the assertion):
- Inventory: `library_staff` without `manage_inventory` is redirected from `/inventory` and `/inventory/add` and rejected by the catalog write/export/import actions and routes; with the permission they get in; `patron` never; a suspended staff member with the permission never. Circulation or attendance permission alone does not open Inventory.
- Permission toggle in the user detail screen: `manage_inventory` defaults OFF for a new staff account and saving persists it; only a super admin can change it.
- Faculty: onboarding / new user with `patron_type = 'faculty'` succeeds without course/department; `student` still requires them; an invalid patron type is rejected (action + PGlite constraint).
- Library card: sign-up trigger creates a card for each of the four roles; `librarian` and `super_admin` dashboards render My Library Card; the Catalog nav item shows for all four roles.
- Audit: the export and options routes return no super-admin-actor rows to a librarian.

Done when both parts are in place and the full suite and typecheck pass. End the report with `WP10 COMPLETE`.
