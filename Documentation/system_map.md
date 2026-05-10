# Lumina LMS: System Functional Map

This diagram illustrates the branched architecture of the system, showing how different user roles navigate to their specific tasks from a central login point.

```mermaid
graph TD
    %% Central Entry
    Start([Start]) --> Login(Login)

    %% Role Branches
    Login --> Admin(Admin)
    Login --> Librarian(Librarian / Staff)
    Login --> Student(Student)

    %% Admin Path
    Admin --> UserMgmt(User Management)
    Admin --> AuditLogs(View Audit Logs)
    Admin --> Settings(System Settings)
    
    UserMgmt --> Suspend(Approve / Suspend Accounts)

    %% Librarian Path
    Librarian --> Circulation(Circulation Desk)
    Librarian --> Catalog(Manage Catalog)
    Librarian --> Reports(Generate Reports)

    Circulation --> Checkout(Book Checkout)
    Circulation --> Return(Book Return)
    Catalog --> Books(Add / Edit Books)
    Catalog --> Copies(Manage Copies & QRs)

    %% Student Path
    Student --> StudentCatalog(Search Catalog)
    Student --> History(Borrowing History)
    Student --> Profile(Profile Management)

    StudentCatalog --> Reserve(Request Reservation)

    %% Interconnections (Cross-flows)
    Return -->|Trigger| Reserve
    Checkout -->|Update| History
    UserMgmt -->|Link| Profile
    
    %% Formatting
    style Start fill:#fff,stroke:#333
    style Login fill:#fff,stroke:#333
    style Admin fill:#fff,stroke:#333
    style Librarian fill:#fff,stroke:#333
    style Student fill:#fff,stroke:#333
```

## System Navigation Breakdown

- **Central Access**: All workflows originate from a secure **Login** point.
- **Admin Branch**: Focuses on governance, including **User Management** (approving or suspending accounts) and monitoring the system via **Audit Logs**.
- **Librarian Branch**: Handles the day-to-day operations. The **Circulation Desk** is the hub for Checkouts and Returns, while **Catalog Management** ensures the digital inventory is up to date.
- **Student Branch**: Provides self-service options. Students can **Search the Catalog**, request **Reservations**, and track their personal **Borrowing History**.
- **Cross-System Logic**: Some actions are interconnected—for example, returning a book (`Return`) can automatically trigger a pending reservation (`Reserve`) for another student.
