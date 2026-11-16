# Lumina LMS Production Browser Test Report

- **Target:** `https://stilumina.vercel.app`
- **Release Commit:** `36a8199879df47b7a9676330d7d8b446db080102` (Production deployment `7822392666`, state `success`)
- **Date:** 2026-11-16 (Asia/Manila)
- **Summary:** **13 PASS / 0 FAIL / 2 BLOCKED**

## Results

| Item | Role | Result | Evidence |
|---|---|---|---|
| 1. Inventory (Cards/Table, Export View Report + Print/Export, Import Template) | Super Admin | PASS | On `https://stilumina.vercel.app/inventory?view=table`, Table view renders 6 columns (`Title`, `Author`, `ISBN`, `Category`, `Copies (Avail / Total)`, `Status`); Batch Operations -> Import Sheet `Download Template` downloaded `.xlsx` (`"Import template downloaded!"`, 17,353 bytes); Export Data -> `View Report` previewed 101 records across 12 columns with working `Print` and `Export (.xlsx)`. |
| 2. Analytics (High Demand Catalog Export & Print) | Super Admin | PASS | On `https://stilumina.vercel.app/analytics`, High Demand Catalog rendered (`01 Team of Rivals...`) and both `Export (.xlsx)` and `Print` executed without errors. |
| 3. Circulation labels | Super Admin, Librarian | PASS | On `https://stilumina.vercel.app/circulation`, wizard shows `"Scan library card"`, `"Book / Item"`, `"Scan item"`, and `"Patron ID"` on Review Checkout, with no `"Student Card"` or `"Book Copy"` labels. |
| 4. Fines (checkout/return, Mark as Paid/Condoned, Settlements, Export/Print) | Super Admin, Librarian | PASS | Demo patron `STU-20220271` hit `"Borrow limit reached."` on checkout, so real checkout & return was completed with `STU-20230148` + `QR-ACC-00303` (`On Liberty`). On `/history?status=OVERDUE&page=1`, `Mark as Condoned` without remarks was refused (`"Remarks of at least 5 characters are required when condoning a fine."`), `Mark as Paid (₱75.00)` and `Mark as Condoned` (₱95.00 with remarks) succeeded; `Settlements` (`?status=SETTLED`) filtered All/Paid/Condoned with amounts & remarks; `Export (.xlsx)` and `Print` worked on Overdue and Settlements. |
| 5. Block at card scan & Override | Librarian, Library Staff | PASS | Scanning `STU-20220271` on `https://stilumina.vercel.app/circulation` blocked immediately (`BORROWING RESTRICTED`, Overdue books: 2, Receivable fines: ₱250.00); Librarian overrode with reason `"Librarian browser test override"` and `checkout_override` appeared in `/audit`; Library Staff saw only `Start over` (`"Only a Librarian or Super Admin can override a borrowing block."`). |
| 6. Patron dashboard & history | Patron | PASS | On `https://stilumina.vercel.app/dashboard`, `Current Borrows` listed overdue loans first with fines (`₱135.00`, `₱115.00`); `/history?status=SETTLED&page=1` displayed settled fines (`₱75.00 PAID`, `₱95.00 CONDONED`) with remarks read-only. |
| 7. User Directory Borrowing History | Super Admin | PASS | Opening `https://stilumina.vercel.app/users/b4d7e3d7-27a3-4995-bc9d-d23de9f96124` (`Paolo Ian Bautista`) rendered paginated `Borrowing History` (`Showing 1-10 of 76`, `1/8`). |
| 8. Archive tool | Super Admin | BLOCKED | On `https://stilumina.vercel.app/policies` (Lifecycle tab), cutoff picker, counts (`Eligible records before 2025-06-01: 0`), `Download backup` (`GET /api/admin/archive?before=2025-06-01` -> 200 `.xlsx`), and `< 1 year` refusal (`2026-06-01` -> inline error + 400 `INVALID_DATE`) all worked; however, 0 records are older than 1 year in the demo dataset so `Archive` remained disabled and the confirm dialog could not be opened. |
| 9. Attendance modes, 60 s rule, No Log Out badge | Super Admin | PASS | On `https://stilumina.vercel.app/attendance`, separate `Check-In`/`Check-Out` modes worked; check-out when not checked in was refused (`"Paolo Ian Bautista is not currently checked in."`); 2nd check-in within 60 s updated the active row (`"updated for Paolo Ian Bautista."`); check-in after 62 s showed `"You are already checked in — Paolo Ian Bautista must check out before checking in again."`; `"NO LOG OUT"` badge visible in `All History`. |
| 10. Settings & Policies (Library Closing Time) | Super Admin | PASS | On `https://stilumina.vercel.app/policies`, `library_closing_time` changed `17:00` -> `18:00`, saved with audit reason, persisted across reload, rejected invalid `"99:99"` (`400`, `"Invalid time format. Expected 24-hour HH:MM."`), and restored to `17:00`. |
| 11. Role labels | All roles | PASS | `/users`, `/users/[id]`, `/users/new`, `/` demo buttons, and digital library cards show `"Patron"` and `"Library Staff"`; zero `"Student Assistant"` labels appeared in UI text. |
| 12. Inventory permission | Library Staff, Super Admin, Librarian | PASS | Library Staff (`Inventory` OFF) navigating to `/inventory` redirected to `/dashboard`; Super Admin toggled `Inventory` ON on `Kaye Marasigan`, verified persistence after reload, and restored OFF; Librarian saw all 4 permission switches `disabled: true`. |
| 13. Library card & Catalog nav | All roles | PASS | `My Library Card` rendered on `super_admin` (`DEMO-ADM-001`), `librarian` (`DEMO-LIB-001`), `library_staff`, and `patron` `/dashboard`; `Catalog` nav link (`/student-catalog`) visible for all 4 roles. |
| 14. Audit Logs visibility & export | Super Admin, Librarian, Library Staff, Patron | PASS | On `https://stilumina.vercel.app/audit`, Super Admin saw all 14 rows; Librarian opened `/audit`, exported backup, and saw only non-super-admin rows (zero `Teresita Aquino` actions); Library Staff and Patron redirected to `/dashboard?error=unauthorized`. |
| 15. Sign-in (4 roles) & Sign-up/Onboarding Faculty form | All roles | BLOCKED | All 4 demo sign-in buttons on `https://stilumina.vercel.app/` landed on their respective `/dashboard`, and `/users/new` offered `Student`/`Faculty` while hiding `Academic Program / Department` for `Faculty`; however, the self-service `OnboardingForm` (`AccountPendingScreen.tsx`) only renders for un-onboarded accounts and could not be opened without creating or modifying a real account (disallowed by test rules). |
| Phone-width layout (~390px) | Super Admin | PASS | `https://stilumina.vercel.app/dashboard`, `/circulation`, and `/attendance` tested at `innerWidth: 390` each had `scrollWidth: 382` and 0 horizontally overflowing elements. |

