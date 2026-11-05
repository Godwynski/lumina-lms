# Lumina LMS — UI Audit and QA Report

**Audit date:** 2026-11-06 (workspace date)  
**Scope:** Application-wide UI, interaction logic, accessibility, responsive implementation, feedback states, and consistency.  
**Deliverable:** Findings and regression checklist. No application fixes were made during this audit. The existing policy input-box change was included in the reviewed working tree.

## Verdict

The UI has a reusable component foundation, but release readiness is held back by interaction defects: stale policy values can overwrite newer changes, a replacement import file can leave the previous file's records importable, refreshing the dashboard can remove its card QR, and several keyboard actions trigger the wrong control. Circulation and attendance also need stronger handling of in-flight requests and repeated scans.

This is a comprehensive **source-led audit with targeted automated checks**, not a completed visual or device certification. Findings marked **S** are supported by current source and connected callers. Their reproduction steps describe how to verify the behavior; they were not all executed in a browser. Findings marked **R** need runtime confirmation of timing or deployment conditions. No finding is presented as a measured contrast failure or a witnessed mobile overflow.

### Summary

| Priority | Count | Meaning |
|---|---:|---|
| P0 | 0 | No universally blocking defect demonstrated |
| P1 | 7 | Important workflow, data integrity, or keyboard-access blocker |
| P2 | 25 | Functional, accessibility, responsive, or recovery issue |
| P3 | 3 | Lower-impact presentation or consistency issue |
| Separate release risk | 1 | Production demo-login exposure requires deployment verification |
| **Total UI findings** | **35** | IDs UI-01 through UI-35 |

Priority reflects user impact and available evidence. Missing accessible names and broken keyboard operation remain accessibility defects even when listed as P2; this report is not a WCAG conformance declaration.

### Provisional implementation health

| Dimension | Source-only score | Assessment |
|---|---:|---|
| Accessibility | 2/4 | Focus styles and Radix primitives exist; nested key handlers, unnamed controls, and mouse-only cards undermine them |
| Performance | 3/4 | Font swapping, lazy motion, pagination, and streamed shell are present; no runtime performance measurement completed |
| Responsive design | 2/4 | Responsive shell and mobile renderers exist; mobile user selection loses functionality |
| Theming | 3/4 | Shared light-theme tokens are established; no shipped dark-theme requirement was found |
| Implementation integrity | 2/4 | Shared patterns exist, but state synchronization and failure handling are inconsistent |
| **Total** | **12/20** | **Provisional source assessment; significant fixes needed** |

These scores summarize implementation evidence, not Lighthouse, axe, Core Web Vitals, measured contrast, or physical-device results. The performance score has lower confidence than the interaction findings.

## Remediation status (2026-11-06)

All 35 findings and R-01 have a code fix on branch `worktree-ui-audit-fixes`. Verified with `npm run typecheck`, `eslint` (no new warnings), and the full Vitest suite (50 files, 1011 tests, including new `test/ui-audit-regressions.test.tsx`). **No browser, device, camera, or screen-reader pass has been run yet**, so each "Retest" step below still applies.

