# Lumina Library Management System: Complete System Analysis & Module Tree

## 1. Executive Summary
The Lumina Library Management System is a comprehensive, web-based platform designed to modernize operations at the STI College Alabang library. By leveraging Microsoft O365 authentication and QR-code scanning, the system mitigates operational inefficiencies and ensures real-time data accuracy. 

This analysis strictly reflects the **currently implemented features** in the system repository, organizing the exact modules and sub-modules available to the Staff (Admin/Librarian) and Patron (Student) roles.

---

## 2. System Module Tree (Role-Based)

```text
Lumina Library Management System
│
├── 1.0 Admin / Librarian (Management & Operations)
│   ├── 1.1 Authentication (O365 SSO)
│   ├── 1.2 Dashboard (Inventory View)
│   │   ├── 1.2.1 View Catalog (with Search)
│   │   ├── 1.2.2 Filter by Category & Sort (Title/Availability)
│   │   └── 1.2.3 Add Item (Quick Action to Catalog)
│   ├── 1.3 Circulation
│   │   ├── 1.3.1 Checkout Flow (Scan Student QR -> Scan Book QR)
│   │   ├── 1.3.2 Return Flow (Scan Book QR)
│   │   └── 1.3.3 Reset / Refresh Circulation Wizard
│   ├── 1.4 Borrow History
│   │   └── 1.4.1 View Admin's Borrow History (Filtered by Status)
│   ├── 1.5 User Directory
│   │   ├── 1.5.1 View & Search Users
│   │   └── 1.5.2 Edit User Information
│   ├── 1.6 Settings and Policies
│   │   ├── 1.6.1 Circulation Policies
│   │   ├── 1.6.2 Reservations Policies
│   │   ├── 1.6.3 Identity Policies
│   │   ├── 1.6.4 Categories Management
│   │   ├── 1.6.5 System Announcements (Broadcast)
│   │   ├── 1.6.6 Support & FAQs Management
│   │   ├── 1.6.7 Lifecycle (Annual Reset Tool)
│   │   └── 1.6.8 Policy Simulation Panel
│   ├── 1.7 Profile
│   │   ├── 1.7.1 View/Edit Account Details (Avatar, Address, Phone, Department)
│   │   ├── 1.7.2 Intelligent Alerts Toggle
│   │   └── 1.7.3 Account Archive Option (Delete Account)
│   ├── 1.8 Audit Logs (Admin Only)
│   │   └── 1.8.1 View System Activity & History
│   ├── 1.9 Notifications
│   │   └── 1.9.1 View System Alerts & Messages
│   └── 1.10 Security
│       └── 1.10.1 Identity & Access Information
│
└── 2.0 Student (Patron Access & Self-Service)
    ├── 2.1 Authentication (O365 SSO)
    ├── 2.2 Dashboard
    │   ├── 2.2.1 Digital Library Card (Unique QR, Status, Expiry)
    │   ├── 2.2.2 Borrowed Books Counter
    │   ├── 2.2.3 My Active Borrows List
    │   ├── 2.2.4 My Reservations & Holds Queue
    │   └── 2.2.5 Support & FAQs Viewer
    ├── 2.3 Catalog
    │   ├── 2.3.1 Remote Search & Filtering
    │   ├── 2.3.2 Real-time Availability Status
    │   └── 2.3.3 Book Reservation Requests
    ├── 2.4 Borrow History
    │   ├── 2.4.1 Personal Active Loans
    │   └── 2.4.2 Personal Returned Items
    ├── 2.5 Profile
    │   ├── 2.5.1 View/Edit Account Details (Avatar, Address, Phone, Department)
    │   ├── 2.5.2 Intelligent Alerts Toggle
    │   └── 2.5.3 Account Archive Option (Delete Account)
    ├── 2.6 Notifications
    │   └── 2.6.1 View System Alerts & Messages
    └── 2.7 Security
        └── 2.7.1 Identity & Access Information
```

---

## 3. Detailed Functional Analysis

### 3.1 Admin & Librarian Roles
The system treats Admin and Librarian roles with unified operational access to prevent bottlenecks. The current implementation emphasizes rapid task execution:

*   **Dashboard (Inventory):** Unlike traditional dashboards filled with charts, the Lumina staff dashboard acts directly as the Catalog/Inventory manager. Staff can immediately search, sort by availability, filter by categories, and trigger the "Add Item" flow directly from the main view.
*   **Circulation:** Features a step-by-step wizard for both check-out and return flows, fully reliant on QR code scanning to eliminate manual data entry. A built-in "Reset" feature allows staff to quickly clear the wizard and start a new transaction.
*   **Borrow History:** Provides a searchable history ledger, currently configured to display the admin's transaction history.
*   **User Directory:** Allows staff to search through registered students and directly edit specific user information when required.
*   **Settings and Policies:** A highly comprehensive configuration suite. It includes specific sections for Circulation, Reservations, Identity, Book Categories, System Announcements, and Support FAQs. It also features a "Policy Simulation Panel" to test rule changes and an "Annual Reset" lifecycle tool for ending the academic year.
*   **Profile:** Allows staff to manage their personal information, toggle "Intelligent Alerts", and access the danger zone "Account Archive" option.
*   **Audit Logs:** A dedicated interface exclusively for Admins to view a historical log of system actions and policy changes.
*   **Notifications:** A centralized system-wide notification center for alerts and messages.
*   **Security:** A view displaying identity and access credentials information.

### 3.2 Student Role
The Student interface prioritizes self-service and minimizes library friction.

*   **Dashboard:** The focal point for the student. It prominently displays their Digital Library Card with a dynamic QR code for easy scanning at the Circulation desk. It also aggregates their current "Active Borrows", their "Reservations & Holds" queue, and provides an expandable "Support & FAQs" section.
*   **Catalog:** A dedicated module where students can remotely browse the library's offerings, check stock, and place items on hold without needing to visit the physical library.
*   **Borrow History:** A simplified ledger where students can track their current and past borrowing activities.
*   **Profile:** Mirrors the staff profile capabilities, allowing students to update their contact details, toggle "Intelligent Alerts" for due dates, and archive their account if leaving the institution.
*   **Notifications:** Allows students to view their personal library alerts, due dates, and system announcements.
*   **Security:** A read-only view outlining how the school manages their account access.

---

## 4. Current System Interconnectivity
1.  **Catalog to Dashboard:** The catalog is the primary view on the Staff Dashboard, making inventory management the default state upon login.
2.  **Settings to Student View:** Content configured in the **Settings -> Support (1.6.6)** and **Announcements (1.6.5)** modules immediately reflect on the **Student Dashboard (2.2.5)**.
3.  **Circulation to Profiles:** The **Circulation (1.3)** scanner directly reads the QR code generated from the **Student Dashboard (2.2.1)** to link transactions automatically.
