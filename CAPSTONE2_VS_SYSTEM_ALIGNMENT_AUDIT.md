# Capstone 2 Paper vs. Lumina LMS — Alignment Audit

**Paper:** audited on `capstone 2 Docu.docx` (proposal dated May 23, 2026); line refs `Lnnn` = its extracted text lines. The latest paper is now the Capstone 2 Manuscript (`docs/paper/capstone-2-manuscript.docx`).
**System:** `development` @ a7bb0c2. Code is the source of truth.
**Method:** Gemini 4 Neon and GPT-6.1 Sol audited independently, then cross-examined each other's findings (confirm / dispute / re-grade) and did a missed-items sweep. Claude adjudicated disagreements and spot-checked every system-bug claim in code. Read-only; tests not run.

## Status (2026-11-22)
- **Section B (system bugs):** fixed in commit `e871280`, together with the Inventory KPI change (it now counts physical copies). On owner decision, S1 was kept as is: the reset covers all patrons, and only the wording changed.
- **Section A (paper):** fixed as tracked changes in the Manuscript, `docs/paper/capstone-2-manuscript-revised-tracked.docx` (397 changes; see `docs/paper/capstone-2-manuscript-change-log.md`). P1 (demo login) is out of scope: demo access is removed for the defense and the paper stays O365-only.
- **Figures (2026-11-23):** all figures redrawn from the current system as editable draw.io files in `docs/paper/figures/`. The ERD is now Figures 1–1.3 and the Level 1 DFD is Figure 2.1 in three parts; the new captions still have to be added in Word.
- **Still open for the team:** add or justify flowcharts for Librarian Audit Logs, staff Catalog, Report Builder and Notifications; delete the unused OTP notation row; update the TOC and List of Figures fields in Word.

Severity: **Critical** = paper promises something the system lacks or contradicts (panel will catch it). **Major** = wrong rule, permission, workflow or metric. **Minor** = naming / wording / editorial.

---

## A. Paper must change (paper is wrong about the system)

### Critical

| # | Paper (location) | Reality (evidence) | Fix |
|---|---|---|---|
| P1 | Login is "exclusively Microsoft O365" (L443, REQ083) | Quick Demo Access is hard-coded on and logs in with Supabase passwords (`lib/demo/config.ts:7`, `app/api/demo-login/route.ts:49`, `components/hero.tsx:105`) | Paper: state the evaluation demo exception. System (before deployment): disable demo mode. |
| P2 | Catalog covers "local thesis soft copies" (L445) | Only physical books/copies + covers; no document storage or viewer (`supabase/schema_clean_install.sql:41-80`) | Remove, or move to Recommendations. |
| P3 | Students "independently search for books and process checkouts" (RRL L469) | Checkout is staff-only; self-checkout is blocked (`lib/actions/circulation.ts:300,410`, SQL `:1172`); landing says "Checkout is not done online" (`app/page.tsx:30`) | Students search/reserve online; staff scan at the desk. |
| P4 | Audit Logs can "Import … CSV and JSON" + "live refresh" (L194, L373, REQ035-036) | Export only (CSV, JSON, **XLSX**); no import; no refresh control or realtime (`components/admin/AuditLogExportModal.tsx:63`, `app/api/admin/audit-logs/export/route.ts:17`, `components/admin/AuditLogClient.tsx:510`) | Drop import + live refresh; add XLSX. |
| P5 | **Fines are absent from Scope/Objectives/Requirements** (word "fine" appears only in RRL) | Full fine engine: ₱5/day default (per Manila calendar day), Receivable/Paid/Condoned, condone needs remarks, Return & Settle, Settlements tab, borrowing blocks for overdue/lost/unpaid fines with audited librarian override (`lib/fines.ts:16`, `lib/actions/history.ts:315`, `lib/actions/circulation.ts:288-384`) | Add fines + settlement + borrowing-block rules to Circulation, Borrowing Logs, My Borrowing, Policies. |

### Major

