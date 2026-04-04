# API Documentation

This document provides an overview of the internal API endpoints available in the application.

## 🔐 Authentication
All API routes (except where noted) require an active session and proper role-based access control (RBAC) enforced via Supabase.

---

## 📚 Circulation
Handle the physical movement of books and digital resource management.

### `POST /api/circulation/checkout`
Checks out a book copy to a user.
- **Body:** `{ copyId: string, userId: string }`
- **Logic:** Enforces `max_borrow_limit` and checks for active penalties.

### `POST /api/circulation/return`
Processes a returned book.
- **Body:** `{ copyId: string }`
- **Logic:** Updates copy status to `AVAILABLE` and calculates any overdue fines.

### `POST /api/circulation/renewal`
Extends the due date for an active loan.
- **Body:** `{ loanId: string }`
- **Logic:** Enforces `max_renewal_count` and prevents renewal of overdue items.

---

## 👤 User & Profile
Manage student and staff identities.

### `GET /api/users`
Retrieve a list of users (Admin/Librarian only).
- **Query Params:** `query` (search by name or student ID), `role` (filter).

### `POST /api/profile-photo`
Uploads and updates the user's profile picture.

---

## ⚖️ Violations & Penalties
System for tracking student misconduct and calculating fines.

### `GET /api/violations`
Fetches violation records and statistics for the active user or all users (staff).

### `POST /api/violations`
Create a new violation record (Staff only).
- **Body:** `{ userId: string, violationType: string, points: number, severity: string }`

---

## 🛠️ Admin & Settings
Global system configuration and maintenance.

### `POST /api/admin/policy-settings`
Update global library policies (e.g., loan period, fine amount).

### `POST /api/admin/cleanup-expired-reservations`
Background task to release books that were held but never collected.

---

## 🖼️ Assets & Resources
Management of digital resources and library cards.

### `GET /api/resources/[fileName]`
Fetch a specific uploaded file or resource.

### `POST /api/my-card/assets-refresh`
Triggers a re-generation of the user's digital library card QR code.
