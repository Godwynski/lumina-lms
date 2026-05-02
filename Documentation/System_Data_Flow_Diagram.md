# Lumina Library Management System: Current System Data Flow Diagram

This document provides a Data Flow Diagram (DFD) based exactly on the currently implemented modules and functionalities of the Lumina LMS. It maps how information moves between the users, the system modules, and the database.

## Simple Mermaid Data Flow Diagram

```mermaid
flowchart TD
    %% Styling
    classDef entity fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000;
    classDef process fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,shape:rect,color:#000;
    classDef datastore fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000;

    %% External Entities
    Student[🎓 Student]:::entity
    Staff[⚙️ Staff Admin/Librarian]:::entity

    %% Core Modules (Processes)
    Auth[Authentication & Profile]:::process
    DashCat[Dashboard & Catalog]:::process
    Circulation[Circulation Wizard]:::process
    Settings[Settings & Policies]:::process

    %% Data Stores (Database)
    DB_User[(D1: User Profiles & Cards)]:::datastore
    DB_Cat[(D2: Catalog Inventory)]:::datastore
    DB_Trans[(D3: Transactions & Holds)]:::datastore
    DB_Pol[(D4: Policies & Config)]:::datastore

    %% Interactions - Authentication & Profiles
    Student -->|O365 Credentials| Auth
    Staff -->|O365 Credentials| Auth
    Auth <-->|Read/Update Profile Info| DB_User

    %% Interactions - Student Flow
    Student -->|Search & Reserve Books| DashCat
    DashCat <-->|Read Book Availability| DB_Cat
    DashCat -->|Create Reservation| DB_Trans
    DashCat <-->|Fetch Alerts & FAQs| DB_Pol

    %% Interactions - Staff Catalog Management
    Staff -->|Add/Edit Items| DashCat
    DashCat -->|Update Stock| DB_Cat

    %% Interactions - Staff Configuration
    Staff -->|Manage Limits & Announcements| Settings
    Settings -->|Save Configuration| DB_Pol

    %% Interactions - Staff Circulation (The core transaction hub)
    Staff -->|Scan Student & Book QRs| Circulation
    Circulation <-->|Validate Card Status| DB_User
    Circulation <-->|Validate Book Status| DB_Cat
    Circulation <-->|Check Borrow Limits & Fines| DB_Pol
    Circulation -->|Record Checkout / Return| DB_Trans
```

### Diagram Breakdown

1.  **Authentication & Profile:** Both Students and Staff log in via O365. This module reads from and writes updates to the **User Profiles & Cards** database (including when users edit their department or address).
2.  **Dashboard & Catalog:** 
    *   **For Students:** This module reads book data from the **Catalog Inventory**, pulls Announcements/FAQs from the **Policies & Config** database, and writes to the **Transactions** database when a reservation is made.
    *   **For Staff:** This is their primary inventory tool where they push new book data directly to the **Catalog Inventory**.
3.  **Settings & Policies:** Staff use this to define system rules. The rules are saved into the **Policies & Config** database to govern the rest of the application.
4.  **Circulation Wizard:** The most complex data router. When Staff scan QRs here, the module pulls data from **User Profiles** (to verify the student is active), pulls from **Catalog Inventory** (to verify the book exists), pulls from **Policies & Config** (to check if the student has reached their borrow limit), and finally writes the outcome to the **Transactions** database.
