
Requirements Documentation
This specific part defines the software features of the web-based system of Lumina: A Web-Based Library Book Reservation, Borrowing, and Inventory Management System with QR-Based Scanning for STI College Alabang. The requirements stated below are formulated based on the data gathered, standard operating procedure analysis, and key stakeholder consultations conducted with the library staff and administration of STI College Alabang, as well as particularly selected information based on the specific objectives of this study. The defined requirements below are expected to cater to the operational needs of STI College Alabang to enhance library transaction efficiency, inventory tracking accuracy, and asset security. The requirements below also describe how all the authorized users Super Administrators, Librarians, Student Assistants, and Students of STI College Alabang can interact with the system. 
4.1. Functional Requirements
4.1.1. Log In (Super Admin)
REQ001. The super admin shall be able to log in securely using Microsoft O365 institutional account credentials.
REQ002. The system shall restrict access to administrative tools to ensure that only authorized super administrative personnel can manage backend data.
4.1.2. Dashboard Module (Super Admin)
REQ003 . The super admin shall be able to view a real-time overview displaying metric summary counters for daily visitor traffic, registered users, total book inventory, and active loans.
REQ004. The super admin shall be able to utilize quick-access navigation shortcuts to navigate directly to the Circulation Desk, Book Inventory, User Directory, Visitor Logs, Audit Logs, and Analytics modules.
REQ005. The super admin shall be able to view a visual gallery highlighting the most recently cataloged library assets on the main dashboard interface.
4.1.3. Inventory (Super Admin)
REQ006. The super admin shall be able to automatically fetch book metadata (title, author, cover art) via automated ISBN lookup.
REQ007. The super admin shall be able to manually finalize catalog records by entering Dewey Decimal numbers, book categories, total copy counts, and physical shelf locations.
REQ008. The super admin shall be able to utilize a Batch Catalog Operations panel equipped with a drag-and-drop Import Sheet tool for uploading inventory spreadsheets.
REQ009. The super admin shall be able to utilize an ISBN Fallback text field for bulk sequential lookups and automatic cover art retrieval.
REQ010. The super admin shall be able to export active catalog data with custom column selections into Spreadsheet, CSV, JSON Data, or Covers ZIP file formats.
4.1.4. Circulation Desk (Super Admin)
REQ011. The super admin shall be able to scan student ID QR codes and physical book QR codes using camera or barcode input devices.
REQ012. The system shall automatically link the borrower to the scanned book item during circulation transactions to eliminate manual data entry.
4.1.5. Borrowing Logs (Super Admin)
REQ013. The super admin shall be able to view a centralized, view-only list tracking all historical and active borrowing and returning transactions.
REQ014. The super admin shall be able to view complete transaction details including borrower name, borrower ID, book title, author, borrow date, due date timeline, and return date.
REQ015. The super admin shall be able to identify transaction statuses through color-coded status tags (Active, Returned, Overdue).
REQ016. The super admin shall be able to search borrowing records by keyword and filter logs using status tab buttons (All, Active, Returned, Overdue).
4.1.6. Analytics (Super Admin)
REQ017. The super admin shall be able to view system performance metrics filtered by custom timeframes (7 days, 30 days, or 1 year).
REQ018. The super admin shall be able to view summary counters for daily visitor traffic, active book borrows, total inventory volumes, and registered library members.
REQ019. The super admin shall be able to view line graphs representing daily traffic distributions and circulation trends over time.
REQ020. The super admin shall be able to view a donut chart breaking down asset allocation across returned, active, and overdue statuses.
REQ021. The super admin shall be able to view a demand leaderboard list showcasing the highest-demand catalog books based on borrow counts.
4.1.7. User Directory (Super Admin)
REQ022. The super admin shall be able to view a master list of all registered accounts displaying user full names, emails, unique IDs, system roles, account statuses, and academic programs.
REQ023. The super admin shall be able to search user accounts by name or email address and narrow lists using filter buttons.
REQ024. The super admin shall be able to click on any user entry to open their detailed profile page and inspect contact information.
REQ025. The super admin shall be able to update user account settings, including changing system roles, modifying account statuses, and archiving user profiles.
4.1.8. Attendance Logs (Super Admin)
REQ026. The super admin shall be able to track student traffic in real time by scanning student library cards at entry and exit points.
REQ027. The super admin shall be able to view a list of checked-in and checked-out students along with exact entry and exit timestamps.
4.1.9. Setting and Policies (Super Admin)
REQ028. The super admin shall be able to define maximum circulation limits and reservation limits.
REQ029. The super admin shall be able to configure student academic programs and organize catalog book categories.
REQ030. The super admin shall be able to create and broadcast system-wide announcements to all users.
REQ031. The super admin shall be able to access a Q&A support log to assist with user troubleshooting.
REQ032. The super admin shall be able to execute backend maintenance tools including batch account resets, automated email dispatches, and configuration testing.
4.1.10. Audit Logs (Super Admin)
REQ033. The super admin shall be able to view a security table tracking action timestamps, administrator/user identities, action types, affected entities, and change descriptions.
REQ034. The super admin shall be able to click a dedicated button on log entries to view granular technical differences (diffs).
REQ035. The super admin shall be able to search audit logs by name, action type, or reason, sort logs via entity/action dropdown filters, and execute live data refreshes.
REQ036. The super admin shall be able to import and export audit log records in Spreadsheet CSV and developer JSON formats.
4.1.11. Notification (Super Admin)
REQ037. The super admin shall be able to click a header notification bell icon to view a drop-down panel displaying recent system alerts.
REQ038. The super admin shall be able to access a dedicated notifications page equipped with quick filter tabs and a search bar to manage alerts.
4.1.12. My Profile (Super Admin)
REQ039. The super admin shall be able to view a read-only profile page displaying their full name, system ID, official email, contact number, residential address, account status, membership role, and security status.
4.1.13. Log In (Librarian)
REQ040. The librarian shall be able to log in securely using Microsoft O365 institutional account credentials.
4.1.14. Dashboard (Librarian)
REQ041. The librarian shall be able to view real-time metrics for daily visitor counts, registered users, total book inventory, and active loans.
REQ042. The librarian shall be able to use quick navigation shortcuts to access the User Directory, Audit Logs, and Analytics, as well as review recently cataloged assets.
4.1.15. Inventory (Librarian)
REQ043. The librarian shall be able to manage book collections using ISBN automated lookups, manual cataloging fields (Dewey Decimal, shelf locations, copy counts), spreadsheet import tools, fallback lookups, and customizable catalog exports.

