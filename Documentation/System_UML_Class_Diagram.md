# Lumina Library Management System: UML Class Diagram

This document contains the UML Class Diagram for the Lumina Library Management System, illustrating the core entities, their attributes, methods, and relationships. It is modeled based on the system's role-based journeys and entities.

```mermaid
classDiagram
    %% Base User Class
    class User {
        +UUID id
        +String name
        +String email
        +String role
        +String status
        +login() bool
        +logout() void
    }

    %% User Roles
    class Admin {
        +manageUsers(User targetUser, String action)
        +updatePolicies(Policy newPolicy)
        +viewAuditLogs() List~AuditLog~
        +runOperations() void
    }

    class Librarian {
        +manageCatalog(Book book, String action)
        +processCheckout(Student student, Book book) Transaction
        +processCheckin(Book book) Transaction
    }

    class Student {
        +int borrowLimit
        +bool hasOverdue
        +viewHistory() List~Transaction~
        +searchCatalog(String query) List~Book~
        +reserveBook(Book book) Reservation
    }

    %% Inheritance Relationships
    User <|-- Admin
    User <|-- Librarian
    User <|-- Student

    %% Core System Entities
    class Book {
        +UUID id
        +String title
        +String author
        +String isbn
        +String status
        +updateStock() void
    }

    class Transaction {
        +UUID id
        +UUID studentId
        +UUID bookId
        +DateTime date
        +String type
        +DateTime dueDate
        +DateTime returnDate
        +calculateFine() float
    }

    class Reservation {
        +UUID id
        +UUID studentId
        +UUID bookId
        +DateTime requestDate
        +String status
        +confirm() void
        +cancel() void
    }

    class Policy {
        +UUID id
        +int maxBorrowLimit
        +float overdueFineRate
        +int maxReservationDays
    }

    class AuditLog {
        +UUID id
        +UUID userId
        +String action
        +DateTime timestamp
        +String details
    }

    %% Entity Relationships
    Student "1" --> "*" Transaction : initiates
    Librarian "1" --> "*" Transaction : processes
    Student "1" --> "*" Reservation : makes
    Book "1" --> "*" Transaction : belongs to
    Book "1" --> "*" Reservation : belongs to
    Admin "1" --> "*" Policy : manages
    Admin "1" --> "*" AuditLog : reviews
    User "1" --> "*" AuditLog : generates
```