| ID | Fix | Still needs runtime check |
|---|---|---|
| UI-01 | Only explicit edits are kept locally; untouched fields follow live updates. If another admin changes a field you edited, a prompt asks which value to keep and Review is blocked until resolved. | Two-session test |
| UI-02 | New file selection and every parse failure clears parsed rows; results from a superseded file are ignored; Import disabled until the current file parses. | Replacement-file fixtures |
| UI-03 / UI-24 | Hydrated QR/avatar kept separately from refreshed profile props. Asset load failure shows Retry; export is disabled until the QR is ready and failures show a toast. | Dashboard refresh, export |
| UI-04 | Card ignores key events from nested controls; reserve wrapper stops keydown too. | Keyboard |
| UI-05 | Dashboard/activity cards are now native links (`CardLink`) or buttons (`CardButton`). | Keyboard |
| UI-06 | Reset/mode switch bumps an operation id; older responses are dropped. Mode/Reset locked while a transaction commits. | Delayed responses |
| UI-07 | Scanner accepts the same code again only after it has been out of view for 3 s. Server skips a camera Time In within 60 s of a Time Out. | Physical scan, isolated DB |
| UI-08 / UI-09 | `startScanner` is now stable (refs + constant default formats), so Stop stays stopped. Switch Camera passes the new facing mode explicitly. | Two-camera device |
| UI-10 | All History search runs on the server; "Load older records" extends the window; the footer states how many records are shown. | >300 rows |
| UI-11 / UI-12 | Row keyboard handler ignores nested controls; `<tr>` keeps row semantics. Mobile rows get named checkboxes plus "Select all". | Mobile widths |
| UI-13 | Reset All updates the URL once. | — |
| UI-14 / UI-15 | Edits no longer send `is_active: true`. New-category slug follows the name until edited by hand; existing slugs never change automatically. | — |
| UI-16 | Audit timestamps formatted in Asia/Manila and labelled "Manila, UTC+8". | — |
| UI-17 / UI-18 | Analytics has separate error state with Retry. Analytics and Users ignore responses from older requests. | Slow network |
| UI-19 / UI-20 | Notifications page searches the server, has "Load older notifications", and shows how many older unread remain. Fetch failures show an error with Retry instead of "all caught up". | >50 notifications |
| UI-21 / UI-22 | Full page shows complete text (bell preview stays short). Mark-read button no longer navigates by keyboard. | — |
| UI-23 | Reserve callback passes the pickup expiry; "Ready (Until )" can no longer render. | — |
| UI-25 | `FieldGroup` and a new `Field` wrapper link labels to `Input`/`Textarea`/`SelectTrigger` automatically; hand-rolled forms converted. | Accessibility tree |
| UI-26 / UI-27 | Named: permission switches, pagination, sliders, cropper zoom, inventory/users icon buttons, search fields, sort/filter triggers, export column checkboxes. Toggle filters expose `aria-pressed`. Onboarding label points at its trigger. | Accessibility tree |
| UI-28 | Number fields keep the typed draft, validate whole numbers and range inline, and never commit an invalid value. | — |
| UI-29 / UI-30 | Skip link to `#main-content` added; Settings inner `<main>` changed to `<div>`. | Keyboard |
| UI-31 | Add-book page uses `NavigationGuard`. Browser Back is still not intercepted (same limitation as the existing guard). | Back button |
| UI-32 | Create-user is a real `<form>` with `type="email"` and autocomplete. | — |
| UI-33 | Book card covers derive from the prop; only a failed URL falls back. | — |
| UI-34 | Profile values wrap instead of truncating. | 320px / 200% zoom |
| UI-35 | 404 action renamed "Go to Dashboard"; error page no longer claims the team was notified; both use `Button asChild` (no button inside link). | — |
| R-01 | Demo buttons show in local dev, and in production only when `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`. | Set the flag on the demo deployment |
| Toast width | Toasts capped to viewport width; long titles wrap. | 320px |

## QA execution and limitations

| Check | Result | What it establishes |
|---|---|---|
| `npm run typecheck` | PASS, exit 0 | Current TypeScript source compiles |
| Targeted Vitest run | PASS: 3 files, 71 tests | Existing navigation/loading and adversarial navigation assertions passed |
| Impeccable detector over `app` and `components` | Completed; 2 warnings | Stylistic candidates only; manually assessed below |
| Local Next.js development server | Started successfully after sandbox child-process restriction | Server startup succeeded; this is not route or browser validation |
| Browser-use connection | BLOCKED | No DevToolsActivePort; daemon did not connect, so no rendered-page evidence was obtained |
| Lighthouse / axe on rendered pages | NOT RUN | No automated accessibility score or node-level runtime results |
| Signed-in role walkthroughs | NOT RUN | No student, assistant, librarian, or super-admin end-to-end completion claim |
| Physical camera / QR scanning | NOT RUN | Scanner findings come from callback and state-flow inspection |
| Visual desktop/mobile/zoom/contrast checks | NOT RUN | Pending matrix below is required before visual sign-off |

Targeted test command:

```text
npx vitest run test/navigation-and-loading-states.test.ts test/challenger-m1-empirical-navigation.test.tsx test/challenger-m1-adversarial.test.tsx
```

The tests use mocked dependencies/source assertions and do not establish real camera behavior, production authentication, rendering fidelity, or transaction correctness. Vite also emitted a future configuration-loader compatibility warning; it did not fail the run. The audit did not run the full suite, a production build, or database-mutating tests.

## Coverage map

