# Lumina user guide

Reviewed against development at e5868e2 and the student-directory removal on 12 November 2026. This guide includes both changes.

## Access

Sign in through Microsoft using an institutional account. Account status, role, and delegated permissions determine available pages. Evaluation-only demo access is described in the [project README](../README.md).

## Checkout

1. Open Circulation and select Checkout.
2. Select Start camera and allow camera access, then scan the student's library card. Alternatively, enter the card identifier and select Process.
3. Check the verified student's name and identifier.
4. Scan the book copy QR code. The camera stays active between the student and book scans. For manual entry, enter the book QR identifier and select Verify.
5. Review the borrower, book title, copy ID, and due date. Match the copy ID to the label on the physical book.
6. Select Confirm Checkout. A preview alone does not record the loan.
7. After completion, select New checkout to begin another transaction.

Back preserves the current draft. Start over clears the draft and typed input, turns off the camera, and returns to the first stage. It does not undo a completed transaction.

## Return

1. Select Return in Circulation.
2. Scan the book copy QR or enter its identifier and select Process.
3. Review the borrower, book title, copy ID, borrowed date, and due date.
4. Select Confirm Return.
5. Follow any instruction to place a reserved copy on the hold shelf.
6. Select New return for the next transaction.

The camera stops when review opens. A borrower ID field is omitted when the return response does not provide it.

## Gate attendance

1. Open Attendance using an account with attendance permission.
2. Select Start camera. The scanner dialog starts the camera.
3. Present the student's physical or digital library-card QR.
4. Wait for the result beneath the preview. It shows the student's name, recorded time-in or time-out status, and recorded time in Asia/Manila.
5. Present the next card when Ready for next card appears.

The camera stays active between students. The most recent result remains visible until another result replaces it or the dialog closes. Repeated detections of the same visible QR are suppressed. The server also protects very recent time-in and time-out records from immediate reversal.

Stop camera releases the camera while keeping the dialog open. Start camera resumes it. Close the dialog to clear its result and release the camera. Switching cameras is available when multiple camera devices are detected.

For manual entry, close the scanner, enter the card ID or student number in the Attendance form, and select Log. Read the result and check the attendance log before retrying an uncertain transaction.

## Camera recovery

Use HTTPS or localhost, allow camera access in the browser, and check whether another application is using the device. Select Retry camera after correcting the issue, or use manual entry. Keep the QR steady and well lit. Camera permission and physical-device behavior can vary by browser.

## Student accounts

Open Users, search or filter the directory, and open the student's profile. Authorized staff can review the profile and use its individual status controls and Save Changes action. Pending-student activation includes a Confirm & Activate step. Available controls depend on the operator's role and selected account.

The directory has no selection checkboxes or batch-reactivation action. Process status changes through each student's profile.

## Thesis instructions

The [extracted manuscript user guide](doc-audit/parts/E_user-guide.md) is retained as source evidence. It contains older labels and workflows. Use this guide for current operation and the [audit index](doc-audit/README.md) to track manuscript updates.
