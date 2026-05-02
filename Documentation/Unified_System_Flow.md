# Lumina Library Management System: Unified System Data Flow Diagram

## 1. High-Level Context Diagram (For Stakeholders)
The Context Diagram (Level-0 DFD) provides a bird's-eye view of the system. It treats the entire Library Management System as a single entity and illustrates the primary information exchanged between the system and its users. It is designed to be easily understood by non-technical stakeholders.

```mermaid
flowchart LR
    %% Styling
    classDef system fill:#1976d2,stroke:#0d47a1,stroke-width:3px,color:#fff,shape:rect;
    classDef user fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,shape:rect,color:#333;

    %% System
    SYS["🏢 Lumina Library\nManagement System"]:::system

    %% External Entities
    STUDENT["🎓 Student"]:::user
    LIBRARIAN["📚 Librarian"]:::user
    ADMIN["⚙️ System Admin"]:::user

    %% Interactions
    STUDENT <-->|Search Catalog, Reserve Books, Receive Alerts| SYS
    LIBRARIAN <-->|Manage Catalog, Process Checkouts & Returns| SYS
    ADMIN <-->|Manage Users, Set Policies, View Audit Logs| SYS
```

## 2. Detailed Data Flow Diagram (For Technical Team)
The Level-1 Data Flow Diagram (DFD) breaks down the main system into its core internal processes and data stores. It focuses on how data moves through the system, identifying external entities (inputs/outputs), core processes, and persistent data stores. This replaces the previous step-by-step flowchart to better represent information routing rather than sequential actions.

```mermaid
flowchart TD
    %% Styling for DFD Elements
    classDef entity fill:#fce4ec,stroke:#c2185b,stroke-width:2px;
    classDef process fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,shape:circle;
    classDef datastore fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;

    %% External Entities (Sources/Sinks)
    Student[Student]:::entity
    Librarian[Librarian]:::entity
    Admin[Admin]:::entity

    %% Processes
    Auth((1.0\nAuthentication)):::process
    CatMgt((2.0\nCatalog\nProcessing)):::process
    Circulation((3.0\nCirculation\n& Reservations)):::process
    UserMgt((4.0\nAccount\nManagement)):::process
    PolMgt((5.0\nPolicy\nManagement)):::process

    %% Data Stores
    UserDB[(D1: User Data)]:::datastore
    CatDB[(D2: Catalog Data)]:::datastore
    TransDB[(D3: Transactions)]:::datastore
    PolDB[(D4: Policies)]:::datastore
    AuditDB[(D5: Audit Logs)]:::datastore

    %% External Entities <--> Processes
    Student -->|Credentials| Auth
    Student -->|Search Queries| CatMgt
    Student -->|Reservation Requests| Circulation
    CatMgt -->|Search Results| Student
    Circulation -->|Transaction Status| Student

    Librarian -->|Credentials| Auth
    Librarian -->|Book Metadata| CatMgt
    Librarian -->|Checkout/Return Data| Circulation
    Circulation -->|Transaction Confirmation| Librarian

    Admin -->|Credentials| Auth
    Admin -->|Approval/Suspension Data| UserMgt
    Admin -->|New Policy Rules| PolMgt
    UserMgt -->|Account Status Updates| Admin

    %% Processes <--> Data Stores
    Auth <-->|Verify User Info| UserDB
    Auth -->|Login Event| AuditDB

    CatMgt <-->|Read/Write Books| CatDB
    CatMgt -->|Catalog Change Event| AuditDB

    Circulation <-->|Update Stock| CatDB
    Circulation <-->|Read/Write Records| TransDB
    Circulation -->|Read Borrow Limits| PolDB
    Circulation -->|Transaction Event| AuditDB

    UserMgt <-->|Update Accounts| UserDB
    UserMgt -->|Account Change Event| AuditDB

    PolMgt <-->|Update Rules| PolDB
    PolMgt -->|Policy Change Event| AuditDB

    %% Admin reads Audit Logs
    Admin -->|Log Query| AuditDB
    AuditDB -->|Activity Reports| Admin
```