| Surface | Reviewed implementation | Runtime coverage |
|---|---|---|
| Landing and authentication | Hero/demo entry, auth forms, password recovery/update, onboarding, pending/error paths | Source only |
| App shell/navigation | Sidebar, desktop/mobile headers, breadcrumbs, navigation guard, page landmarks, global CSS | Source only |
| Dashboard | Student/assistant/staff branches, activity cards, shortcuts, live refresh, support | Source + targeted existing navigation tests |
| Student catalog | Search, sorting, filters, cards, detail/modal, reservation and cancellation callbacks | Source only |
| Borrowing history | List/filter states and navigation | Source only |
| Profile/library card | Read-only fields, avatar/cropper, card assets, QR preview and exports | Source only |
| Notifications | Bell, full page, list/item, unread counts, fetching and filtering | Source only |
| Circulation | Checkout/return steps, review/success, lookup/reset/mode changes, shared scanner | Source only |
| Attendance | Manual entry, scanning, stop/switch, history/search/pagination, repeated scans | Source only |
| Inventory | Grid/cards, search/filter/reset, import/export, add-book and cover/metadata forms | Source + targeted existing navigation tests |
| Users | List/mobile rows, selection/bulk actions, create/detail forms, assistant permissions | Source only |
| Policies/System Core | Fields, live refresh, dirty state, review/commit, simulation, category/identity/FAQ managers | Source only |
| Analytics | Summary requests, date-range state, charts, loading/error presentation | Source only |
| Audit logs | Viewer, timestamp presentation, date filters, export/import controls | Source only |
| Shared primitives/recovery | Table, pagination, field groups, input/slider/dialog/sidebar, not-found/error pages | Source only |

Backend paths were inspected where they explain visible UI behavior. This is not a database, authorization, or security audit. Public book rendering, actual export file contents/print output, OAuth provider interactions, and route authorization still need dedicated runtime walkthroughs.

## P1 findings

### UI-01 — Live policy refresh can convert untouched fields into rollback edits [S]

- **Location:** `components/admin/policies/PolicyLayout.tsx:117`, `:126`, `:136`, `:191`.
- **Evidence:** Refreshed settings rebuild `initialValues`; `formData` is initialized only once. Changed keys then compare old form values to the new baseline.
- **Reproduction:** Open policies in sessions A and B. Save a setting in B. Let A refresh, then change another setting and review its commit. A's untouched old value can now be included as a change.
- **Impact:** A later save can overwrite another administrator's valid update.
- **Fix:** Rebase untouched fields on incoming settings; retain explicitly dirty edits and surface conflicts for changed server values.
- **Retest:** Untouched remote updates appear immediately; a conflicting local edit requires deliberate resolution. Review lists only intended changes.

### UI-02 — Failed replacement import leaves old records importable [S]

- **Location:** `components/inventory/ModernInventoryClient.tsx:167`, `:191`, `:198`, `:231`, `:805`, `:838`.
- **Evidence:** Selecting a new file does not clear `parsedBooks`; several failure paths clear only `importFile`. Import availability is not consistently gated on successful parsing of the current file.
- **Reproduction:** Parse valid file A; replace it with malformed JSON or an empty file B. Inspect preview and Start Import; also check the action while replacement parsing is pending.
- **Impact:** Staff can import A while believing they selected B.
- **Fix:** Clear parsed rows on selection and every parse failure; associate results with the selected file and disable import until that file passes parsing.
- **Retest:** No stale rows or enabled import action after replacement failure or during parsing. Use fixtures in a nonproduction environment.

### UI-03 — Dashboard refresh discards its hydrated card QR [S]

- **Location:** `components/library/MyCardContainer.tsx:108`, `:113`; `components/dashboard/DashboardClient.tsx:217`, `:243`.
- **Evidence:** Incoming `initialData` replaces card state, while QR asset hydration runs only on mount. Dashboard props supply `qrUrl: null`.
- **Reproduction:** Load a student's dashboard QR, then trigger a reservation cancellation or a live dashboard refresh.
- **Impact:** The scannable QR can become a placeholder until remount/reload; preview/export can use the incomplete state.
- **Fix:** Keep hydrated assets separate from refreshed profile fields, or preserve/refetch them when identity or asset version changes.
- **Retest:** QR remains usable through cancellation, attendance/borrowing updates, and repeated refreshes.

### UI-04 — Keyboard reservation activates the parent book card [S]

- **Location:** `components/library/StudentBookCard.tsx:47`, `:103`; `components/common/ReserveTitleButton.tsx:160`.
- **Evidence:** Parent Enter/Space handling accepts descendant events and prevents their default. The reservation wrapper stops clicks only.
- **Reproduction:** Tab to a catalog card's reservation button and press Enter or Space.
- **Impact:** Opens book details instead of performing the focused reservation action.
- **Standard:** WCAG keyboard operability; native control behavior.
- **Fix:** Separate sibling native detail/reservation controls; minimally ignore parent key events from descendants.
- **Retest:** Enter/Space activate exactly the focused action; no modal or duplicate reservation side effect.

### UI-05 — Dashboard action cards cannot be reached by keyboard [S]

