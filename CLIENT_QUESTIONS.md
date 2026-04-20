# System Audit & Configuration: Client Questionnaire

This document contains required clarifications needed from the client to finalize the system's Audit Logs, Penalties, and Governance modules.

## 1. User & Scale Management
- [ ] **Capacity and Load:** Roughly how many active users (students, faculty, administrative staff) are you expecting the system to handle concurrently on a daily basis?
- [ ] **Record Archiving:** How long do you need to retain records of inactive users? Do they get archived when they graduate/leave, or should they be fully deleted from the database?
- [ ] **Custom Roles:** We currently have standard roles implemented (`Admin`, `Librarian`, `Member`). Are there any custom roles you need? (e.g., a "Student Assistant" role that can process checkouts but cannot modify system policies).

## 2. Violations, Penalties & Suspensions
- [ ] **Suspension Triggers:** What exactly warrants an automatic system-level suspension of a user's account? 
  - *Examples: 3 overdue books simultaneously, reaching a specific unpaid fine limit, etc.*
- [ ] **Manual Overrides:** Who resolves suspensions? Can a librarian override an automated suspension, or does that require a top-level Admin?
- [ ] **Fines Structure (if applicable):** If you are tracking monetary penalties, what is the exact calculation rate? (e.g., $0.50 per day per overdue item). Do you cap the maximum penalty per item?

## 3. Circulation & Borrowing Policies
- [ ] **Borrowing Limits:** What is the maximum number of items a standard user can check out at once? Does this limit change based on user roles (e.g., Faculty borrow limits vs. Student borrow limits)?
- [ ] **Loan Durations:** What is the standard duration for a checkout? Are there special categories of books that have restricted checkout times (e.g., reference books that are overnight only)?
- [ ] **Renewals:** Can users renew books through the system online? If so, what is the maximum number of times a book can be renewed before the user must physically present it?

## 4. Audit Logging & Compliance
- [ ] **Tracking Scope:** For the administrative audit logs, what specific actions are critical for you to track for compliance purposes? 
  - *Examples: Tracking when penalties are manually waived, when a user's role is elevated to admin, or when system policies are changed.*
- [ ] **Data Retention:** How far back do you legally or operationally need the Audit Logs to go? (e.g., 30 days, 6 months, 1 year, or forever?) *Note: Keeping infinite logs can increase database storage costs.*