4.1.16. Circulation Desk (Librarian)
REQ044. The librarian shall be able to issue and return books by scanning student ID QR codes and book QR codes.
4.1.17. Borrowing Logs (Librarian)
REQ045. The librarian shall be able to access a view-only list of borrowing records with search tools, status filters (All, Active, Returned, Overdue), and timeline details.
4.1.18. Analytics (Librarian)
REQ046. The librarian shall be able to analyze time-filtered reports (7 days, 30 days, 1 year) including visitor trends, active borrow counts, status donut charts, and book demand leaderboards.
4.1.19. User Directory (Librarian)
REQ047. The librarian shall be able to view master user lists, search user accounts, open profile views, and update student account statuses specifically between Active and Pending.
4.1.20. Attendance Logs (Librarian)
REQ048. The librarian shall be able to log student entry and exit timestamps in real time by scanning student library cards

4.1.21. Setting and Policies (Librarian)
REQ049. The librarian shall be able to manage circulation/reservation limits, academic programs, book categories, post system announcements, and review Q&A support logs.
4.1.22. Notification (Librarian)
REQ050. The librarian shall be able to monitor system alerts via header bell drop-down panels and search/filter notifications on a dedicated page.
4.1.23. My Profile (Librarian)
REQ051. The librarian shall be able to view their read-only personal details, account status, membership role, and security status.
4.1.24. Log In (Student Assistant)
REQ052. The student assistant shall be able to log in using Microsoft O365 institutional credentials.
4.1.25. Dashboard (Student Assistant)
REQ053. The student assistant shall be able to view real-time statistics for daily visitors, total users, and active book loans.
REQ054. The student assistant shall be able to utilize quick shortcuts to the Circulation Desk, Attendance Logs, and Book Catalog modules.
REQ055. The student assistant shall be able to view a personal tracking section displaying their own current borrows, hold reservations, and recent attendance entries.
4.1.26. Catalog (Student Assistant)
REQ056. The student assistant shall be able to browse book cards displaying book titles, authors, cover images, and fractional availability indicators (e.g., available copies vs. total copies).
REQ057. The student assistant shall be able to search catalog books using a keyword bar (titles, authors, ISBNs) and refine results using category filters, availability statuses, and alphabetical sorting.
REQ058. The student assistant shall be able to click a "Reserve for Pickup" button on catalog items to place a hold.
4.1.27. Inventory (Student Assistant)
REQ059. The student assistant shall be able to view copy-level inventory items in a structured data table showing Title, Author, Category, ISBN, and generated book QR codes.
REQ060. The student assistant shall be able to filter inventory entries by category and keyword search.
4.1.28. Circulation Desk (Student Assistant)
REQ061. The student assistant shall be able to process front-desk borrowing and returning transactions using QR-code scanners

