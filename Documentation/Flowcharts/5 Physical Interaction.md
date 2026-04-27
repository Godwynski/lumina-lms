# Physical Interaction (Checkout)

This sequence diagram illustrates the step-by-step communication between the Student, Librarian, and System during a physical book checkout at the library counter.

```mermaid
sequenceDiagram
    participant S as Student
    participant L as Librarian
    participant D as Database
    
    S->>L: Presents School ID & Book
    L->>D: Scans Student ID QR
    D-->>L: Shows Student is Active
    L->>D: Scans Book Copy QR
    D->>D: Records the Loan
    D-->>L: Success (Due Date Set)
    L->>S: Hands over the book
```