- **Location:** `components/dashboard/DashboardClient.tsx:365`, `:386`, `:407`, `:433`, `:451`, `:469`, `:487`, `:510`, `:539`, `:625`, `:641`, `:656`; `components/dashboard/ActivitySection.tsx:64`, `:113`; `components/ui/card.tsx:9`.
- **Evidence:** Click handlers/`role="button"` are placed on plain div-based cards without focusability or keyboard activation.
- **Reproduction:** Tab through student and staff dashboards; attempt to open the affected shortcuts and borrowing/reservation cards.
- **Impact:** Keyboard users cannot operate these actions from the dashboard.
- **Standard:** WCAG keyboard operability and name/role/value.
- **Fix:** Use links for route changes and buttons for dialogs, preserving visible focus.
- **Retest:** Every visible action is reachable, named, and activated once with the expected native key.

### UI-06 — Reset/mode changes accept stale circulation responses [S]

- **Location:** `components/circulation/CirculationWizard.tsx:45`, `:61`; `hooks/use-circulation-wizard.ts:77`, `:180`.
- **Evidence:** Mode/reset controls remain active during asynchronous operations; old responses can set borrower or success state after reset.
- **Reproduction:** Delay lookup/confirmation, then Reset or switch Checkout/Return before completion.
- **Impact:** A cleared borrower can reappear; success text can describe a different mode from the completed transaction.
- **Fix:** Disable incompatible controls while processing and invalidate older response handlers with an operation generation ID.
- **Retest:** Delayed results cannot repopulate reset state or change the new mode's presentation. Test transactions only with controlled fixtures.

### UI-07 — A repeated attendance QR can reverse a successful exit [S]

- **Location:** `app/(authenticated)/attendance/AttendanceClient.tsx:84`, `:136`, `:488`; `lib/actions/attendance.ts:99`, `:136`.
- **Evidence:** Camera stays active and the same-code client cooldown lasts 2.5 seconds. After OUT, another accepted scan finds no active session and inserts IN. The server's fresh-IN protection does not cover the preceding OUT.
- **Reproduction:** With an active visit older than 60 seconds, scan OUT and keep the same code visible beyond the client cooldown.
- **Impact:** A departing patron can immediately be recorded inside again.
- **Fix:** Require explicit scanner rearming or code removal before accepting the same code again, with server protection for repeated transitions.
- **Retest:** One displayed credential produces one intended transition. Use an isolated test account/database, never live attendance.

## P2 findings

