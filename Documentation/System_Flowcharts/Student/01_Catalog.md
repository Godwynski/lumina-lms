# 01. Catalog Module

```mermaid
graph TD
    StartCat([Open Student Catalog]) --> Search{Found the book you want?}

    %% Not Found / Assistance Flow
    Search -- No --> NeedHelp{Need assistance finding it?}
    NeedHelp -- No --> EndCat([Return to Dashboard])
    NeedHelp -- Yes --> ClickHelp[Click 'I cant find this book']
    ClickHelp --> NotifyAdmin[System Notifies Admin / Librarian]
    NotifyAdmin --> EndCat

    %% Found Book Flow
    Search -- Yes --> ViewBook[View Book Details]
    ViewBook --> IsAvail{Is it available?}

    IsAvail -- No --> WaitList[Check back later]
    WaitList --> EndCat

    IsAvail -- Yes --> WantRes{Reserve for Pickup?}
    WantRes -- No --> EndCat

    WantRes -- Yes --> CheckLimit{Are you under the borrow limit?}
    CheckLimit -- Yes --> Confirm[Reservation Confirmed & Held]
    CheckLimit -- No --> Reject[Show Error: Limit Reached]

    Confirm --> EndCat
    Reject --> EndCat
```

[Back to Student Hub](00_Student_Journey.md)
