# Lumina Library Management System: Process Flowcharts

This document details the exact flow of the system, starting from the main authentication hub and branching into strict sub-processes (Journeys) based on the user's role. Every decision block is strictly binary (Yes/No), and every sub-process features a complete lifecycle that returns to the main dashboard.

## 1. Main Entry & Hub Routing
This flowchart handles authentication, account status verification, and strict role-based branching into the respective sub-processes.

```mermaid
graph TD
    Start([Open App]) --> Auth{Is the user logged in?}
    Auth -- No --> Login[Go to Login Page]
    Login --> Auth
    Auth -- Yes --> VerifyActive{Is the account Active?}
    
    %% Security Branching (Strict Binary)
    VerifyActive -- No --> VerifyPending{Is it a new account?}
    VerifyPending -- Yes --> Pending[Show: Waiting for Approval]
    Pending --> EndSession([End Session])
    VerifyPending -- No --> Suspended[Show: Account Suspended]
    Suspended --> EndSession
    
    %% Dashboard Hub
    VerifyActive -- Yes --> Dashboard[Enter Dashboard Hub]
    
    %% Role Branching (Strict Binary)
    Dashboard --> CheckAdmin{Is the user an Admin?}
    CheckAdmin -- Yes --> AdminPath[[Admin Journey]]
    
    CheckAdmin -- No --> CheckLib{Is the user a Librarian?}
    CheckLib -- Yes --> LibrarianPath[[Librarian Journey]]
    CheckLib -- No --> StudentPath[[Student Journey]]
    
    %% Lifecycle Return
    AdminPath --> Dashboard
    LibrarianPath --> Dashboard
    StudentPath --> Dashboard
```

---

## 2. Sub-Process: Student Journey
This flowchart details the interactions available to a student patron.

```mermaid
graph TD
    StartStudent([Student Dashboard]) --> WantSearch{Do you want to search the catalog?}
    
    WantSearch -- No --> WantHistory{Do you want to view your history?}
    WantHistory -- No --> EndStudent([Return to Dashboard])
    
    %% History Flow
    WantHistory -- Yes --> CheckOverdue{Are there overdue books?}
    CheckOverdue -- Yes --> ShowFines[Display Overdue Alerts]
    CheckOverdue -- No --> ShowClean[Display Clean Record]
    ShowFines --> EndStudent
    ShowClean --> EndStudent
    
    %% Catalog Flow
    WantSearch -- Yes --> SearchCatalog[Search Student Catalog]
    SearchCatalog --> FoundBook{Is the book available?}
    
    FoundBook -- No --> WaitList[Check back later]
    WaitList --> EndStudent
    
    FoundBook -- Yes --> WantReserve{Do you want to reserve it?}
    WantReserve -- No --> EndStudent
    
    WantReserve -- Yes --> LimitCheck{Are you under the borrow limit?}
    LimitCheck -- Yes --> ConfirmRes[Reservation Confirmed & Held]
    LimitCheck -- No --> RejectRes[Show Error: Limit Reached]
    
    ConfirmRes --> EndStudent
    RejectRes --> EndStudent
```

---

## 3. Sub-Process: Librarian Journey
This flowchart details the daily operations for library staff, focusing on circulation and catalog management.

```mermaid
graph TD
    StartLib([Librarian Dashboard]) --> WantCirc{Do you want to open Circulation Desk?}
    
    WantCirc -- No --> WantCat{Do you want to manage the Catalog?}
    WantCat -- No --> EndLib([Return to Dashboard])
    
    %% Catalog Flow
    WantCat -- Yes --> IsAdd{Are you adding a new book?}
    IsAdd -- Yes --> AddBook[Enter New Book Details]
    IsAdd -- No --> EditBook[Update Existing Book Info]
    AddBook --> EndLib
    EditBook --> EndLib
    
    %% Circulation Flow
    WantCirc -- Yes --> HasStudent{Is there a student present?}
    HasStudent -- No --> EndLib
    HasStudent -- Yes --> ScanQR[Scan Student QR Code]
    
    ScanQR --> VerifyStudent{Is the student profile valid?}
    VerifyStudent -- No --> RejectTrans[Reject Transaction]
    RejectTrans --> EndLib
    
    VerifyStudent -- Yes --> ScanBook[Scan Book QR Code]
    ScanBook --> IsBorrow{Is the student borrowing the book?}
    
    IsBorrow -- Yes --> Checkout[Process Check-out & Update Stock]
    IsBorrow -- No --> Checkin[Process Check-in & Clear Hold]
    
    Checkout --> EndLib
    Checkin --> EndLib
```

---

## 4. Sub-Process: Admin Journey
This flowchart details the high-level configuration and system monitoring capabilities.

```mermaid
graph TD
    StartAdmin([Admin Dashboard]) --> WantUsers{Do you want to manage users?}
    
    %% Users
    WantUsers -- Yes --> HasPending{Are there pending accounts?}
    HasPending -- Yes --> ApproveUser[Approve Pending Accounts]
    HasPending -- No --> SuspendUser[Suspend / Deactivate Accounts]
    ApproveUser --> EndAdmin([Return to Dashboard])
    SuspendUser --> EndAdmin
    
    %% Policies
    WantUsers -- No --> WantPol{Do you want to update policies?}
    WantPol -- Yes --> EditPol[Update Borrow Limits & Rules]
    EditPol --> EndAdmin
    
    %% Operations & Audit
    WantPol -- No --> WantAudit{Do you want to view Audit Logs?}
    WantAudit -- Yes --> CheckLogs[Review System Activity]
    CheckLogs --> EndAdmin
    
    WantAudit -- No --> WantOps{Do you want to run operations?}
    WantOps -- No --> EndAdmin
    
    %% Fixed Parsing Error with Quotes here
    WantOps -- Yes --> RunCleanup["Trigger Automated Cleanups (e.g. Expired Reservations)"]
    RunCleanup --> EndAdmin
```