| ID | Finding / evidence | Reproduction and impact | Recommended fix / acceptance check |
|---|---|---|---|
| UI-08 [S] | **Stop can restart attendance capture.** `app/(authenticated)/attendance/AttendanceClient.tsx:198`; `hooks/use-scanner.ts:21`, `:228`. Startup effect depends on a callback recreated by state/default-array changes. | Open scanner and press Stop; another render can schedule startup after 100 ms. Failure updates can also retrigger startup. Device behavior remains untested. | Stabilize defaults/callbacks and make automatic startup follow modal-open intent. Stop stays stopped; denied/busy camera yields a stable recoverable error. |
| UI-09 [S] | **Switch Camera uses the old facing mode.** `hooks/use-scanner.ts:160`, `:230`. Delayed callback closes over the previous render. | Switch lenses while the camera is open; startup uses the preceding mode. | Pass requested mode explicitly or restart from the updated mode. Verify front/rear behavior on a two-camera device. |
| UI-10 [S] | **All History covers only 300 attendance rows.** `app/(authenticated)/attendance/page.tsx:29`; `AttendanceClient.tsx:109`, `:159`, `:228`. | Search for a record older than the latest 300; local filtering/pagination cannot retrieve it. UI implies complete history. | Server-side search/pagination with true total, or clearly disclose and provide access beyond the limit. |
| UI-11 [S] | **User checkbox Space opens its row.** `components/common/LuminaTable.tsx:70`; `app/(authenticated)/users/UsersContent.tsx:194`. | Focus a row checkbox and press Space; bubbling keydown prevents native selection and invokes row navigation. | Parent shortcuts run only when target equals currentTarget; preserve nested controls and table semantics. |
| UI-12 [S] | **Mobile user rows omit bulk selection.** `app/(authenticated)/users/UsersContent.tsx:317`; `components/common/LuminaTable.tsx:114`, `:153`. | Below `md`, desktop checkboxes disappear and the mobile renderer has none; bulk reactivation cannot be initiated. | Add named mobile selection controls/select-all. Retest with selected rows across breakpoints. |
| UI-13 [S] | **Inventory Reset All restores old filters.** `components/inventory/ModernInventoryClient.tsx:493`, `:694`. | Set category/status/sort, then reset. Three URL replacements each start from the same old parameters; the last can retain previous category/status. | Reset all parameters in one `updateParams` call; verify URL, chips, results, and page agree. |
| UI-14 [S] | **Editing an archived category restores it.** `components/admin/CategoryManagement.tsx:86`; `components/admin/categories/CategoryItem.tsx:110`. | Edit archived metadata and save; request includes `is_active: true` without choosing Restore. | Preserve active status or omit it from metadata edits. Archived items stay archived after edits. |
| UI-15 [S] | **Automatic category slug freezes after one character.** `components/admin/categories/CategoryDialog.tsx:118`. | Type History into an initially empty name; first `h` becomes nonempty slug and is reused for later keystrokes. | Track manual slug edits or derive the slug on save. Full names generate correct, predictable slugs. |
| UI-16 [S] | **Audit timestamps are labeled UTC but formatted locally.** `components/admin/AuditLogClient.tsx:612`, `:622`. | View on a Manila browser; local time is presented under UTC. | Explicitly format UTC or label the actual timezone. Check one known event in UTC and Asia/Manila. |
| UI-17 [S] | **Failed analytics load remains a skeleton.** `app/(authenticated)/analytics/AnalyticsClient.tsx:44`, `:48`, `:169`. | Reject the initial summary request; toast appears but `summary` remains null and loading placeholders persist. | Separate error/loading/empty states with inline Retry; successful retry restores results. |
| UI-18 [R] | **Older requests can overwrite newer filter results.** `app/(authenticated)/users/UsersContent.tsx:116`, `:132`; `app/(authenticated)/analytics/AnalyticsClient.tsx:44`, `:47`. | Delay request A, switch filter/range to B, complete B then A. No current-request guard prevents A replacing B. Timing reproduction pending. | Abort or ignore obsolete results using request IDs; pending state remains true for the latest request. |
| UI-19 [S] | **Older unread notifications cannot be opened.** `hooks/use-notifications.ts:35`, `:48`, `:125`; `app/(authenticated)/notifications/page.tsx:27`. | Have unread items beyond latest 50. Badge counts them, but full-page filters/search only inspect loaded items. | Paginate/query full-page search and unread state server-side; every counted unread item is reachable. |
| UI-20 [S] | **Notification failure looks like success with no messages.** `hooks/use-notifications.ts:43`; `components/notifications/NotificationList.tsx:34`. | Fail initial query; error is logged and loading clears into the caught-up empty state. | Expose retryable error independently from empty results; never claim caught up on failed fetch. |
| UI-21 [S] | **Long announcements cannot be read in full.** `components/notifications/NotificationItem.tsx:52`, `:76`, `:130`. | Create long SYSTEM/ACCOUNT content; full-page item clamps two lines and clicking only marks read. | Unclamp full-page content or supply keyboard-accessible expansion/details. Full text remains available. |
| UI-22 [S] | **Keyboard Mark as read also navigates.** `components/notifications/NotificationItem.tsx:90`, `:142`. | Press Enter/Space on the child read button; row keydown handles descendant activation and routes away. | Use sibling native actions or guard parent keydown. Mark-read changes state without navigation. |
| UI-23 [S] | **Reservation success drops pickup expiry.** `components/common/ReserveTitleButton.tsx:109`, `:128`, `:151`; `app/(authenticated)/student-catalog/StudentCatalogClient.tsx:125`. | Reserve available title from card; callback supplies two values while parent expects a third expiry value. Prop synchronization can replace fetched deadline with undefined and show `Ready (Until )`. | Pass expiry through the callback type/call. Test immediately after success with realtime delayed. |
| UI-24 [S] | **Card assets/export fail without useful recovery.** `components/library/MyCardContainer.tsx:124`, `:148`, `:264`, `:310`, `:358`. | Fail asset fetch/export or export before QR hydration. Asset/export catches suppress feedback; Export checks exporting state only. | Explicit asset readiness/error, Retry, and actionable export errors; prevent export without required QR. |
| UI-25 [S] | **Shared visible labels are not connected to inputs.** `components/common/FieldGroup.tsx:21`; `components/catalog/add/BookDetailsForm.tsx:43`; `app/(authenticated)/users/new/NewUserClient.tsx:65`; `app/(authenticated)/users/[id]/UserDetailClient.tsx:329`; `components/admin/categories/CategoryItem.tsx:48`; `components/admin/AuditLogClient.tsx:815`; `components/circulation/steps/ScanStep.tsx:173`. | Click labels or inspect accessible names. Sibling Label elements lack control IDs/htmlFor; scanner/search fields also rely on placeholders. | Extend shared field API with IDs/htmlFor or aria-labelledby. Label click focuses control; accessible name matches visible text. |
| UI-26 [S] | **Permission, pagination, slider, and responsive icon controls lack names.** `app/(authenticated)/users/[id]/UserDetailClient.tsx:549`; `components/ui/compact-pagination.tsx:54`, `:69`, `:85`; `components/settings/profile/ImageCropper.tsx:80`; `components/ui/slider.tsx:56`; `components/inventory/ModernInventoryClient.tsx:569`, `:583`, `:598`, `:715`; `app/(authenticated)/users/UsersContent.tsx:261`; `components/admin/AuditLogExportImportModal.tsx:552`. | Inspect accessibility tree at desktop/mobile widths. Adjacent text is unassociated; responsive text hides; icon-only actions expose no name. | Name actual interactive nodes, connect descriptions, and use wrapping labels for checkboxes. Confirm every control's purpose in the accessibility tree. |
| UI-27 [S] | **Student selection controls lack names or selected state.** `components/auth/OnboardingForm.tsx:146`, `:155`; `app/(authenticated)/student-catalog/StudentCatalogClient.tsx:242`, `:296`, `:312`; `app/(authenticated)/history/HistoryContent.tsx:266`. | Onboarding label points to absent trigger ID; clear-search/sort lack purpose labels; filters convey selection only through styles. | Associate trigger IDs/labels; name clear/sort; expose toggles with aria-pressed or suitable tab semantics. |
| UI-28 [S] | **Policy number editing silently substitutes values and permits a transient invalid zero.** `components/admin/policies/PolicyField.tsx:77`, `:79`, `:81`, `:211`; bounds in `lib/actions/policy-constants.ts:20`. | Clear a core policy number: handler writes `0` before min clamping despite minimum 1. Multi-digit replacement is immediately clamped on each keystroke; decimals are silently truncated by parseInt. | Preserve the user's draft string; validate integer/range on blur/commit with inline guidance. Clearing is editable and cannot commit invalid zero. |
| UI-29 [S] | **App shell has no skip-to-content link.** `app/(authenticated)/layout.tsx:77`; `components/layout/ProtectedNav.tsx:303`. | Enter the shell using keyboard and attempt to bypass repeated navigation; no skip link/content target exists in reviewed app/component source. | Add a focus-visible skip link and stable content destination. Test initial focus and return navigation. WCAG bypass-blocks concern; landmarks provide a separate assistive-technology route. |
| UI-30 [S] | **Settings nests a main landmark inside the shell main.** `components/settings/SettingsShell.tsx:20`; `components/ui/sidebar.tsx:316`; `app/(authenticated)/layout.tsx:77`. | Inspect profile/settings landmark hierarchy: SidebarInset renders main, then SettingsShell renders another main. | Keep one main landmark; use section/div for the inner settings region. |
| UI-31 [S] | **New-book draft can be lost on navigation.** `app/(authenticated)/inventory/add/AddBookClient.tsx`; compare `components/layout/NavigationGuard.tsx:14` and its usage in `components/settings/SettingsShell.tsx:17`. | Fill book metadata, then follow sidebar navigation or reload; this form has no dirty-state guard. | Apply existing draft protection to metadata/cover state. Canceling navigation retains entered data. Verify browser Back separately because the current guard covers anchor clicks/unload, not all router changes. |
| UI-32 [S] | **Create-user entry lacks native form submission.** `app/(authenticated)/users/new/NewUserClient.tsx:65`, `:79`, `:93`. | Enter new-user fields and press Enter; button-click implementation outside a form does not provide expected submission. Email input lacks email type/autocomplete. | Use form/onSubmit, email type and appropriate autocomplete. Enter and button produce one validated request with loading/error feedback. |

