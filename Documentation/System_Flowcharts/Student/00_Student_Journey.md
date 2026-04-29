# 00. Student Journey Hub

This flowchart serves as the landing pad for the Student Journey. The dashboard immediately displays your Library Card, Current Reservations, Active Borrows, and FAQs before routing you to specific feature modules.

```mermaid
graph TD
    StartStudent([Student Dashboard]) --> ViewWidgets[View Library Card, Active Borrows, Reservations & FAQs]
    
    ViewWidgets --> WantCat{Go to Catalog?}
    WantCat -- Yes --> Catalog[["Catalog Module"]]
    click Catalog "01_Catalog.md" "Go to Catalog"
    
    WantCat -- No --> WantHist{View Borrow History?}
    WantHist -- Yes --> History[["Borrow History Module"]]
    click History "02_Borrowing_History.md" "Go to History"
    
    WantHist -- No --> WantNotif{Check Notifications?}
    WantNotif -- Yes --> Notif[["Notifications Module"]]
    click Notif "03_Notifications.md" "Go to Notifications"
    
    WantNotif -- No --> WantProf{Manage Profile?}
    WantProf -- Yes --> Profile[["Profile Module"]]
    click Profile "04_Profile.md" "Go to Profile"
    
    WantProf -- No --> Return([Stay on Dashboard])
    
    Catalog --> Return
    History --> Return
    Notif --> Return
    Profile --> Return
```

[Return to Main Flow](../00_Main_Entry_Flow.md)