| # | Paper (location) | Reality (evidence) | Fix |
|---|---|---|---|
| P6 | Borrowing Logs is a "view-only list", 4 filters (L363, L388, L415, REQ013/045/063) | Staff can Return/Settle and Settle on rows; 5 tabs incl. **Settlements** (Paid/Condoned) (`app/(authenticated)/history/HistoryContent.tsx:39-51,545`) | Rewrite as interactive for authorized staff. |
| P7 | My Borrowing: 4 status views, 4 columns (L413, L432, REQ062/075) | Same 5 tabs incl. Settlements, **Penalty** column, personal XLSX export + Print (`HistoryContent.tsx:288,509-718`) | Update scope + reqs. |
| P8 | Analytics: daily visitors, **registered members**, total inventory **volumes**; line graphs; **status donut** (returned/active/overdue); 7d/30d/1y (L365, L390, REQ017-021/046) | Cards = Visits, Loans issued, Inventory, Active loans; **Peak Visiting Hours bar chart**, Circulation **line** chart, **Genre Popularity** donut; Custom range; XLSX/print; Inventory counts **titles incl. archived**, not copies (`app/(authenticated)/analytics/AnalyticsClient.tsx:222-338`, `lib/actions/dashboard.ts:137`) | Describe actual metrics/charts; say "catalog titles" (or change the system to count copies). |
| P9 | Report Builder never mentioned | `/analytics/reports`: attendance/borrowing/inventory/users, up to 8 sections, PDF/Excel/CSV; also open to Library Staff with attendance/circulation permission (`lib/report-builder.ts:39`, `lib/auth/report-access.ts:4`) | Add to Analytics scope for Super Admin, Librarian, and permitted Student Assistants. |
| P10 | Librarian has no Audit Logs module (only a dashboard mention, L203/L382/REQ042) | Librarians have `/audit` + export; Super Admin actions hidden from them (`app/(authenticated)/audit/page.tsx:24`, SQL `:448-481`) | Add Librarian Audit Logs module, req, flowchart. |
| P11 | Student Assistant dashboard shows today's visitors / total users / active loans (L226, L316, L405, REQ053) | SAs get the patron-style dashboard: Digital Card, permission-gated desk shortcuts, announcements, personal activity (`components/dashboard/DashboardClient.tsx:284,541-653`) | Rewrite SA dashboard. |
| P12 | Dashboard shortcuts include Audit Logs and Analytics (L178, L203, L357, L382, REQ004/042) | Dashboard = Action Center (card applications, overdue, holds ready) + 4 KPI cards + recent books + My Library Card; Audit/Analytics are sidebar only (`DashboardClient.tsx:284-538`) | Describe actual dashboard. |
| P13 | Roles "Student" and "Student Assistant"; patrons are students (whole paper) | Roles are **Patron** and **Library Staff**; Patron = **Student or Faculty**; program required for students only (`lib/auth/permissions.ts:3`, `components/common/RoleBadge.tsx:19`, SQL `:89`, `components/auth/OnboardingForm.tsx:175`) | Add a role-mapping note once; add faculty patrons. |
| P14 | SA modules come with the role (L409-419, REQ059-065) | Each SA module needs a Super Admin–granted permission (`manage_inventory` / `manage_circulation` / `manage_attendance`) + ACTIVE status (`lib/auth/permissions.ts:11-16`, `app/(authenticated)/circulation/layout.tsx:18`) | Add the permission matrix. |
| P15 | SAs "manage individual book copies" in a copy-level table (L319, L409, REQ059) | Inventory is **read-only** for SAs; rows are **titles** (avail/total), copies + QR inside book details (`app/(authenticated)/inventory/page.tsx:72`, `components/inventory/InventoryTable.tsx:63`) | Read-only, title-level, QR view/print. |
| P16 | Librarian sets status "Active and Pending" only; sees "all registered users" (L213, L392, REQ047) | Librarian can also set **Inactive**, edit profile fields, view borrowing history; cannot see Super Admins or edit other librarians (`app/(authenticated)/users/[id]/UserDetailClient.tsx:247`, `app/api/users/route.ts:51,150`, `lib/actions/users.ts:61`) | Document actual permissions. |
| P17 | Account becomes Pending "upon submission" of onboarding; only Super Admin approves (L426, REQ069-070) | Pending from **sign-up**; **Librarian or Super Admin** approves (SQL `:713`, `lib/actions/onboarding.ts:55`, `UserDetailClient.tsx:202`) | Fix lifecycle + approvers. |
| P18 | Profile is fully "view-only"; shows "security status/flags"; Librarian profile shows academic program (L198, L221, L259, REQ039/051/067/078) | Users can upload/crop/remove avatar; only a static "Account Access" card, no security flags; program shown only for student patrons (`components/settings/profile/AvatarManager.tsx:156`, `components/settings/sections/ProfileSection.tsx:66`, `PersonalInfoForm.tsx:115`) | Fix wording. |
| P19 | Attendance exit time is the "exact timestamp" of exit (L369, L394, L419) | Forgotten sessions auto-closed at closing time, tagged "No Log Out" (SQL `:667`) | Add auto-closure. |
| P20 | Scanning cards at entry/exit tracks attendance in one flow (REQ026/048/065) | Staff toggle **Check-In / Check-Out** mode; check-out fails without check-in; re-scan within 60 s refreshes check-in (`app/(authenticated)/attendance/AttendanceClient.tsx:83-116`, `lib/actions/attendance.ts:42,262`) | Describe the modes. |
| P21 | Complete/all historical records (REQ013, REQ076) | Records over 1 year old are archived (Super Admin only); attendance list capped at 10,000 rows (`lib/actions/attendance.ts:370`, SQL `:1517`) | Mention archiving + limits. |
| P22 | Camera/QR failure = transaction fails (L444) | Typed IDs, handheld scanners and manual card/student ID are supported; camera is optional (`components/circulation/steps/ScanStep.tsx:149`, `lib/actions/attendance.ts:91`) | Fix limitation. |
| P23 | Librarians manually input accession numbers (L442) | Accession numbers auto-generated `ACC-00001`; DDC fetched from Open Library when available (SQL `:79`, `lib/isbn-lookup.ts:86`) | Keep only "DDC when metadata is missing". |
| P24 | "Batch account resets" for the new school year (L371, REQ032) | Reset suspends **all patrons, faculty included** (SQL `:1468-1474`) | Decide intent (see S1); document. |
| P25 | Copy acquisition/disposal never mentioned | Per-copy Bought/Donated, price, Sold/Donated out/Lost/Maintenance (`supabase/migrations/20261119120000_book_copy_lifecycle.sql`) | Add to Inventory scope. |
| P26 | Audit trail covers "all administrative activity" and is "immutable" (L373, REQ085) | Auditing is opt-in per action (attendance not audited); inserts deferred, failures only logged; ISBN import **updates** an existing audit row (`lib/actions/action-utils.ts:116`, `lib/audit.ts:43`, SQL `:1918-1926`) | Narrow the claim, or fix system (S6). |

