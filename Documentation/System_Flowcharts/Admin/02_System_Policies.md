# 02. System Policies Module

```mermaid
graph TD
    StartPol([Open System Policies]) --> WantUpdate{Do you want to update rules?}
    
    WantUpdate -- Yes --> EditPol[Update Borrow Limits & Fines]
    WantUpdate -- No --> EndPol([Return to Admin Hub])
    
    EditPol --> EndPol
```

[Back to Admin Hub](00_Admin_Journey.md)