.
4.1.29. My Borrowing (Student Assistant)
REQ062. The student assistant shall be able to view their personal borrow history table displaying resource metadata, borrow date, due date/return timeline, status tags, keyword search, and status filters (All, Active, Returned, Overdue).
4.1.30. Borrowing Logs (Student Assistant)
REQ063. The student assistant shall be able to access a view-only monitoring list of system-wide borrowing and returning transactions.
4.1.31. My Attendance (Student Assistant)
REQ064. The student assistant shall be able to view their personal attendance record displaying visit dates, check-in times, check-out times, session statuses, and an All-Time History view.
4.1.32. Attendance Logs (Student Assistant)
REQ065. The student assistant shall be able to record student check-ins and check-outs with timestamps by scanning library cards.
4.1.33. Notification (Student Assistant)
REQ066. The student assistant shall be able to receive alerts via header drop-down panels and filter/search updates on a dedicated notifications page.
4.1.34. My Profile (Student Assistant)
REQ067. The student assistant shall be able to view their read-only account profile and security details.
4.1.35. Log In and Profile Completion (Student)
REQ068. The student shall be able to log in using their Microsoft O365 institutional account.
REQ069. The student shall be required to complete a profile onboarding step (submitting residential address, contact numbers, and academic program) upon initial login.
REQ070. The system shall place new student accounts into a "Pending" status upon submission, restricting full feature access until administrator approval.
4.1.36. Dashboard (Student)
REQ071. The student shall be able to view a digital Library Card displaying their profile picture, name, program, academic year, scannable QR code, and Flip/Export card action buttons.
REQ072. The student shall be able to view personalized tracking sections for Current Borrows, Reservations (with cancel hold option), and Recent Attendance snapshots (check-in/out timestamps and visit durations).
REQ073. The student shall be able to access an interactive Support & FAQs panel to learn about library systems and policies.
4.1.37. Category (Student)
REQ074. The student shall be able to search and filter book collections, view fractional availability indicators, and place "Reserve for Pickup" holds.

4.1.38. My Borrow (Student)
REQ075. The student shall be able to view their transactional borrow timeline table showing resource details, borrow dates, due/return dates, keyword timeline search, and status filters (All, Active, Returned, Overdue).
4.1.39. My Attendance (Student)
REQ076. The student shall be able to view their personal check-in/check-out dates, entry/exit timestamps, session statuses, and complete chronological visit history.
4.1.40. Notification (Student)
REQ077. The student shall be able to receive alerts regarding library usage, event updates, and hold statuses via header bell notifications and dedicated alert pages.
4.1.41. My Profile (Student)
REQ078. The student shall be able to view their read-only account details including full name, system ID, official email, contact number, residential address, account status, membership role, and security status.
4.2. Non-Functional Requirements
4.2.1. Performance
REQ079. The system shall process and display real-time transaction updates (such as QR-based borrowing, returning, and entry/exit card scans) immediately upon scanning.
REQ080. The system shall maintain smooth response times for concurrent user activities (such as simultaneous catalog browsing, reservation holds, and administrative reporting) without performance degradation.
REQ081. The system shall load search query results, inventory filtering options, and analytics visualizations without noticeable interface lag.
4.2.2. Availability
REQ082. The system shall remain operationally accessible 24 hours a day, 7 days a week, except during planned platform maintenance windows coordinated with Microsoft O365 infrastructure.
4.2.3. Security
REQ083. The system must enforce user authentication exclusively through Microsoft O365 institutional accounts across all user roles (Super Admin, Librarian, Student Assistant, Student) to prevent unauthorized access.
REQ084. The system must enforce strict Role-Based Access Control (RBAC), ensuring that non-administrative accounts (Students) cannot view administrative tools, audit logs, or backend directories.
REQ085. The system must maintain an immutable security audit trail that records and protects all administrative activity and data modifications against unauthorized alteration.

4.2.4. Usability
REQ086. The system must feature an intuitive, visually clear, and consistent interface layout tailored specifically to each of the four distinct user roles.
REQ087. The system shall utilize consistent color-coded visual badges (e.g., green for Returned, blue/yellow for Active, red for Overdue) across all tables to optimize operational readability.
REQ088. The system shall provide quick-access keyword search bars and dropdown filters across all catalog, directory, log, and notification interfaces.
4.2.5. Maintainability
REQ089. The system architecture shall be modularly designed to allow updates to system rules, borrowing configurations, or academic program lists without disrupting core circulation services.
4.2.6. Portability and Deployment
REQ090. The system must function consistently across major modern web browsers, including Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari, without requiring special extensions.
REQ091. The system shall be fully accessible and responsive across multiple hardware devices and operating systems (Windows, macOS, Linux, iOS, Android).
REQ092. The system shall support customizable data export operations, allowing administrative catalog data and audit logs to be downloaded in Spreadsheet CSV, JSON, and ZIP formats.