### Minor

| # | Item | Fix |
|---|---|---|
| P27 | Menu names: "Category Module", "My Borrow", "Setting(s) and Policies", "Visitor Logs" vs app **Catalog, My Borrowing, System Policies, Attendance Logs** (`components/layout/ProtectedNav.tsx:89-97`) | Rename everywhere incl. figure captions. |
| P28 | Copy-paste role errors: L301, L327, L384, L390, L417, L430 (e.g. Student "Category" module says "Student Assistant") | Fix role names. |
| P29 | Return requires student ID QR + book QR (REQ011/044) | Checkout = card + copy; Return = copy only. |
| P30 | Reservations "approved" (L546) | Automatic: READY or queued, promoted on return. Say "ready for pickup". |
| P31 | Catalog missing from Super Admin/Librarian scope | All roles can browse Catalog. |
| P32 | "Q&A support log for troubleshooting" (L371, REQ031/049) | It's an FAQ editor shown on dashboards — call it FAQ management. |
| P33 | Tech background: html5-qrcode "scanning and generating" (L505) | Scanning only; `qrcode` package generates. |
| P34 | Nodemailer listed twice; OTP wording (L140, L509) | Dedupe; Nodemailer sends due-soon/overdue/test emails only. |
| P35 | Zod validates "environment variables" (L531) | Not implemented — drop or implement. |
| P36 | Table 2 lacks Node 24 / npm ≥ 11, Next 16, React 19; "Microsoft 0365" typo (L557-562) | Add versions, fix typo. |
| P37 | Table 4: "Integrated sound card" under Graphics (L577) | Fix; list webcam/handheld scanner as optional. |
| P38 | REQ082: downtime tied only to Microsoft O365 | Add Vercel + Supabase. |
| P39 | Notifications "drop-down panel" (L196, L375, L436); student notifications scope thinner than others | It's a modal dialog; all roles share /notifications with tabs, type filter, clear read. |
| P40 | Announcements "to all users" (L371, REQ030) | Audience selector; default Patrons & Library Staff. |
| P41 | User search "by name or email" (REQ023) | Also by student ID. |
| P42 | No Use Case Diagram in List of Figures though L544 says one was made; no flowcharts for Notifications, SA Catalog, Librarian Audit Logs, Report Builder | Add figures or adjust text (figure images weren't checked). |

---

## B. System should change (code bugs found while auditing — all verified in code)

| # | Bug | Evidence | Fix |
|---|---|---|---|
| S1 | Annual "student" reset also suspends **faculty** | SQL `annual_student_reset()` `WHERE role = 'patron'` (`:1471`) | Add `AND patron_type = 'student'` (or rename to patron reset). |
| S2 | Librarians can **suspend/archive** via direct DB update even though the API restricts this to Super Admin | trigger returns early for librarian (SQL `:785`); test expects it (`test/db-schema-and-rls.test.ts:813`) | Enforce status rules in trigger; update test. |
| S3 | `/api/notifications/maintenance` and `/api/test-email` allow librarians though the Lifecycle UI hides them | `route.ts:13`, `route.ts:77` | Limit to `super_admin`. |
| S4 | `/inventory/add` page opens for Library Staff with `manage_inventory`, but saving is rejected | `app/(authenticated)/inventory/add/page.tsx:16-22` vs `lib/actions/catalog/books.ts:103` | Gate page to managers. |
| S5 | Faculty profile shows "Academic Program: Not Assigned" | `app/(authenticated)/profile/page.tsx:17-26` doesn't pass `patron_type` | Pass it. |
| S6 | Audit row mutated during ISBN import (not append-only) | SQL `:1918-1926` `ON CONFLICT DO UPDATE` | Append rows; optionally block UPDATE/DELETE on `audit_logs`. |
| S7 | Analytics high-demand modal denies librarians edit controls | `app/(authenticated)/analytics/AnalyticsClient.tsx:414` | `super_admin \|\| librarian`. |
| S8 | Hold-expiry default: DB 3 days vs UI fallback 7 days | SQL `:2339` vs `lib/actions/policy-constants.ts:47` | Pick one. |
| S9 | Default FAQ #2 points to a "report action" that doesn't exist | `lib/actions/policy-constants.ts:68` | Reword FAQ. |
| S10 | Users can change own address/phone/department after onboarding (UI says read-only) | `lib/actions/onboarding.ts:39-55` (no completed gate), owner RLS | Gate onboarding re-submission. |
| S11 | Digital card back says "Surrender this card at the end of the semester" | `components/library/DigitalCard.tsx:310` | Reword for a digital card. |

---

## C. Debate outcomes worth knowing

- **Withdrawn after debate (not misalignments):** circulation "immediately upon scanning" (preview→confirm is fine for a performance NFR); public `/book/[id]` vs O365-only (auth claim, not catalog); unverifiable performance/uptime/browser NFRs (move to verification limits); OTP *implementation* claim (paper only says Nodemailer *can* send OTPs — still reword); Mailtrap (it is the configured example SMTP).
- **Disputed, Claude's call:** Dual-scan return (P29) kept as Minor wording. My Attendance 3 vs 4 columns dropped (status shown inline). "Approved" reservations kept as Minor (P30).
- **Unverified:** figure images, calendar dates, stakeholder interviews, deployment plan, Azure tenant MFA.