## P3 findings

### UI-33 — Updated inventory covers can remain stale [S]

`components/inventory/ModernBookCard.tsx:25` initializes image state from the cover prop without syncing later changes. Edit a cover while retaining the book ID, refresh data, and compare the visible cover to the updated record. Synchronize cover changes while preserving fallback behavior; test both changed URLs and broken-image recovery.

### UI-34 — Long profile values are permanently clipped [S]

`components/settings/profile/PersonalInfoForm.tsx:55`, `:64`, `:71`, `:91`, `:98`, `:108` uses truncated, fixed-height read-only values without a full-value reveal. Long email/address/program content cannot be visually verified on narrow screens. Let long values wrap or offer accessible disclosure/copy. Confirm at 320px and 200% zoom.

### UI-35 — Recovery copy promises behavior the destination does not match [S]

`app/not-found.tsx:55` labels a `/dashboard` link “Explore Catalog.” `app/error.tsx:48` says the team has been notified, while its shown reporting effect only calls `console.error`. Link directly to an appropriate catalog or rename the action; only claim notification when a reporting integration exists. Both pages also wrap buttons inside links: use the shared button's `asChild` pattern to keep a single native interactive element.

## Separate release risk

### R-01 — Privileged demo login is always exposed [S exposure; R production impact]

