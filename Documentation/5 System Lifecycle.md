# Lumina LMS: Full System Lifecycle

This document provides a holistic view of the system's life cycle, from user onboarding to book circulation and automated maintenance.

## 1. The Integrated System Flow

This diagram connects all major sub-processes, showing how users and items interact throughout their life in the library.

```mermaid
graph TD
    %% Roles
    Student((Student))
    Librarian((Librarian))
    Admin((Admin))

    %% User Lifecycle
    subgraph "User Onboarding"
        Start([User Signs Up]) --> Pending[Status: PENDING]
        Pending --> AdminReview{Admin Review}
        AdminReview -- Approve --> Active[Status: ACTIVE]
        AdminReview -- Reject --> Rejected([Account Deleted])
    end

    %% Book/Inventory Lifecycle
    subgraph "The Circulation Loop"
        Active --> Search[Browse/Search Catalog]
        Search --> Reserve[Reserve Book]
        
        subgraph "Reservation Sub-Process"
            Reserve --> CheckCopy{Copy Available?}
            CheckCopy -- Yes --> Ready[Status: READY / Copy: RESERVED]
            CheckCopy -- No --> Queued[Status: ACTIVE / In Queue]
        end

        Ready --> Notify[Notify User for Pickup]
        Notify --> Desk[Visit Circulation Desk]
        
        Desk --> Checkout[Librarian Scan & Checkout]
        
        subgraph "Checkout Sub-Process"
            Checkout --> UpdateBorrow[Record Created / Copy: BORROWED]
        end
        
        UpdateBorrow --> Loan[Student Has Book]
        Loan --> Return[Return Book to Library]
        
        subgraph "Return & Promotion Sub-Process"
            Return --> CloseLoan[Record: RETURNED]
            CloseLoan --> CheckNext{Next in Queue?}
            CheckNext -- Yes --> Promote[Assign Copy to Next User]
            Promote --> Ready
            CheckNext -- No --> Release[Copy: AVAILABLE]
            Release --> Search
        end
    end


    %% Legend/Connections
    Student -.-> Start
    Student -.-> Search
    Admin -.-> AdminReview
    Librarian -.-> Checkout
    Librarian -.-> Return
```

## 2. Component Transitions (State Machine)

How entities change states based on specific triggers.

### A. Book Copy States
```mermaid
stateDiagram-v2
    [*] --> AVAILABLE : New Purchase
    AVAILABLE --> RESERVED : Student Reserves
    AVAILABLE --> BORROWED : Walk-in Checkout
    RESERVED --> BORROWED : Pickup Reservation
    BORROWED --> AVAILABLE : Return (No Queue)
    BORROWED --> RESERVED : Return (Promote Next)
    RESERVED --> AVAILABLE : Hold Expired
    BORROWED --> LOST : Mark Lost
```

### B. User Profile States
```mermaid
stateDiagram-v2
    [*] --> PENDING : Sign Up
    PENDING --> ACTIVE : Admin Approval
    ACTIVE --> SUSPENDED : Overdue/Misconduct
    SUSPENDED --> ACTIVE : Resolution
    ACTIVE --> GRADUATED : Batch Update
    ACTIVE --> INACTIVE : Manual Deactivation
```

## 3. The "Promotion" Logic (Critical Path)
When a book is returned, the system follows this logic to ensure fair access:

1.  **Mark Return**: Close the current borrowing record.
2.  **Queue Check**: Query `reservations` for the same `book_id` where `status = 'ACTIVE'`.
3.  **Atomic Promotion**:
    - If a user is found:
        - Update Reservation to `READY`.
        - Assign the physical `copy_id`.
        - Set `hold_expires_at` (usually 3 days).
        - Update Book Copy to `RESERVED`.
    - If no user:
        - Update Book Copy to `AVAILABLE`.