## Failures

No `FAIL` items or unexpected console/network errors were observed during the test run. (Intentional negative-validation probes returned expected HTTP 400 responses on `/api/admin/policy-settings` for `"99:99"` and `/api/admin/archive` for `"2026-06-01"`.)

### Blocked Sub-Checks (Reproduction Notes)

1. **Item 8 — Archive confirm dialog (`https://stilumina.vercel.app/policies`, Lifecycle tab, Super Admin):**
   - **Steps:** Open Lifecycle tab -> click `Before SY 2025–2026 (2025-06-01)` or set date `2025-11-15` -> click `Download backup`.
   - **Observed:** Preview reports `Eligible records before 2025-06-01: 0 (0 borrowing record(s) · 0 attendance log(s))`, so the `Archive` button remains `disabled` and the final confirmation dialog cannot be triggered against the current demo seed data (all seeded records are from 2026).
2. **Item 15 — Self-service onboarding form (`OnboardingForm`, un-onboarded Patron):**
   - **Steps:** Inspect `https://stilumina.vercel.app/` and `/users/new`; attempt `/onboarding`.
   - **Observed:** There is no standalone `/onboarding` or `/signup` route (404), and `OnboardingForm` only renders inside `AccountPendingScreen` for newly signed-up accounts missing onboarding fields. All four demo accounts are already onboarded, and creating/modifying real accounts is prohibited; `/users/new` was inspected instead and confirmed `Student`/`Faculty` toggle hides `Academic Program / Department` for `Faculty`.