`components/hero.tsx:131` renders Quick Demo Access behind a constant true condition. Privileged demo identities appear at `:143`, and the authentication handler contains a shared password at `:47`. No secret value is reproduced in this report.

The visible production UI exposure is supported by source. Whether these accounts exist and hold privileges on the deployed backend was not tested. Gate demo access to a deliberately isolated demo deployment and verify that production does not provide usable shared privileged credentials. Do not validate this by entering production admin accounts during ordinary UI QA.

## Visual consistency and implementation observations

- **Preserve the established UI:** shared Input/Button/Dialog/table components, neutral colors, rounded controls, and token-based surfaces form a coherent incumbent system. Fix the defects within that system; a redesign is not needed to address them.
- **System Core inputs:** Circulation and Reservations now use numeric boxes with Days/Books indicators. The audit does not recommend restoring sliders. UI-28 covers edit/validation behavior; visual spinner/suffix overlap still needs browser inspection.
- **Typography needs a rendered readability pass:** PolicyField contains 10px core unit text and 7px non-core suffix text (`:216`); many metadata labels use tightly tracked uppercase 11px text. This is a readability concern, not a measured WCAG size failure. Verify zoom and actual screen legibility before changing hierarchy.
- **Touch targets need measurement:** the shared dialog close glyph is 16px without explicit surrounding padding (`components/ui/dialog.tsx:75`), while many controls are compact. Measure target spacing and the WCAG target-size exceptions before declaring a failure; 44px is a comfort target, not the universal AA minimum.
- **Toast overflow is a pending test:** `app/globals.css:97` forces max-content toast width and `:105` keeps titles on one line unless a description exists. A long title may exceed the viewport or its box. Test long errors at 320px; this was not promoted to a confirmed overflow defect.
- **Horizontal clipping needs inspection:** global `overflow-x: clip` (`app/globals.css:64`) can hide layout overflow rather than solve it. Test long IDs/names, tables, and fixed review bars on narrow screens.
- **Motion foundations exist:** CSS respects reduced-motion and MotionConfig uses the user preference. Chart-library animation and scanning feedback still need runtime reduced-motion checks; CSS alone does not establish behavior for JavaScript animation.
- **No dark-mode failure asserted:** the current root defines a light palette and the inspected provider does not establish a shipped theme toggle. A few dark variants are not evidence of a supported dark theme.
- **Performance remains unmeasured:** no frame-rate, LCP, INP, CLS, network, or bundle regression claim is made. Audit the production build on representative list/chart data rather than inferring speed from source complexity.

### Mechanical detector review

| Warning | Location | Disposition |
|---|---|---|
| Side accent border | `components/admin/AuditLogClient.tsx:683` | Visual style preference; no demonstrated usability defect. Excluded from issue count. |
| Bounce animation | `components/auth/OnboardingForm.tsx:80` | Motion/style review candidate; reduced-motion safeguards already exist. No demonstrated blocking behavior; excluded from issue count. |

## Positive implementation evidence

- Root declares `lang="en"`, viewport scaling permits zoom, and the app font uses `display: swap` (`app/layout.tsx`).
- Shared input/sidebar controls provide visible focus styles; sidebar trigger includes hidden accessible text.
- Dialogs use Radix primitives, shared close text, and consistent presentation. This is a useful foundation for focus handling, although each dialog still needs runtime verification.
- Authenticated layout has a responsive shell, bounded content width, streamed navigation, and mobile header.
- Global reduced-motion handling and MotionConfig are present.
- Existing loading skeletons, empty-state components, reservation dialogs, and logout confirmation provide reusable recovery/confirmation patterns.
- The targeted navigation suite currently passes. Extend it with real descendant key events and delayed response cases rather than relying only on source/markup assertions.

## Required runtime QA matrix

All rows below remain **pending** unless explicitly covered by the automated execution table. This checklist is part of the handoff, not evidence of passes.

### Environments

| Axis | Required coverage |
|---|---|
| Roles | Student, student assistant with each permission combination, librarian, super admin, pending/archived account |
| Viewports | 320×568, 390×844, 768×1024, 1024×768, 1440×900; portrait and landscape |
| Input | Mouse, keyboard only, coarse-pointer touch, front/rear camera, manual scanner entry |
| Accessibility | NVDA with Chrome/Edge; 200% zoom; 400%/320px reflow where applicable; forced colors; reduced motion |
| Network | Normal, slow responses, offline/failure, out-of-order responses, live updates while editing |
| Data | Empty, single row, multiple pages, >50 notifications, >300 attendance rows, long text, missing/broken images |

