# System-wide accessibility implementation plan

Target WCAG 2.2 Level AA across the library web application, including public, student and staff experiences. Verify every applicable Level A and AA criterion on full pages and complete processes. Use the [W3C Recommendation](https://www.w3.org/TR/WCAG22/#conformance-reqs) as the acceptance standard.

## Establish the baseline

- [ ] Enumerate every App Router page, layout, error boundary, dynamic route variant, redirect destination and role-specific action. Include dialogs, menus, loading, empty, success, validation and permission-denied states. Inventory user-facing downloads and embedded content. Record which assets are necessary to finish each process.
- [ ] Run the application against disposable test data. Prepare accounts for each supported role and fixtures for available, borrowed and unavailable books. Record the commit, browser, viewport, role and steps for each run. Mark unreachable states as untested.
- [ ] Run axe on rendered pages and again after opening overlays or advancing a wizard. Inspect the accessibility tree. For each finding record the affected route and state, WCAG criterion, observed behavior, expected behavior and shared component if applicable.

## Assign Gemini work

Use Antigravity's `gemini-3.8-flash-high`. Start planning workers with `agy --model gemini-3.8-flash-high --mode plan --print "<assignment>"` from the assigned worktree. For implementation, use the same model with `--mode accept-edits`. Give each worker its route list, reproduction steps, file ownership and test fixtures. Require it to read AGENTS.md and the relevant installed Next.js guide before writing code. Collect its diff, findings and test evidence. The coordinator owns integration and reassigns any shared file to exactly one worker.

- [ ] **Shared UI first.** Own global styles, layouts, ProtectedNav, shared form controls, dialogs, buttons and AdminTableShell. Exercise skip navigation, visible and unobscured focus, dialog naming and focus restoration, field labels, status announcements and color contrast. Retest a consumer of each repaired component and integrate before branching the feature work.
- [ ] **Public and student worktree.** Own landing, public book detail, authentication and password recovery, student catalog, profile, history, notifications and policies. Trace sign-in through book discovery and detail. Check password-manager and paste support, recovery errors, search result announcements and heading order.
- [ ] **Circulation and operations worktree.** Own circulation, borrow, return, attendance and operations, including CirculationWizard and ScanStep. Exercise successful and failed scans, keyboard-accessible entry, backtracking and confirmation using test records. Verify focus after step changes, single announcements of results, and preservation of prior entries.
- [ ] **Administration and reporting worktree.** Own dashboard, analytics, audit, security, users and inventory, including creation and detail views. Test sorting, pagination, filters, row actions, error recovery, chart data alternatives and destructive confirmations. Assign any role-specific catalog administration components by path before dispatch.

## Verify the integrated application

- [ ] Merge each independently verified change into the integration checkout. Run the repository lint, typecheck, Vitest and production build scripts. Add browser regression checks for reproducible failures in shared controls and complete journeys.
- [ ] Repeat axe scans on the integrated build. Complete sign-in and recovery, catalog search, borrowing and returning, inventory editing and user management with keyboard alone and with NVDA on Windows. Record browser and assistive technology versions, actual announcements and focus destinations. Exercise mobile navigation, 200% text resizing, 320 CSS pixel reflow, target sizing, text spacing and every supported theme.
- [ ] Review all WCAG 2.2 A and AA criteria, including those outside the examples above. Record pass, fail, untested or inapplicable with evidence and rationale per criterion and affected surface. Verify shared fixes across roles and repeat full journeys after integration. Close the assessment only when every applicable item passes and all required steps are reachable. Report scope, tested build, environments, results and any unresolved barriers.
