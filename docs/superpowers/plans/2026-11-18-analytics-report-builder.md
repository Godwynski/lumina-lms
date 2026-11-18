# Analytics Report Builder

## Product decisions

- Analytics is the entry point for reports. Keep its existing overview for librarians and super admins and put **Build report** in its header. An active assistant with attendance or circulation permission lands in the builder with the corresponding datasets. Keep both log pages in navigation and preserve personal borrowing downloads.
- The builder uses a section list, settings for the selected section, and a preview of the output. Staff can start with a dataset or load a template, set shared or section-specific dates, and add, reorder, or remove chart and table sections.
- Use the existing application theme and accessible form controls. Keep format selection and export at the top. On narrow screens, stack sections, settings, and preview in task order.
- Audit Logs retains its independent event export. Record report generation as a separate audit event with format and datasets, excluding report contents and search terms.

## Data and output

| Dataset | Time basis | Chart examples | Detail examples |
| --- | --- | --- | --- |
| Attendance | Check-in date | Visits, distinct visitors | Check-in, check-out, patron, status |
| Borrowing | Loan, return, or settlement date | Loans and returns | Title, due date, status, fine resolution |
| Books and inventory | Current catalog snapshot | Titles, total copies, available copies by category or location | Title, ISBN, location, available and total copies |
| Users | Account creation date | Registrations | Name, email, role, account status |

Use inclusive Manila calendar dates and define each count at its actual grain. Zero-fill trend buckets. Distinct visitors are counted within each bucket. Keep current inventory distinct from historical report dates. Preserve dataset access and the user directory role restrictions server-side. Sensitive fields are opt-in. Use a deterministic paged read, reject sections exceeding the synchronous processing limit, and never silently truncate an export.

Attendance and borrowing reports use the same live records as the operational logs. Show the archive exclusion in the preview and report scope so older-period counts can be interpreted correctly. Report access uses the current archive permissions.

PDF uses the print-layout preview and the browser's print/save dialog. Excel uses one tab per section and CSV exports the selected section's data. Preview table rows are sampled with the full row count visible. Render the full authorized result when exporting, and show the file's scope in the preview. Browser-local templates store only report settings for the signed-in account.

## Implementation and verification

1. Test authorization, input validation, Manila boundaries, and aggregation. Build a shared report configuration and a server action reusing the authenticated Supabase session and existing audit logger.
2. Test the editor with the real UI and a controlled data boundary. Implement dataset selection, date/grouping controls, column choices, section ordering, live preview, templates, and downloads.
3. Update desktop and mobile log tests to cover the intended removal and personal-history behavior. Connect Analytics navigation and the header while preserving the existing Analytics summary actions.
4. Run focused tests, the full Vitest suite, and typecheck. Review desktop and mobile layout with Brave when an authenticated browser session is available.
5. Keep historical successful catalog imports out of the global banner. Preserve feedback for current imports and the ability to review failed jobs.