### Workflow acceptance checklist

- [ ] **Authentication:** Sign-in, invalid login, password recovery/update, OAuth cancel/failure, onboarding selection, pending/archived messaging, and safe return destination. Verify demo-access deployment policy.
- [ ] **Navigation:** Correct role links, active-page announcement, skip link, collapsed/sidebar/mobile sheet behavior, breadcrumbs, browser Back, new-tab links, and focus after route changes.
- [ ] **Dashboard/card:** Every shortcut works by keyboard; QR survives live refresh; expand/front/back/export have correct loading, success, failure, and readiness states.
- [ ] **Catalog/reservations:** Search/sort/filter/pagination agree with URL; reserve with click/Enter/Space; queue position/deadline update immediately; cancellation and unavailable-title states are correct.
- [ ] **Circulation:** Student/copy lookup, invalid codes, unavailable/archived copy, checkout and return confirmation, slow lookup/reset/mode switch, retry after failure, and accurate success wording.
- [ ] **Attendance:** Manual and camera scan; duplicate suppression; one IN/OUT per intended presentation; Stop/restart/switch camera; denied/busy/absent camera; older history retrieval.
- [ ] **Inventory:** Search/reset/category/status/sort; responsive actions; import valid/invalid/empty/replaced file; parse in progress; duplicate handling; export contents; cover refresh; unsaved add-book draft.
- [ ] **Users:** Mobile and desktop select/select-all, keyboard checkbox interaction, bulk confirmation, permission switches, create/edit validation, Enter submit, failed request/retry, rapid filter changes.
- [ ] **Policies:** Unit-labelled numeric editing, min/max/integer errors, review/discard/commit, two-session conflicts, category slug/archive/edit/restore, FAQ/identity drafts, unsaved navigation protection.
- [ ] **Notifications:** Mark-read without navigation; full long content; fetch error/retry; unread older than 50; filters/count consistency; bell/full-page synchronization.
- [ ] **Analytics/audit:** Slow/error/empty charts, Retry, range races, accessible chart information, explicit timezone, date filtering, named export columns, and export/import feedback.
- [ ] **Recovery:** 404 actions match destinations, errors provide truthful next steps, dialogs remain scrollable at short heights/zoom, focus returns to trigger, no hidden focused controls under sticky bars.
- [ ] **Visual:** Measure contrast; inspect typography hierarchy, spacing, long text, unit suffix/spinner overlap, touch targets, toast widths, card/image ratios, loading/empty alignment, and 320px reflow.
- [ ] **Performance:** Production Lighthouse/axe and browser performance traces on representative datasets; record environment, metrics, failing nodes, and screenshots instead of a score alone.

## Recommended fix order

1. **Protect data and transaction intent:** UI-01, UI-02, UI-06, UI-07. Add delayed-response, two-session, replacement-file, and repeated-scan regression tests.
2. **Restore core access:** UI-03, UI-04, UI-05, UI-11, UI-12, UI-22. Test real keyboard events on nested controls and refreshed QR state.
3. **Repair state/recovery:** UI-08–10, UI-13–24, UI-28, UI-31–32. Cover failures, pagination boundaries, and stale requests.
4. **Complete accessibility semantics:** UI-25–27, UI-29–30; then perform the runtime keyboard/accessibility-tree pass across every role.
5. **Verify and polish:** UI-33–35 and the pending visual matrix. Preserve the existing design system and retest affected workflows after any style change.

Suitable follow-up skills: `$impeccable harden` for state/error handling, `$impeccable adapt` for responsive parity, `$impeccable clarify` for labels/copy, `$impeccable audit` for a repeat technical pass, and `$impeccable polish` after functional and accessibility fixes.

## References and audit provenance

- Current source under `app/`, `components/`, `hooks/`, and connected action paths; line references point to the reviewed working tree and can shift after edits.
- Existing `docs/accessibility.md` specifies touch-visible and keyboard-visible hover actions; preserve that project convention.
- Existing graph report was used for orientation; current source was checked for findings rather than assuming the graph was fresh.
- [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), fetched for this review; used as a review checklist, with context-dependent rules evaluated against actual controls.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) are the follow-up reference standards for keyboard, names, forms, focus, reflow, and target-size verification.

The source review produced **35 UI findings and one separate deployment-dependent release risk**. Visual/browser certification remains pending for the reasons recorded above.
