# 00. Admin Journey Hub

This flowchart routes Admin tasks to specific modules. *Note: Administrators also have full access to all Librarian modules (Circulation and Catalog Management).*

```mermaid
graph TD
    StartAdmin([Admin Dashboard]) --> WantUsers{Do you want to manage users?}
    
    %% Admin Specific Modules
    WantUsers -- Yes --> UserMng[["User Management Module"]]
    click UserMng "01_User_Management.md" "Go to User Management"
    
    WantUsers -- No --> WantPol{Do you want to update policies?}
    WantPol -- Yes --> PolMng[["System Policies Module"]]
    click PolMng "02_System_Policies.md" "Go to System Policies"
    
    WantPol -- No --> WantAudit{Do you want to view Audit Logs?}
    WantAudit -- Yes --> AuditMng[["Audit Logs Module"]]
    click AuditMng "03_Audit_Logs.md" "Go to Audit Logs"
    
    WantAudit -- No --> WantOps{Do you want to run operations?}
    WantOps -- Yes --> OpsMng[["System Operations Module"]]
    click OpsMng "04_System_Operations.md" "Go to System Operations"
    
    %% Shared Modules with Librarian
    WantOps -- No --> WantLib{Do you want to access Library Operations?}
    WantLib -- Yes --> LibHub[["Librarian Operations Hub"]]
    click LibHub "../Librarian/00_Librarian_Journey.md" "Go to Librarian Hub"
    
    WantLib -- No --> EndAdmin([Return to Dashboard])
    
    UserMng --> EndAdmin
    PolMng --> EndAdmin
    AuditMng --> EndAdmin
    OpsMng --> EndAdmin
    LibHub --> EndAdmin
```

[Return to Main Flow](../00_Main_Entry_Flow.md)
