# Lumina LMS — Phased Fix Plan

_Built from `PONYTAIL_AUDIT.md` (part 1), `PONYTAIL_AUDIT_2.md` (part 2) and `PONYTAIL_AUDIT_3.md` (part 3). Date: 2026-11-04._

**59 items · 6 phases · 16 batches.** The demo-access buttons (P1#1) are left out on purpose.

**Legend:**
- 🔴 critical · 🟠 major · 🟡 minor (how bad the problem is)
- `C1` / `M1` / `m1` are the checklist IDs, and `[P1#2]` is the original finding, where the part files have the full explanation.
- ✅ means it was proven on the real schema in Postgres (PGlite).
- **Effort** is the Claude Code reasoning level to set with `/effort <level>` before the batch (model: Opus 5.5).

---

## How effort was chosen

Effort follows **how costly a subtle mistake is**, not how many lines change. A 3-line RLS policy gets more thinking than a 40-file find-and-replace.

| Level | Use it for | Examples here |
| :--- | :--- | :--- |
| `low` | Exact, mechanical edits. The fix is already spelled out. | One-line bug fixes, labels, regex swaps |
| `medium` | Small logic changes that need some reading around the code | Validation, route wrapping, debounce, docs |
| `high` | Security and SQL changes, auth or session code, anything where "looks right" can still be wrong | RLS policies, `proxy.ts`, URL fetching, overdue claiming |
| `xhigh` | Logic spread across SQL, TypeScript and cron with concurrency | The reservation-queue unification (B4.1) |
| `max` | Not needed for anything in this plan | — |

## Token-saving rules for every batch

1. **One batch = one session.** Run `/clear` before each batch, so old context isn't re-read on every turn.
2. **Set effort first:** `/effort <level>`.
3. **Paste only that batch's block** (IDs, files, fixes). Don't ask for a re-audit; the findings are already verified.
4. **Point to details, don't paste them:** "Full context: `docs/PONYTAIL_AUDIT.md` #14". Claude reads only what it needs.
5. **Run checks once, at the end of the batch:** `npm test && npm run typecheck && npm run lint`. Run `npm run build` only at phase gates.
6. **No subagents.** Each batch is small enough to do inline.
7. **SQL changes:** put each one in a new migration file (`supabase/migrations/<date>_<name>.sql`) **and** mirror it in `schema_clean_install.sql`. The live database only gets the migration.

**Prompt template (copy, then fill in):**
```
Fix batch <B#> from docs/AUDIT_CHECKLIST.md: <paste the batch block>.
Findings are verified; don't re-audit. Smallest correct change per item.
When done: run npm test, typecheck, lint; tick the boxes in the checklist; reply with a short summary.
```

---

# Phase 0 — Safety net (do this before any fix)

Build the tools that prove the later fixes work and can't be undone by accident.

### B0.1 · Real-database tests + safe scripts · Effort: `high`
_Why high: this test setup will judge every SQL fix in Phases 2 and 4, so it has to be right._

- [x] 🟠 **M24** Tests don't test the real database `[P1#32]` `[P3 update]`
  - Add `@electric-sql/pglite` as a dev dependency, and create `test/db-real.test.ts`. Start from the scratchpad harness `pgtest/run.mjs` if it still exists (it is temporary); otherwise rebuild it from the stand-ins described in `PONYTAIL_AUDIT_3.md`.
  - Write each ✅ finding as a test that checks the **correct** behavior, marked `it.fails(...)` for now, so CI stays green. Each later fix flips one `it.fails` to `it`.
  - Delete the tests that only match text in the SQL file or `docs/DATABASE_AUDIT.md`.
- [x] 🟠 **M18** `npm run clean` / `seed` wipe whatever database `.env.local` points to `[P1#30]` — `scripts/clean.ts`, `scripts/seed.ts`. Exit unless the URL is localhost or `--yes-really` is passed, and check each delete's error.

> ### 🚧 GATE 0
> - [x] `npm test` is green, and `test/db-real.test.ts` runs in under 10 seconds.
> - [x] The `it.fails` tests cover at least C1, C2, C3, C4, M4, M10, M12, M13, M14, M17, M26 and m2.
> - [x] `npm run clean` with a non-localhost URL exits without deleting anything.
>
> **Don't start Phase 1 until all three pass.**

---

# Phase 1 — Quick wins (easy, contained, mostly one-liners)

### B1.1 · One-line fixes · Effort: `low`
_Why low: every fix is spelled out exactly. If the session grows long, `/clear` halfway through._

- [x] 🟠 **M20** The password-reset link leads to a 404 `[P1#33]` — `components/auth/ForgotPasswordForm.tsx:L35`: change `/auth/update-password` to `/update-password`.
- [x] 🟠 **M6** Each checkout and return writes two audit rows `[P1#11]` — `lib/actions/circulation.ts`: delete `auditAction` / `auditEntity` from the checkout and return options.
- [x] 🟡 **m1** "Sort by availability" is inverted, and the default sort doesn't match `[P1#27]` — `lib/actions/books-core.ts:L83`: use `ascending: sortOrder === 'asc'`. Make `StudentCatalogClient.tsx:L196` default to `'newest'`.
- [x] 🟡 **m3** "Popular books" ignores the selected range `[P3#57]` — `lib/actions/analytics.ts:L63-67`: add `.gte('borrowed_at', startDate.toISOString())`.
- [x] 🟡 **m6** Import drops leading zeros from ISBNs `[P2#46]` — `ModernInventoryClient.tsx`: use `sheet_to_json(ws, { raw: false, defval: "" })`.
- [x] 🟡 **m7** Search drops letters like ñ `[P1#37]` — `books-core.ts:L47`: use `/[^\p{L}\p{N}\s]/gu`.
- [x] 🟡 **m8** Category edits don't refresh the cached list `[P1#38]` — `app/api/admin/categories/[id]/route.ts`: add `revalidateTag("categories","default")` and `revalidatePath("/catalog","page")` to PUT and DELETE.
- [x] 🟡 **m9** Reservations are logged as "borrowing_record" `[P1#39]` — `app/api/circulation/reservations/route.ts:L100`: use `"reservation"`.
- [x] 🟡 **m11** The sitemap lists pages that don't exist `[P1#36]` — `app/sitemap.ts`: remove `/sign-up` and `/search`.
- [x] 🟡 **m14** Animations ignore "reduce motion" `[P3#58]` — `components/providers/animation-provider.tsx`: wrap the children in `<MotionConfig reducedMotion="user">`.
- [x] 🟡 **m15** Three controls have no name for screen readers `[P3#59]` — add `<DialogTitle className="sr-only">` in `PolicyLayout.tsx:L464`, and `aria-label` in `UpdatePasswordForm.tsx:L72-80` and `ScanStep.tsx:L82`.
- [x] 🟡 **m16** The CSP allows `eval` in production `[P3#60]` — `next.config.ts`: add `'unsafe-eval'` only when `NODE_ENV !== 'production'`.
- [x] 🟡 **m22** Lint warning `[P2#54]` — `UserDetailClient.tsx:L111`: remove `startTransition` from the dependency array.

### B1.2 · Small logic and input-safety fixes · Effort: `medium`
_Why medium: each is small, but needs a look at the code around it (escaping, validation, timing, write order)._

- [x] 🔴 **C7** Open redirect in the login links `[P1#5]` — `app/(auth)/callback/route.ts`, `app/(auth)/confirm/route.ts`: accept `next` only if it starts with `/` and not with `//` or `/@`; otherwise use `/dashboard`.
- [x] 🔴 **C11** Email HTML injection ✅ `[P1#13]` — `lib/mail.ts`: add `escapeHtml()` and wrap `userName`, `bookTitle` and `dueDate` in every template.
- [x] 🟠 **M4** A decimal policy value breaks checkout ✅ `[P1#15]` — `isValidPolicyValue` in `lib/actions/policy-constants.ts` (moved there in B0.1; the route uses it): require whole numbers for integer settings, and reject unknown keys.
- [x] 🟠 **M11** The gate camera times a student in and then out `[P2#43]` — `lib/actions/attendance.ts`: if the open record is less than 60 seconds old, return "Already timed in".
- [x] 🟠 **M19** Seed data holds what look like real phone numbers `[P1#31]` — `scripts/seed.ts`: replace them with clearly fake values.
- [x] 🟡 **m4** Invite ignores a failed super-admin transfer `[P1#24]` — `lib/actions/users.ts`: `const { error } = await rpc(...); if (error) throw error;`, remove the try/catch, and fix the test mock instead.
- [x] 🟡 **m5** A failed avatar upload deletes the old photo `[P2#45]` — `AvatarManager.tsx`: upload, then `updateAvatarUrl`, then delete the old files.
- [x] 🟡 **m10** The unread badge stops at 50 `[P2#51]` — `hooks/use-notifications.ts`: use `select('id', { count: 'exact', head: true }).eq('is_read', false)`.

> ### 🚧 GATE 1
> - [x] `npm test && npm run typecheck && npm run lint && npm run build` are all green.
> - [ ] Manual checks:
>   - The reset email opens the update-password page.
>   - `/callback?code=…&next=//evil.com` lands on `/dashboard`.
>   - A test email with a name like `<b>x</b>` shows the literal text.
>   - Saving `loan_period_days = 1.5` is rejected.
> - [x] The M4 test in `db-real.test.ts` passes (flip it from `it.fails`).

---

# Phase 2 — Database security (small diffs, high risk)

_Every change here goes in a migration file plus `schema_clean_install.sql`. Both batches read the same schema, so do them in back-to-back sessions._

### B2.1 · RLS, roles and sign-up · Effort: `high`
_Why high: these are the actual security boundary. A policy that "looks right" can still leak data or lock real users out._

- [x] 🔴 **C1** A librarian can make themselves super admin ✅ `[P1#2]` — `fn_guard_profile_updates`: only `super_admin` / service role may change `role` or `permissions`, or edit a `super_admin` row.
- [x] 🔴 **C2** Every logged-in user can read every profile ✅ `[P1#3]` — profiles SELECT: `USING (id = auth.uid() OR public.is_staff())`. Find the student screens that show other people's names first (grep `profiles(` and `full_name`), and give them a view with only names. This also stops the Realtime leak. _Done: no student screen reads other people's profiles (the ticker shows book titles only), so no view was needed._
- [x] 🔴 **C3** Anyone can sign up, and outsiders can steal student IDs ✅ `[P1#4]` — reject non-allowed domains in `handle_new_user`; in `auto_set_student_id`, take digits only from `sti.edu.ph` emails; block self-set `student_id` in the guard trigger; delete the dead branch in `callback/route.ts`. _Done; the callback now maps the trigger's rejection to `restricted_access`, and onboarding no longer writes `student_id`._
- [x] 🟠 **M13** Students can fake attendance ✅ `[P1#20]` — drop the policies "Users can self check-in" and "Users can self check-out".
- [x] 🟠 **M14** Student-assistant permissions not enforced ✅ `[P1#21]` — limit UPDATE/INSERT on `book_copies`, `borrowing_records` and `reservations` to `super_admin` and `librarian`. Make `lib/actions/catalog/auth.ts` allow only those two roles. _Done via new `is_manager()`. Import/export/ISBN import are librarian-only; `getBooks` and `getBookAdminDetails` still allow assistants, because `/inventory` (read-only) is open to them._
- [x] 🟠 **M17** The super admin can remove the last super admin ✅ `[P1#25]` — in `app/api/users/route.ts` PATCH, refuse self role or status changes for `super_admin`. Add the same rule to the guard trigger.

### B2.2 · Circulation SQL functions · Effort: `high`
_Why high: these functions run every checkout and reservation, and locking or limit mistakes only show up under real use._

- [x] 🔴 **C4** One account can reserve every copy ✅ `[P1#9]` — `create_reservation_atomic`: require `status = 'ACTIVE'`, enforce `max_reservations_per_student`, and return `RESERVATION_LIMIT`.
- [x] 🟠 **M10** Borrow-limit race; overdue loans not counted ✅ `[P1#29]` — `process_qr_checkout`: add `pg_advisory_xact_lock(hashtext(v_card.user_id::text))` and count `IN ('ACTIVE','OVERDUE')`.
- [x] 🟠 **M12** The return screen never shows the due date ✅ `[P2#44]` — add `borrowed_at` and `due_date` to the `process_qr_return` preview JSON. Format the dates in `use-circulation-wizard.ts`, for checkout too.
- [x] 🟡 **m2** Students never see when a book comes back ✅ `[P1#28]` — add a SECURITY DEFINER `get_next_due_date(book_id)` that returns only the date, and use it in `getBookAvailabilityStatus`.

> ### 🚧 GATE 2
> - [x] The `it.fails` tests for C1, C2, C3, C4, M10, M12, M13, M14, M17 and m2 are flipped to `it` and pass.
> - [x] Full suite plus build green.
> - [ ] Manual smoke test on a staging or local project:
>   - A student dashboard and the catalog still render (names still show where they should).
>   - A librarian can approve a PENDING user.
>   - Checkout and return work.
>   - A Gmail sign-in is rejected.
> - [x] The migration has been applied to the live database (Supabase SQL editor), with a backup taken first. _Applied 2026-11-04 to `system-sg` (3 migrations incl. the recursion hotfix); undo script in `supabase/rollback/`._

---

# Phase 3 — App-layer security and auth (several files at once)

_Run B3.1 first, because the Next.js upgrade can change the `proxy.ts` API._

### B3.1 · Dependency upgrades · Effort: `medium`
_Why medium: mostly version bumps, then fixing whatever the build and tests report._

- [x] 🔴 **C10** Known-vulnerable dependencies `[P1#16]` — `npm audit fix`; bump `next` past the critical advisory and `sharp` to 0.35.x; replace `xlsx` with the SheetJS CDN build (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) or `exceljs`, in `ModernInventoryClient.tsx`, `AuditLogExportImportModal.tsx` and `audit-logs/export/route.ts`. _Done: next 16.4.5, sharp 0.35.5, nodemailer 10.3.1, xlsx from the SheetJS CDN (0.20.3, installed with `--allow-remote=root`), plus `npm audit fix`; `npm audit --omit=dev` shows 0._

### B3.2 · Session refresh + dangerous route removal · Effort: `high`
_Why high: getting cookie and session handling wrong logs everyone out or leaves sessions stale._

- [x] 🔴 **C9** Users get logged out at random `[P2#40]` — add root `proxy.ts` with the `@supabase/ssr` `updateSession` pattern, and a matcher that skips static assets. Fix the stale comment in `hooks/use-notifications.ts:L49-51`.
- [x] 🔴 **C8** A librarian can demote the admin via `/api/users` POST `[P1#17]` — delete GET and POST in `app/api/users/route.ts`, plus their tests. Keep PATCH. _Also fixed a B2.1 regression: `inviteUser` now finishes a super-admin handover with the service role (after the transfer the requester is a librarian, and the DB guard blocks them)._

### B3.3 · One permission check everywhere · Effort: `medium`
_Why medium: repetitive edits that follow one pattern, but each route's allowed roles must be kept._

- [x] 🟠 **M15** Permission checks are hand-written and disagree `[P1#22]` — wrap `upload`, `test-email`, `annual-reset`, `audit-logs` (list, export, import), `notifications/bulk`, `notifications/maintenance`, `catalog/export/covers`, `circulation/reservations` and `admin/categories` with `withAuthApi({ allowedRoles })`, and delete the copied checks. _Done. `apiError` now also sends `error` (same text as `message`) so clients reading `data.error` keep working. `admin/categories` GET/POST used to answer 500 on a denied role; now 401/403._
- [x] 🟠 **M16** Super admins can forge audit history `[P1#23]` — `audit-logs/import/route.ts`: force `admin_id` to the importer, set `details.imported = true`, and delete the empty `if`. _Done; the file's original `admin_id` is kept as `details.original_admin_id`._

### B3.4 · URL fetching + library cards · Effort: `high`
_Why high: stopping server-side URL fetching takes care, and the card change touches storage, existing card numbers and the scan flow together._

- [x] 🔴 **C6** The server downloads any URL `[P1#6]` `[P2 addition]` — write one `fetchImage(url)` in `lib/` (`redirect:'error'`, 5 MB cap while streaming, `image/*` only) and use it in `library-card-assets.server.ts`, `api/upload`, `catalog/export/covers` and `uploadCoverFromUrl`. In `updateAvatarUrl`, allow only your own storage domain. Set `file_size_limit` and `allowed_mime_types` on the `avatars` and `book-covers` buckets. _Done: `lib/fetch-image.ts` also blocks private/internal IPs after DNS lookup and rejects SVG; known limit (DNS rebinding) is a `shortcut:` comment._
- [x] 🔴 **C5** Library cards can be forged `[P1#7]` — stop overwriting `card_number` with the student ID; give existing cards new random `LIB-…` numbers in a migration; make the `library-cards` bucket private and serve images with `createSignedUrl`. _Done; card photos moved to the public `avatars` bucket (`<user>/card.webp`), legacy ones are copied over on next card load. Migration `20261104150000` is **not yet applied to live**: apply it together with the deploy of this code, or the old code will undo it._
- [x] 🟠 **M5** Checkout with a student ID fails `[P1#10]` — this shows up once C5 is done. In `resolveScan`'s fallback, return the real `card_number` looked up by `user_id`.

> ### 🚧 GATE 3
> - [x] Full suite plus build green; `npm audit --omit=dev` shows no critical or high (or each remaining one is written down as accepted).
> - [ ] Manual checks:
>   - Set the Supabase JWT expiry to 5 minutes on staging, wait 6, and click around: you stay logged in.
>   - `POST /api/users` returns 405.
>   - `/api/upload` with a URL that redirects, a private IP, or a 20 MB file is rejected.
>   - The card QR shows `LIB-…`, and scanning it, and typing a student ID, both check out.
>   - A library-cards URL without a signature returns 400/403.

---

# Phase 4 — Data correctness and workflow logic (hardest)

### B4.1 · Unify the reservation queue · Effort: `xhigh`
_Why xhigh: one change across 4 call sites (SQL return, TypeScript cancel, cron expiry, copy-status change), with locking and queue order. The biggest risk of quietly wrong data in the plan._

- [x] 🟠 **M1** Expired holds skip the line; the queue logic exists four times ✅ `[P1#8]` — write one SQL `release_copy(copy_id)` (with a per-book advisory lock) that gives the copy to the next ACTIVE reservation or marks it AVAILABLE, with one hold default `COALESCE(…, 3)`. Call it from `process_qr_return`, `cancelReservation`, cron expiry (`hold_expires_at < now()`, status `EXPIRED`) and copy-status changes. Delete `reassignCopy`.
- [x] 🟠 **M2** Changing a copy's status rewrites loans and holds `[P1#14]` — `updateBookCopyStatus`: refuse BORROWED/RESERVED copies, give LOST its own loan status (not RETURNED), drop BORROWED from the choices, and call `release_copy` after AVAILABLE.

### B4.2 · Cron, big lists, time zones · Effort: `high`
_Why high: claiming rows so two runs can't send twice, plus moving counts into SQL. Easy to get subtly wrong._

- [x] 🟠 **M7** Overdue emails lost or sent twice `[P1#12]` — add an `overdue_notified` column; claim each row with `update … where id = ? and overdue_notified = false returning id` before sending; clear the flag if the send fails.
- [x] 🟠 **M8** Lists stop at 1,000 rows `[P1#18]`: _Done. Import duplicate check pages through all books with `.range()` instead of `.in('isbn', …)`, because `.in` can't match title + author case-insensitively._
  - annual reset: one RPC;
  - analytics: SQL `date_trunc` / `group by` RPC;
  - import duplicate check: `.in('isbn', …)`;
  - bulk notify: `insert … select` RPC;
  - audit export and attendance "all": `.range()` paging.
- [x] 🟠 **M9** UTC instead of Manila time `[P1#19]` — use `+08:00` in the audit filters; format and group with `Asia/Manila`. If the analytics RPC from M8 is written with `AT TIME ZONE 'Asia/Manila'`, this is done there.

### B4.3 · Import and export at real size · Effort: `high`
_Why high: a bulk-write rewrite where re-running must never duplicate data._

- [x] 🟠 **M3** Batch import times out and doubles copies `[P2#41]` — insert books in bulk, then copies in bulk; skip duplicates by default ("add copies to existing books" is an opt-in checkbox); cap stock at 50; write one audit entry.
- [x] 🟠 **M22** Cover export times out `[P1#26]` — at most 10 downloads at a time; unique file names with `-${index}`.

### B4.4 · Realtime load + bulk re-activation · Effort: `medium`
_Why medium: copying an existing debounce pattern, plus one simple RPC and button._

- [x] 🟠 **M21** Realtime refresh storms `[P2#42]` — copy `DashboardClient`'s 500 ms `debouncedRefresh` into `StudentCatalogClient`, `AnalyticsClient`, `BookDetailModal` and `UserDetailClient`; drop the `book_copies` / `borrowing_records` listeners on the student catalog.
- [x] 🟠 **M23** Re-activating students after the reset is manual `[P2#48]` — add a bulk "Re-activate selected" action on Users (one RPC that updates profiles and cards).

> ### 🚧 GATE 4
> - [x] DB tests pass for:
>   - an expired hold goes to the next in line;
>   - LOST ≠ RETURNED;
>   - two maintenance runs send one email per loan;
>   - analytics counts over 1,000 rows correctly.
> - [x] A 500-row import fixture finishes in under 10 seconds, and importing it again adds 0 copies.
> - [x] Full suite plus build green.
> - [ ] Manual: two browser tabs on the student catalog, one checkout means one refresh per tab, not a burst.

---

# Phase 5 — Cleanup, accessibility, docs (easy to medium, low risk)

### B5.1 · Delete what isn't used · Effort: `medium`
_Why medium: deleting code is easy, but M26 drops tables through a migration, so check the references first._

- [ ] 🟠 **M26** Six unused tables ✅ `[P2#47]` — drop `announcements`, `reports`, `deleted_profile_info`, `rate_limit_log`, `checklist_items` and `checklist_dropdown_options`, along with their policies, publication entries, seed/clean lines and `types/database.ts` entries (migration + clean install).
- [ ] 🟡 **m17** Dead code and tests that test the mocks `[P1#34]` — delete `QRScanner.tsx`, `scripts/seed-attendance-today.mjs`, `test/mocks/stress.test.ts`, `test/mocks/query-chaining.test.ts` and any leftover dead branches.
- [ ] 🟡 **m18** Duplicate book query `[P1#35]` — make `getBooks` call `fetchBooksCore` (add an `includeInactive` flag).
- [ ] 🟡 **m19** Listeners that never fire `[P2#50]` — delete the `ui_preferences` channel and the notifications DELETE listener.
- [ ] 🟡 **m20** The card component written eight times `[P2#52]` — `MyCardContainer.tsx`: build one shared `cardProps`.
- [ ] 🟡 **m21** Dead `/catalog` route `[P2#53]` — delete both files, and add a redirect in `next.config.ts`.

### B5.2 · Accessibility · Effort: `low`
_Why low: m12 is a careful find-and-replace, and m13 copies a pattern that already exists._

- [ ] 🟡 **m12** Faint text below the contrast minimum `[P3#55]` — for text, change `text-muted-foreground/40–80` to `text-muted-foreground`, keeping the faded forms for icons and lines. Raise `text-[8px]` / `[9px]` / `[10px]` to `text-[11px]`. Check the analytics, dashboard and catalog pages visually afterward.
- [ ] 🟡 **m13** The Users list can't be opened with a keyboard `[P3#56]` — in `LuminaTable.tsx`, when `onRowClick` is set, add `tabIndex={0}`, `role="button"` and an Enter/Space `onKeyDown` (copy from `StudentBookCard`).

### B5.3 · Make the docs true · Effort: `medium`
_Why medium: writing, but every claim has to be checked against the fixed code._

- [ ] 🟠 **M25** The docs claim protections that don't exist `[P2#49]` — rewrite the security sections of `README.md` and `docs/DATABASE_AUDIT.md` to match the code; remove checklist sections for features that don't exist (`ENTERPRISE_SAAS_QA_CHECKLIST.md`); make sure no test checks doc text.

> ### 🚧 GATE 5 (final)
> - [ ] No `it.fails` left in `test/db-real.test.ts`.
> - [ ] `npm test && npm run typecheck && npm run lint && npm run build` green; `npx knip` reports nothing unused; `npm audit --omit=dev` clean or accepted.
> - [ ] Every box in this file is ticked.
> - [ ] Optional: run `/ponytail-audit` once more as a final check.

---

## Summary

| Phase | Batch | Items | Effort | Difficulty |
| :--- | :--- | :--- | :--- | :--- |
| 0 Safety net | B0.1 | M24, M18 | `high` | Medium |
| 1 Quick wins | B1.1 | M20, M6, m1, m3, m6, m7, m8, m9, m11, m14, m15, m16, m22 | `low` | Easy |
| | B1.2 | C7, C11, M4, M11, M19, m4, m5, m10 | `medium` | Easy |
| 2 DB security | B2.1 | C1, C2, C3, M13, M14, M17 | `high` | Medium |
| | B2.2 | C4, M10, M12, m2 | `high` | Medium |
| 3 App security | B3.1 | C10 | `medium` | Medium |
| | B3.2 | C9, C8 | `high` | Medium |
| | B3.3 | M15, M16 | `medium` | Medium |
| | B3.4 | C6, C5, M5 | `high` | Hard |
| 4 Correctness | B4.1 | M1, M2 | `xhigh` | Hardest |
| | B4.2 | M7, M8, M9 | `high` | Hard |
| | B4.3 | M3, M22 | `high` | Hard |
| | B4.4 | M21, M23 | `medium` | Medium |
| 5 Cleanup | B5.1 | M26, m17, m18, m19, m20, m21 | `medium` | Easy |
| | B5.2 | m12, m13 | `low` | Easy |
| | B5.3 | M25 | `medium` | Easy |

**Effort mix:** 2 batches `low` · 6 `medium` · 7 `high` · 1 `xhigh` · 0 `max`.

**About the order:** the phases go roughly easiest to hardest. The two exceptions are on purpose: Phase 0 comes first so every later fix can be proven, and Phase 2 (database security) comes before the bigger refactors because those holes are open right now.

**Not covered by any batch:** the things the audits couldn't check (Supabase's hosted Realtime, Storage and Auth servers; real phone cameras; dark-mode contrast; a load test). Test them by hand at Gates 3 and 4.
