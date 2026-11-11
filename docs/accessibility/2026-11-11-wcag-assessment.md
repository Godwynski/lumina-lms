# WCAG 2.2 AA remediation assessment

Assessment date 11 November 2026. Branch `wcag`. Target WCAG 2.2 Level AA.

## Implemented changes

- Keyboard navigation retains visible focus, accessible names in collapsed navigation, current-location state, and mobile sidebar dismissal. Skip links move focus to content. Controlled dialogs restore opener focus and constrain their scrollable height.
- Shared input borders, inactive tabs, status text, toast text, digital card labels, audit empty states and dashboard empty states have increased contrast. Dialog close controls and directory selection controls have larger targets.
- Circulation moves focus to the new stage after checkout/return transitions, preserves entry focus and announces scanner errors. Attendance restores focus to the launch control after dismissal.
- Catalog cards, notifications and mobile directory rows separate actions into native controls. Notifications use a dialog with ordinary navigation and action buttons.
- Recovery forms expose persistent error/success messages, support autofill and report busy state. Profile cropping includes direction controls as an alternative to dragging.
- Analytics provides exact chart data in expandable tables. Staff icon actions and policy hints have accessible names. Page titles identify additional routes and avoid repeated application-name suffixes.

## Recorded verification

Browser Chrome 152.0.7977.76 on Windows. Automated checks use axe-core WCAG A/AA tags through WCAG 2.2, at widths of 1280 and 320 CSS pixels. Reduced motion was enabled in route scans.

Signed-in route scans used a local HTTP fixture with synthetic sessions and records, isolated from the configured database. Tested roles include super administrator, librarian, student assistant and student. Public scans used an anonymous session.

64 final route/viewport scans returned zero violations for the selected WCAG rules, with no document horizontal overflow. The route list below describes the rendered fixture states, including empty lists.

- staff — /dashboard, /inventory, /analytics, /audit, /users, /attendance, /circulation, /policies, /security, /users/new, /inventory/add.
- student — /student-catalog, /profile, /history, /notifications.
- assistant — /dashboard, /inventory, /circulation, /attendance, /history.
- librarian — /dashboard, /inventory, /circulation, /users, /analytics, /attendance.
- public — /, /forgot-password, /update-password, /error, /book/00000000-0000-0000-0000-000000000000, /does-not-exist.

Additional Chrome interaction checks passed for desktop and mobile skip navigation, collapsed navigation names, mobile sidebar Escape dismissal and focus restoration. A separate rendered component fixture exercised an invalid card, checkout identification, book entry, review, successful checkout, successful return, attendance and camera-error dialog. Each checked stage returned zero axe violations. Focus moved to the correct wizard stage and returned to Launch Scanner after Escape.

Regression tests cover attendance dialog focus and controlled dialogs without a Radix trigger.

## Assessment limits

The recorded checks support the changes above. Complete WCAG conformance has not been established. Automated rules cover part of the standard, and synthetic records do not exhaust all production states.

The following remain unverified and need explicit evaluation before a full conformance claim.

- NVDA and other assistive technology announcements through complete workflows.
- Microsoft OAuth and recovery email journeys against an identity provider.
- Populated production variants of dynamic book/user detail pages, real permissions and server validation outcomes beyond the synthetic fixtures.
- Complete 200% text resizing and text-spacing evaluation, all pointer-input interactions, and a criterion-by-criterion manual review of every supported state.
- Accessibility of generated PDF/image exports and third-party content.

The source standard requires complete pages and processes when assessing conformance. See [W3C conformance requirements](https://www.w3.org/TR/WCAG22/#conformance-reqs).

## Build and repository checks

Production build and TypeScript checks passed. All 52 Vitest files passed with 1,021 tests, including attendance and dialog focus regressions. Lint completes with two existing internal-navigation warnings in ModernInventoryClient and use-logout. No lint errors were found.
