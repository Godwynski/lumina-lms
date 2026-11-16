# Lumina user guide

Current operating guide for Lumina LMS. Labels shown here follow the implemented interface; account roles remain permission controlled.

## Access and account types

Sign in with an institutional Microsoft account. Lumina is a **Restricted / Authenticated OPAC**: authenticated users see catalog and circulation functions permitted by their account. Students and faculty are patrons. Student assistants are shown as Library Staff. The database role identifiers are `patron` and `library_staff`. A faculty patron may not have student-only course details.

## Patron dashboard and catalog

The dashboard presents the library card, current borrows, reservations, recent attendance, and support information. Current Borrows includes overdue loans and displays the fine accrued. A returned item with an unpaid fine remains visible as Fine Owed until settled. The My Library Card link is also available to librarians and super admins.

Browse or search the catalog to inspect availability and reserve eligible titles. Lumina catalogs physical library materials; the system does not store book purchase prices, replacement costs, acquisition dates, or donation history. Report a missing physical book to library personnel at the circulation counter.

## Circulation checkout

1. Open Circulation and choose Checkout.
2. Start the camera and scan a library card, or enter the card identifier and process it.
3. Review the patron identity and borrowing status. A blocking panel can show overdue loans and receivable fines. Library Staff must start over when blocked; librarians and super admins can use Override with a reason.
4. Scan the book/item QR code, or enter the item identifier and verify it.
5. Review patron, item, copy identifier, and due date, then select Confirm Checkout.
6. Select New Checkout to begin another transaction.

The screen uses Patron ID, Library Card, and Book / Item labels. A preview does not create a loan.

## Returns and fine settlement

1. In Circulation, choose Return and scan or enter the book/item identifier.
2. Review the borrower, item, borrowed date, and due date, then select Confirm Return.
3. For an assessed fine, choose Mark as Paid or Mark as Condoned and enter remarks when required. You may also return the item with the fine left as Receivable for later settlement in Borrowing Logs.
4. Select New Return for the next item.

## Borrowing history and settlements

Open Borrowing Logs (or My Borrowing for your own records). Use the status tabs and search to locate records. Overdue records with an unpaid fine show a Receivable badge and amount. Open an eligible record to mark the fine Paid or Condoned; a reason of at least five characters is required for Condoned.

The Settlements tab lists resolved fines, with All, Paid, and Condoned filters and fine amount, resolution, remarks, and settled date. Overdue and Settlements views include Export (.xlsx) and Print actions. Exports use the selected filters and include matching records across pages. Patrons can review their own settlement history read-only.

## Attendance

1. Open Attendance with attendance permission.
2. Select the explicit Check-In or Check-Out mode. The active mode is identified by text as well as styling.
3. Scan a library card with the camera or enter a card/Patron ID manually, then submit the action for that mode.
4. Check the result before processing another person. A recent duplicate check-in may be updated within 60 seconds; an existing check-in at or beyond that interval is reported as already checked in. A check-out requires an open check-in.

The scanner remains available for successive cards. Attendance logs show a No Log Out badge when a session was closed automatically, and exports include that status. Librarians and super admins can configure Library Closing Time in Settings & Policies; the daily maintenance job uses it to close forgotten sessions.

## Inventory and reports

Users with inventory permission can open Inventory. Switch between Cards and Table views; the table shows title, author, ISBN, category, total and available copies, and status. Filters and search apply to the selected view.

In Batch Operations, Import offers Download Template. Use the generated workbook headers when preparing a spreadsheet. Export opens the configured output options, and View Report previews the rows and columns that match the current filters. From the preview, choose Export or Print. The template contains the accepted import headers and a sample row.

## Analytics

Choose the date range to refresh the analytics summary and High Demand Catalog. Export (.xlsx) downloads a workbook with summary metrics and the high-demand list for that range. Print opens the printable analytics view.

## Users and roles

The User Directory lists accounts available to your role. Open an authorized profile to review details, change permitted settings, or see Borrowing History (librarian and super admin). New-user onboarding supports Patron Type: Student or Faculty; student-only academic fields are not required for faculty. Library Staff inventory access depends on the separately granted inventory permission.

## Audit logs and settings

Librarians and super admins can view audit logs subject to role-based visibility; a librarian does not see super-admin actor records. Import and annual reset remain super-admin functions.

Settings & Policies includes Archive Old Records for super admins. Choose a cutoff at least one year in the past, review eligible counts, download the backup workbook, and then confirm Archive. The operation archives eligible returned loans without receivable fines and closed attendance records; open loans and receivables are retained.

## Cash handling and book costing

Cash fine payments and official receipts are recorded manually in the library’s physical ledger. Lumina computes fines and tracks them as Receivable, Paid, or Condoned; it does not provide full digital accounting or official receipt issuance. Book purchase price, replacement cost, and donation/acquisition tracking are outside the current system.

## Camera recovery

Use HTTPS or localhost, allow camera access in the browser, and check whether another application is using the camera. Retry after correcting the issue or use manual card/item entry. Keep the QR steady and well lit.
