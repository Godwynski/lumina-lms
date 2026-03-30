# Features Not Fully Functional or Not Working Properly

During the codebase scan, the following incomplete features, mocked logic, and bugs were identified and need to be addressed:

### 1. Card Approvals Email Fetching (Security/Robustness)
*   **Location:** `app/protected/admin/approvals/page.tsx`
*   **Issue:** During card approval, the logic attempts to retrieve the user's email directly from the `profiles` table relation. A comment (`// Note: This requires service_role for admin tasks, but for mock purposes:`) acknowledges that in a secure, production environment, the email should be fetched reliably via `supabase.auth.admin`.

### 2. Student Catalog Sorting (Pagination Bug)
*   **Location:** `app/protected/student-catalog/page.tsx`
*   **Issue:** The catalog's sorting mechanism (Title, Author, Availability) is executed entirely client-side on `displayBooks` (the data returned for the current chunk via SWR). Because of this, the application only sorts the books visible on the *current page* (up to 16 items), rather than requesting a sorted query from the Supabase database.

### 3. Duplicate Profile Queries in Protected Layout (Performance)
*   **Location:** `app/protected/layout.tsx`
*   **Issue:** The layout fetches `supabase.auth.getUser()` and `supabase.from("profiles").select("*")` twice — once inside `NavWithRole()` (lines 16-27) and again in the parent `ProtectedLayout` (lines 44-59). Both calls are `select("*")` which over-fetches all columns. This doubles the DB round-trips on every protected page load with no caching.

### 4. Report Missing Book (Stub Implementation)
*   **Location:** `lib/actions/public-catalog.ts` → `reportMissingBook()`
*   **Issue:** The function is a stub that only logs a warning via the logger and returns `{ success: true }`. The code comments admit: *"In a real app, this would insert into a 'reports' or 'tasks' table for staff."* No database write occurs, so no librarian/staff user is ever notified of the reported issue.

### 5. Borrow History Search & Filter (Client-Side Only on Current Page)
*   **Location:** `app/protected/history/page.tsx`
*   **Issue:** The search-by-title/author and status-filter logic (lines 110-122) runs `useMemo` on `records`, which contains only the current page slice (10 items via `PAGE_SIZE`). Searching/filtering only operates on the rows already fetched — it cannot find records on other pages. Changing the filter or search query does **not** trigger a new server-side query.

### 6. User Directory Over-Fetching & Client-Side Pagination (Scalability)
*   **Location:** `app/protected/users/page.tsx`
*   **Issue:** The page loads **all** profiles from the database with `.select("*")` (line 135), then performs filtering, searching, and pagination entirely client-side. With a growing user base, this will cause increasing memory usage and slower page loads. Pagination should use `.range()` server-side, and search should be performed via a database query.

### 7. Audit Trail Page Hardcoded Light-Mode Styles
*   **Location:** `app/protected/audit/page.tsx`
*   **Issue:** The page uses hardcoded Tailwind color classes like `text-slate-900`, `bg-white/40`, `bg-slate-100`, `border-white/20` (lines 13-28) instead of the app's theme tokens (`text-foreground`, `bg-card`, `border-border`). This will render poorly or be unreadable in dark mode, unlike every other page in the system.

### 8. Library Card Fallback Generation Race Condition
*   **Location:** `app/protected/my-card/page.tsx`
*   **Issue:** When the database trigger hasn't created a library card yet, the page generates a card number using `Math.random()` (line 59: `LIB-${year}-${random}`). If two requests arrive simultaneously, both may attempt to insert, causing a duplicate-key conflict. While there is a retry-read fallback (lines 77-87), the random card number generation is not idempotent and could produce orphaned rows.

### 9. Preferences "Intelligent Alerts" Toggle (No Backend Effect)
*   **Location:** `app/protected/settings/page-client.tsx` → Preferences tab
*   **Issue:** The "Intelligent Alerts" toggle saves its state to a UI-preferences API endpoint (`/api/ui-preferences`), but no backend process reads this preference to actually suppress or enable email/notification delivery. The toggle changes a stored boolean, but has zero effect on whether notifications are actually sent.

### 10. Empty `lib/sync/` Directory (Dead Code Artifact)
*   **Location:** `lib/sync/`
*   **Issue:** The `lib/sync/` directory exists but is completely empty. The HeartbeatBanner component references a "school's local server sync worker" in its comments, suggesting sync functionality was planned but never implemented. The empty directory is dead project scaffolding.
