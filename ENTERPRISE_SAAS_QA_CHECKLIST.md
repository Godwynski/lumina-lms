# Enterprise SaaS Platform: Production-Grade Quality Assurance & RBAC Testing Checklist

> **Document Type:** Production QA Test Master Specification  
> **Target System:** Multi-Tenant Enterprise B2B SaaS Web Application  
> **Author:** Principal QA Automation Engineer & Enterprise Software Architect  
> **Standard Compliance:** OWASP Top 10 (2021/2025), SOC 2 Type II (Trust Services Criteria), ISO/IEC 27001:2022, WCAG 2.1 AA  
> **Syntax Convention:** GitHub Flavored Actionable Checklist (`- [ ]`)

---

## 1. Enterprise User Role Hierarchy & Security Boundary Matrix

Enterprise multi-tenant platforms require strict separation of concerns, zero-trust perimeter boundaries, and immutable role inheritance hierarchies. Below is the standard 7-tier enterprise role taxonomy.

```
                              [Tier 0: Super Admin]
                                        │
                                        ▼
                            [Tier 1: Workspace Admin]
                           ┌────────────┴────────────┐
                           ▼                         ▼
                  [Tier 2: Manager]         [Tier 2-B: Billing Admin]
                           │
                           ▼
              [Tier 3: Standard Member] ──────────► [Tier 3-R: Auditor (Read-Only)]
                           │
                           ▼
                    [Tier 4: Guest]
```

### 1.1 Clearance Levels & Security Boundaries

| Role Name | Clearance Level | Security Boundary Definition & Scope | Primary Responsibilities | Data Exposure Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Level 0 (Platform Owner) | Unrestricted root-level access across the tenant/organization. Full sovereignty over cross-workspace configurations, legal holds, organization destruction, root credential rotators, and master billing instruments. | Tenant ownership, disaster recovery, enterprise SSO/SAML configuration, root governance. | Complete tenant data, credentials metadata, financial and compliance records. |
| **Workspace Admin** | Level 1 (Org Administrator) | Full administrative sovereignty bounded strictly to the assigned workspace. Can configure workspace policies, manage team members, assign roles (up to Level 1), manage integrations, and generate workspace API credentials. | Operational administration, access provisioning, integration management, policy enforcement. | Full workspace operational data, workspace audit logs, user directory. No root billing ownership unless granted. |
| **Manager** | Level 2 (Functional Lead) | Supervisory control over assigned projects, teams, tasks, and operational workflows. Can invite members to projects, approve state transitions, manage resource allocations, and export team-scoped reports. | Team coordination, project lifecycle governance, approval workflow execution, operational reporting. | Workspace operational data and team directory. Masked financial/billing data, masked security secrets. |
| **Billing Admin** | Level 2-B (Financial Controller) | Dedicated financial and licensing governance boundary. Full read/write authority over subscription tiers, credit cards, ACH, tax IDs, invoice history, usage meters, and seat quotas. | Subscription lifecycle, billing renewals, invoice settlement, usage quota management. | Complete billing and financial records, seat counts. **Zero read/write access to project data, task contents, or developer secrets.** |
| **Standard Member** | Level 3 (Operational Contributor) | Contributor-level access to public and explicitly assigned workspace resources. Can create, read, update, and comment on operational tasks and project boards. Cannot modify administrative settings. | Day-to-day task execution, content collaboration, asset authoring. | Assigned and public workspace operational data. Hidden billing, developer keys, and audit logs. |
| **Auditor / Read-Only** | Level 3-R (Compliance Reviewer) | Immutable read-only visibility across workspace operational entities, security dashboards, configuration postures, and audit trails. **Zero write, update, delete, or mutation capabilities.** | Regulatory audits (SOC2, HIPAA, ISO), internal compliance review, security inspection. | Read-only access to operational logs and configurations. Cannot generate API tokens or alter states. |
| **Guest / External** | Level 4 (Restricted Collaborator) | Strict sandboxed access isolated exclusively to explicitly shared project items or single boards. Cannot browse team directories, view global dashboards, access analytics, or view members. | External partner collaboration, contractor deliverables, client review. | Strictly bounded to explicitly assigned items. All organizational context hidden. |

---

## 2. Global & Account-Level Access (Header & Global Context)

The application header and global context layer establish tenant isolation, personal security credentials, notifications, and organization-wide governance.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] [Org / Workspace Selector ▼]    [Search / Cmd+K]    [+ Quick Action]   [Notifications]  [Avatar]│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Workspace / Organization Switcher & Context Selector

- [ ] **Item/Action:** Display organization/workspace switcher dropdown in top header.  
  - **Expected Behavior:** Visible for all authenticated users; lists only workspaces where user has valid membership.  
  - **Permission Scope:** Super Admin (sees all tenant workspaces); Admin, Manager, Billing, Member, Auditor (sees assigned workspaces); Guest (locked to single guest workspace or hidden).
- [ ] **Item/Action:** Click "Create New Workspace" option inside switcher modal.  
  - **Expected Behavior:** Super Admin (modal opens, creation succeeds); Workspace Admin (enabled only if tenant license permits); Manager, Member, Billing, Auditor, Guest (option completely hidden; direct POST to `/api/v1/workspaces` returns `403 Forbidden`).  
  - **Permission Scope:** Super Admin only (`workspace:create`).
- [ ] **Item/Action:** Switch active workspace context via dropdown selection.  
  - **Expected Behavior:** State updates instantaneously; reloads session JWT / claims; invalidates cache of previous workspace data; redirects to dashboard of target workspace; verifies no cross-workspace data bleed occurs.  
  - **Permission Scope:** All roles with multi-workspace assignments.
- [ ] **Item/Action:** Attempt tenant context tampering via URL param or header injection (`X-Tenant-ID: malicious_org`).  
  - **Expected Behavior:** Application backend rejects request with `403 Forbidden` or `401 Unauthorized`; logs security anomaly event to audit trail.  
  - **Permission Scope:** Security Boundary (Zero-Trust).

---

### 2.2 Universal Search & Command Palette (`Cmd + K` / `Ctrl + K`)

- [ ] **Item/Action:** Trigger command palette via shortcut (`Cmd+K`) or header search input.  
  - **Expected Behavior:** Modal renders with autofocus on search input; displays recent searches and quick navigation shortcuts.  
  - **Permission Scope:** Visible and accessible to all roles.
- [ ] **Item/Action:** Query projects and tasks in universal search bar.  
  - **Expected Behavior:** Returns results strictly bounded by role authorization. Guest sees only assigned tasks; Member sees public/assigned projects; Admin/Manager sees all workspace projects.  
  - **Permission Scope:** RBAC-scoped read (`search:query`).
- [ ] **Item/Action:** Search for billing invoices or subscription terms (e.g., "Invoice #4920").  
  - **Expected Behavior:** Super Admin and Billing Admin see invoice results with deep links; Member, Manager, Auditor, and Guest receive zero results (indexing omits financial records).  
  - **Permission Scope:** Super Admin, Billing Admin only (`billing:read`).
- [ ] **Item/Action:** Search for audit log events or security settings (e.g., "SAML SSO Configuration").  
  - **Expected Behavior:** Super Admin, Workspace Admin, and Auditor see settings links; Standard Member and Guest see no security configuration items.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor only (`settings:search`).
- [ ] **Item/Action:** Execute direct navigation action from search (Enter on selected item).  
  - **Expected Behavior:** Navigates directly to target entity; if permission was revoked between search and click, renders `403 Forbidden` page with clean fallback.  
  - **Permission Scope:** All roles.

---

### 2.3 Quick Action (+ New) Header Button

- [ ] **Item/Action:** Click "+ New" quick action button in header.  
  - **Expected Behavior:** Dropdown/modal menu expands showing permissible creation options.  
  - **Permission Scope:** Visible to Super Admin, Workspace Admin, Manager, Member; hidden or disabled for Auditor and Guest.
- [ ] **Item/Action:** "New Project" item in Quick Action menu.  
  - **Expected Behavior:** Super Admin, Workspace Admin, Manager (visible and enabled); Member (enabled if org policy allows member project creation, otherwise disabled); Billing, Auditor, Guest (hidden).  
  - **Permission Scope:** `project:create`.
- [ ] **Item/Action:** "New Task" item in Quick Action menu.  
  - **Expected Behavior:** Super Admin, Workspace Admin, Manager, Member (visible and enabled); Auditor (hidden); Guest (enabled only within assigned project).  
  - **Permission Scope:** `task:create`.
- [ ] **Item/Action:** "Invite Team Member" item in Quick Action menu.  
  - **Expected Behavior:** Super Admin, Workspace Admin (visible and enabled); Manager (enabled if delegation flag is active); Member, Billing, Auditor, Guest (hidden; direct API call returns `403 Forbidden`).  
  - **Permission Scope:** `user:invite`.
- [ ] **Item/Action:** "Generate API Token" item in Quick Action menu.  
  - **Expected Behavior:** Super Admin, Workspace Admin (visible); all other roles (hidden).  
  - **Permission Scope:** `developer:token_create`.

---

### 2.4 Notification Center & Alert Subsystem

- [ ] **Item/Action:** Click header bell icon to display notification slide-out drawer.  
  - **Expected Behavior:** Drawer expands showing unread badge count, tabbed categories (All, Unread, Mentions, System Alerts).  
  - **Permission Scope:** All roles (`notification:read`).
- [ ] **Item/Action:** Click "Mark All as Read" button.  
  - **Expected Behavior:** Optimistically clears unread badge count; issues `PATCH /api/v1/notifications/mark-read`; updates badge across open tabs via WebSocket broadcast.  
  - **Permission Scope:** All roles (`notification:update`).
- [ ] **Item/Action:** Click individual notification item (e.g., "You were mentioned in Task #104").  
  - **Expected Behavior:** Marks notification as read; deep-links user to referenced entity; if entity has been deleted, displays graceful "Item no longer exists" toast.  
  - **Permission Scope:** All roles.
- [ ] **Item/Action:** Filter notifications by "Billing" or "Security Alerts".  
  - **Expected Behavior:** Super Admin and Billing Admin see invoice alerts and payment failures; Workspace Admin sees SSO/security warnings; Members and Guests see only task/mention alerts.  
  - **Permission Scope:** Role-filtered notification stream.
- [ ] **Item/Action:** Open "Notification Preferences" modal from drawer footer.  
  - **Expected Behavior:** Displays toggle matrix for Email, In-App, SMS, and Slack/Teams digests across event types (Mentions, Assignments, Project Updates, System Maintenance).  
  - **Permission Scope:** All roles (personal preferences).
- [ ] **Item/Action:** Toggle organization-wide broadcast notifications (System-wide banner alert).  
  - **Expected Behavior:** Super Admin (can create and broadcast tenant alert banner); all other roles (read-only banner display, no broadcast creation).  
  - **Permission Scope:** Super Admin only (`announcement:broadcast`).

---

### 2.5 User Profile & Security Management (Avatar Menu)

- [ ] **Item/Action:** Open User Avatar dropdown in top-right header.  
  - **Expected Behavior:** Renders user avatar, full name, email, current role badge, and menu links: Profile, Security Credentials, Sessions, Appearance (Dark/Light Mode), Log Out.  
  - **Permission Scope:** All roles.
- [ ] **Item/Action:** View Profile page (`/account/profile`).  
  - **Expected Behavior:** Displays personal info (First Name, Last Name, Job Title, Timezone, Language, Phone Number).  
  - **Permission Scope:** All roles (`profile:read`).
- [ ] **Item/Action:** Update personal profile details (Name, Job Title, Avatar image upload).  
  - **Expected Behavior:** Form validation enforces image size (<5MB), formats (PNG/JPEG/WebP); updates save with toast confirmation; header avatar updates immediately.  
  - **Permission Scope:** All roles (`profile:update`).
- [ ] **Item/Action:** Change account password (`/account/security`).  
  - **Expected Behavior:** Requires Current Password, New Password, Confirm Password; validates password complexity (min 12 chars, uppercase, lowercase, numbers, special symbol); prevents reuse of last 5 passwords; terminates all other sessions on success.  
  - **Permission Scope:** All roles (disabled if account is managed via Enterprise SAML/SSO).
- [ ] **Item/Action:** Multi-Factor Authentication (MFA / 2FA) setup with TOTP Authenticator.  
  - **Expected Behavior:** Displays QR code and manual entry key; requires 6-digit TOTP verification before activating; generates 10 single-use emergency backup recovery codes with download/copy modal.  
  - **Permission Scope:** All roles (`mfa:manage`).
- [ ] **Item/Action:** WebAuthn / FIDO2 Hardware Key registration (YubiKey / TouchID).  
  - **Expected Behavior:** Prompts browser WebAuthn ceremony; stores public key credential; labels key with custom device name; verifies hardware-backed authentication.  
  - **Permission Scope:** All roles (`webauthn:register`).
- [ ] **Item/Action:** Manage Personal API Access Tokens (PAT) (`/account/tokens`).  
  - **Expected Behavior:** Lists existing tokens (masked: `pat_live_****3a19`), creation date, last used date, expiration date; provides "Generate New Token" button with scope selection; displays raw secret string once with copy prompt; provides "Revoke" button.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Standard Member (if enabled by policy); Auditor, Guest (hidden/disabled).
- [ ] **Item/Action:** Active Sessions & Device Management (`/account/sessions`).  
  - **Expected Behavior:** Lists all active sessions: Device type, Browser, OS, IP Address, Geolocation, "Current Session" tag, and "Revoke Session" button.  
  - **Permission Scope:** All roles (`sessions:read`, `sessions:revoke`).
- [ ] **Item/Action:** Click "Sign Out of All Devices".  
  - **Expected Behavior:** Invalidates all refresh tokens and active JWTs across all devices except current; confirms action via modal.  
  - **Permission Scope:** All roles (`sessions:revoke_all`).
- [ ] **Item/Action:** Log Out action (`/auth/logout`).  
  - **Expected Behavior:** Revokes current session token; clears local storage, session storage, and HttpOnly auth cookies; redirects to `/auth/login` with logout notice.  
  - **Permission Scope:** All roles.

---

## 3. Sidebar Architecture & Navigation Tree (RBAC Permission Matrix)

The application navigation sidebar serves as the primary gateway to all platform functional domains. Below is the navigation hierarchy and the associated access control matrix.

```
┌────────────────────────────────────────────────────────┐
│  SAAS PLATFORM                                         │
│                                                        │
│  📊 Dashboard                                          │
│     ├── Executive Overview                             │
│     ├── Operational Feed                               │
│     └── My Workspaces & Tasks                          │
│                                                        │
│  📈 Analytics & Reports                                │
│     ├── Performance Metrics                            │
│     ├── Resource Metering                              │
│     └── Custom Report Builder                          │
│                                                        │
│  📁 Projects & Operations                              │
│     ├── Active Projects Grid                           │
│     ├── Kanban Boards                                  │
│     └── Timeline & Gantt                               │
│                                                        │
│  👥 Team Management                                    │
│     ├── Members Directory                              │
│     ├── Invitations & Onboarding                       │
│     └── Roles & RBAC Matrix                            │
│                                                        │
│  💳 Billing & Subscriptions                            │
│     ├── Plan & Invoicing                               │
│     ├── Payment Methods                                │
│     └── Usage Quotas                                   │
│                                                        │
│  🔌 Integrations & Apps                                │
│     ├── Installed Connectors                           │
│     └── App Directory                                  │
│                                                        │
│  🛠️ Developer Hub                                     │
│     ├── API Keys & Secrets                             │
│     └── Webhook Endpoints                              │
│                                                        │
│  🛡️ Security & Audit Logs                              │
│     ├── System Audit Trail                             │
│     └── Compliance & Retention                         │
│                                                        │
│  ⚙️ Organization Settings                              │
│     ├── General Profile                                │
│     ├── SSO & Authentication                           │
│     └── Domain Verification                            │
└────────────────────────────────────────────────────────┘
```

### 3.1 Sidebar Navigation Access Matrix

*Legend: `R/W` = Read & Write Full Access, `R/O` = Read-Only Access, `H` = Hidden from UI (Direct URL returns 403 Forbidden).*

| Sidebar Navigation Module | Route Path | Super Admin | Workspace Admin | Manager | Billing Admin | Standard Member | Auditor (Read-Only) | Guest |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | `/dashboard` | R/W | R/W | R/W | R/O (Billing) | R/W (Scoped) | R/O | R/O (Assigned) |
| ├── Executive Overview | `/dashboard/overview` | R/W | R/W | R/W | H | R/O (Masked) | R/O | H |
| ├── Operational Feed | `/dashboard/activity` | R/W | R/W | R/W | H | R/O | R/O | H |
| └── My Work & Tasks | `/dashboard/my-work` | R/W | R/W | R/W | H | R/W | R/O | R/W (Scoped) |
| **Analytics & Reports** | `/analytics` | R/W | R/W | R/W | R/O (Financial)| R/O (Team) | R/O | H |
| ├── Performance Trends | `/analytics/performance` | R/W | R/W | R/W | H | R/O | R/O | H |
| ├── Resource Metering | `/analytics/metering` | R/W | R/W | R/W | R/O | H | R/O | H |
| └── Custom Report Builder| `/analytics/builder` | R/W | R/W | R/W | H | H | R/O (Presets) | H |
| **Projects & Operations** | `/projects` | R/W | R/W | R/W | H | R/W | R/O | R/W (Scoped) |
| ├── Project Master Grid | `/projects/list` | R/W | R/W | R/W | H | R/W | R/O | R/O (Assigned) |
| ├── Kanban Boards | `/projects/boards` | R/W | R/W | R/W | H | R/W | R/O | R/W (Scoped) |
| └── Timeline & Roadmaps | `/projects/timeline` | R/W | R/W | R/W | H | R/O | R/O | H |
| **Team Management** | `/team` | R/W | R/W | R/O | H | R/O (Directory)| R/O | H |
| ├── Members Directory | `/team/members` | R/W | R/W | R/O | H | R/O (Directory)| R/O | H |
| ├── Invitations | `/team/invites` | R/W | R/W | R/W (Delegated)| H | H | R/O | H |
| └── Roles & Permissions | `/team/roles` | R/W | R/W | H | H | H | R/O | H |
| **Billing & Invoicing** | `/billing` | R/W | R/O (Optional) | H | R/W | H | H | H |
| ├── Subscription & Plan | `/billing/plan` | R/W | R/O | H | R/W | H | H | H |
| ├── Payment Methods | `/billing/payment` | R/W | H | H | R/W | H | H | H |
| └── Invoices & Receipts | `/billing/invoices` | R/W | R/O | H | R/W | H | H | H |
| **Integrations & Apps** | `/integrations` | R/W | R/W | R/O | H | R/O (Catalog) | R/O | H |
| ├── Installed Connectors| `/integrations/installed`| R/W | R/W | R/O | H | H | R/O | H |
| └── App Marketplace | `/integrations/marketplace`| R/W | R/W | R/O | H | R/O | R/O | H |
| **Developer Hub** | `/developer` | R/W | R/W | H | H | H | R/O (Docs) | H |
| ├── API Keys & Secrets | `/developer/api-keys` | R/W | R/W | H | H | H | H | H |
| └── Webhook Subscriptions| `/developer/webhooks` | R/W | R/W | H | H | H | H | H |
| **Security & Audit Logs**| `/audit-logs` | R/W | R/W | H | H | H | R/O | H |
| ├── System Audit Trail | `/audit-logs/events` | R/W | R/W | H | H | H | R/O | H |
| └── Compliance Archive | `/audit-logs/compliance` | R/W | R/W | H | H | H | R/O | H |
| **Organization Settings**| `/settings` | R/W | R/W | H | H | H | R/O | H |
| ├── General Profile | `/settings/general` | R/W | R/W | H | H | H | R/O | H |
| ├── SSO & Identity (SAML)| `/settings/sso` | R/W | R/W | H | H | H | R/O | H |
| └── Domain Verification | `/settings/domains` | R/W | R/W | H | H | H | R/O | H |

---

### 3.2 Sidebar Direct URL Injection & Route Boundary Tests

- [ ] **Item/Action:** Navigate to `/billing` as Standard Member or Manager.  
  - **Expected Behavior:** Router client-guard immediately intercepts; redirects to `/403-forbidden` or `/dashboard`; no financial metadata rendered in DOM; backend API calls to `/api/v1/billing/*` return HTTP status `403`.  
  - **Permission Scope:** Negative Test (Member/Manager boundary).
- [ ] **Item/Action:** Navigate to `/developer/api-keys` as Guest or Member.  
  - **Expected Behavior:** Redirects to 403 error page; no secret keys or token hashes exposed in network response payload.  
  - **Permission Scope:** Negative Test (Developer boundary).
- [ ] **Item/Action:** Navigate to `/audit-logs` as Standard Member or Guest.  
  - **Expected Behavior:** Returns `403 Forbidden` response; audit query endpoint fails with `{"error": "InsufficientPermissions", "code": 403}`.  
  - **Permission Scope:** Negative Test (Audit boundary).
- [ ] **Item/Action:** Navigate to `/settings/sso` as Manager or Billing Admin.  
  - **Expected Behavior:** Returns `403 Forbidden`; SAML metadata and certificate signing inputs are completely inaccessible.  
  - **Permission Scope:** Negative Test (SSO boundary).

---

## 4. Deep-Dive Sub-Sidebar & Nested Views: Exhaustive Functional Checklist

Below is the atomic, production-grade testing inventory for each primary application module, covering all state mutations, filters, data ingress/egress, and edge conditions.

---

### 4.1 Executive Dashboard (`/dashboard`)

The dashboard synthesizes operational status, system health, and assigned workload.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Timeframe: Last 30 Days ▼] [Team Filter: Engineering ▼]  [Edit Layout] [Export PDF]   │
├───────────────┬───────────────┬────────────────────────┬───────────────────────────────┤
│ Active Sprints│ Tasks Pending │ Total Spend / MTD      │ System SLA Compliance         │
│ 14 (+2)       │ 142 (-12)     │ $12,450 [MASKED]       │ 99.98%                        │
├───────────────┴───────────────┴────────────────────────┴───────────────────────────────┤
│ [📈 Velocity Trends Line Chart]                [🍩 Task Status Distribution Donut]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Recent Activity Stream                                                                 │
│ • Alice deployed Project Alpha to Production                               2 mins ago  │
│ • Bob assigned Task #881 to Charlie                                       14 mins ago  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.1 Overview & Widget Grid (`/dashboard/overview`)
- [ ] **Item/Action:** Load dashboard overview page.  
  - **Expected Behavior:** All authorized widgets render within 1.5s; skeleton loaders display while async data is fetched; no layout shift (CLS < 0.1).  
  - **Permission Scope:** All roles (widgets dynamically populated per role).
- [ ] **Item/Action:** Filter dashboard by Date Range (Today, 7D, 30D, Quarter, Year-to-Date, Custom).  
  - **Expected Behavior:** Widget data recalculates instantly; date range parameters append to URL query string (`?range=30d`); page refresh preserves selected date state.  
  - **Permission Scope:** All roles.
- [ ] **Item/Action:** Filter dashboard by Team / Department selector.  
  - **Expected Behavior:** Super Admin/Admin/Manager can select any department; Standard Member can select only their assigned department; Guest has department filter locked.  
  - **Permission Scope:** Scoped filter validation.
- [ ] **Item/Action:** KPI Widget: Financial Spend / MRR counter.  
  - **Expected Behavior:** Super Admin, Workspace Admin, Billing Admin see exact dollar amounts; Manager, Member, Auditor, and Guest see widget completely omitted or masked (`$ ****`).  
  - **Permission Scope:** `financial_kpi:read`.
- [ ] **Item/Action:** Drag-and-drop dashboard widget rearrangement (Gridster / react-grid-layout).  
  - **Expected Behavior:** Super Admin and Workspace Admin can rearrange default company layout and click "Save as Default Org Layout"; Standard Member can customize personal layout only.  
  - **Permission Scope:** `dashboard:layout_edit`.
- [ ] **Item/Action:** Interactive chart hover tooltips and drill-downs.  
  - **Expected Behavior:** Hovering over data points displays tooltip with timestamp and value; clicking data point deep-links to filtered task/project list.  
  - **Permission Scope:** All roles.
- [ ] **Item/Action:** Click "Export Dashboard Snapshot" -> PDF format.  
  - **Expected Behavior:** Generates clean, vector-rendered executive PDF; strips interactive UI controls (buttons, pagination); respects role-based data masking in exported document.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Auditor.

#### 4.1.2 Operational Activity Feed (`/dashboard/activity`)
- [ ] **Item/Action:** Infinite scroll pagination on activity stream.  
  - **Expected Behavior:** Scrolling to bottom loads next 25 events; displays loading spinner; gracefully handles end-of-feed state ("No more activities").  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Member, Auditor.
- [ ] **Item/Action:** Real-time event ingestion via WebSockets.  
  - **Expected Behavior:** When another user completes a task or commits an update, a "New activities available - Click to refresh" banner appears without causing jarring auto-scroll.  
  - **Permission Scope:** All roles.
- [ ] **Item/Action:** Filter activity by action type (Comments, Task Moves, File Uploads, Approvals).  
  - **Expected Behavior:** Filter chips toggle on/off; multiple chips can be combined (`AND` logic).  
  - **Permission Scope:** All roles.

#### 4.1.3 My Work & Personal Workspace (`/dashboard/my-work`)
- [ ] **Item/Action:** Display "Assigned to Me" task table.  
  - **Expected Behavior:** Lists all active tasks where current user is assignee; color-coded priority badges (Urgent, High, Medium, Low); overdue tasks highlighted in red.  
  - **Permission Scope:** All roles (`tasks:read_assigned`).
- [ ] **Item/Action:** Quick inline status toggle (e.g., In Progress -> Completed).  
  - **Expected Behavior:** Clicking status dropdown updates status immediately (optimistic UI); dispatches `PATCH /api/v1/tasks/{id}/status`; updates task counter in real time.  
  - **Permission Scope:** Assigned user or Manager/Admin.

---

### 4.2 Analytics & Reporting Hub (`/analytics`)

Analytics provides business intelligence, resource metering, and ad-hoc data queries.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Report: Sprint Velocity ▼] [From: 2026-01-01] [To: 2026-06-30]  [💾 Save Preset] [Export]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Search metrics...]                                     [Columns: 8 Selected ▼]        │
├────────────────────┬──────────────┬───────────────┬────────────────┬───────────────────┤
│ Team / Squad       │ Completed SP │ SLA Met %     │ Escaped Bugs   │ Cycle Time (Days) │
├────────────────────┼──────────────┼───────────────┼────────────────┼───────────────────┤
│ Core Platform      │ 320          │ 98.4%         │ 2              │ 3.4               │
│ Mobile Applications│ 210          │ 94.1%         │ 5              │ 5.1               │
├────────────────────┴──────────────┴───────────────┴────────────────┴───────────────────┤
│ Showing 1-10 of 48 records                 [< Prev] [1] [2] [3] [4] [5] [Next >]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.1 Performance & Trend Analysis (`/analytics/performance`)
- [ ] **Item/Action:** Render multi-series velocity and cycle-time line chart.  
  - **Expected Behavior:** Displays smooth Bezier curves; handles null data points cleanly without throwing uncaught exceptions; supports legend item toggle to isolate series.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Auditor.
- [ ] **Item/Action:** Granular multi-column sorting on tabular analytics data.  
  - **Expected Behavior:** Clicking column headers toggles: Ascending -> Descending -> Natural order; `Shift + Click` allows secondary sorting across multiple columns.  
  - **Permission Scope:** All authorized roles.
- [ ] **Item/Action:** Pagination controls: change page size (10, 25, 50, 100 rows per page).  
  - **Expected Behavior:** Grid updates page size; resets to page 1; updates pagination summary text ("Showing 1-25 of 148 results").  
  - **Permission Scope:** All authorized roles.

#### 4.2.2 Custom Query & Report Builder (`/analytics/builder`)
- [ ] **Item/Action:** Select metrics, dimensions, and aggregation functions (SUM, AVG, COUNT, P95, P99).  
  - **Expected Behavior:** Visual query builder updates preview table; validates formula syntax; prevents invalid division-by-zero aggregations.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager (`analytics:custom_build`).
- [ ] **Item/Action:** Save custom report preset ("Q3 Executive Engineering Velocity").  
  - **Expected Behavior:** Modal prompts for Report Name, Description, and Sharing Scope (Private, Team, Organization); saves to database; appears in saved reports sidebar.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager.
- [ ] **Item/Action:** Schedule automated email dispatch of saved report.  
  - **Expected Behavior:** Configuration modal allows frequency (Daily, Weekly Monday 8 AM, Monthly 1st); accepts recipient emails; dispatches test payload.  
  - **Permission Scope:** Super Admin, Workspace Admin only.
- [ ] **Item/Action:** Export report data: CSV, XLSX, and JSON Data formats.  
  - **Expected Behavior:** Exports match applied filters and column selections exactly; numbers retain raw numeric format (not converted to strings); strings with commas/quotes are properly escaped; CSV injection payloads (`=CMD|' /C calc'!A0`) are sanitized by prepending a single quote.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Auditor (`data:export`).

---

### 4.3 Core Operations: Projects, Tasks & Workflows (`/projects`)

This module constitutes the primary operational engine of the SaaS platform.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [📁 Projects] / Core Banking Integration                                               │
│ [Overview]  [Tasks (142)]  [Kanban Board]  [Gantt Timeline]  [Files]  [Settings]       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [+ New Task] [Filter: Open ▼] [Assignee: All ▼] [Group: Status ▼] [Search tasks...]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Backlog (12)]         [In Progress (8)]        [In Review (4)]        [Done (118)]    │
│ ┌────────────────────┐ ┌────────────────────┐   ┌────────────────────┐ ┌──────────────┐│
│ │ Task #902          │ │ Task #884          │   │ Task #879          │ │ Task #812    ││
│ │ API Auth Bug       │ │ OAuth2 Refresh     │   │ DB Migration Review│ │ UI Polish    ││
│ │ [High] [Bob]       │ │ [Urgent] [Alice]   │   │ [Medium] [Charlie] │ │ [Low] [Dave] ││
│ └────────────────────┘ └────────────────────┘   └────────────────────┘ └──────────────┘│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.3.1 Master Projects Grid & Project CRUD (`/projects/list`)
- [ ] **Item/Action:** Click "Create New Project" button.  
  - **Expected Behavior:** Modal opens with fields: Project Title (required), Key/Slug (auto-generated, editable, uppercase regex `^[A-Z0-9_-]{2,10}$`), Description (Markdown), Project Lead (dropdown), Privacy (Public to Workspace vs Private/Restricted), Target Completion Date.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager (`project:create`).
- [ ] **Item/Action:** Submit project creation form with duplicate Project Key.  
  - **Expected Behavior:** Form validation blocks submission; highlights field with error: "Project key 'CORE' already exists in this workspace".  
  - **Permission Scope:** Form validation.
- [ ] **Item/Action:** Edit Project metadata (rename, change project lead, update dates).  
  - **Expected Behavior:** Saves changes; writes audit log event (`PROJECT_UPDATE`); emits notification to old and new project leads.  
  - **Permission Scope:** Super Admin, Workspace Admin, assigned Project Lead.
- [ ] **Item/Action:** Archive Project (`State: Archived`).  
  - **Expected Behavior:** Project transitions to read-only state; hidden from default active project lists; banner indicates "This project is archived"; tasks cannot be edited; can be unarchived.  
  - **Permission Scope:** Super Admin, Workspace Admin, Project Lead (`project:archive`).
- [ ] **Item/Action:** Delete Project (Permanent Destruction).  
  - **Expected Behavior:** Modal enforces destructive confirmation: requires user to explicitly type the project key (e.g., "DELETE CORE"); warns all tasks, attachments, and comments will be permanently erased; Super Admin/Admin only.  
  - **Permission Scope:** Super Admin, Workspace Admin only (`project:delete`).

#### 4.3.2 Kanban Board & Task State Mutations (`/projects/boards`)
- [ ] **Item/Action:** Drag task card from "Backlog" column and drop into "In Progress".  
  - **Expected Behavior:** Drag-and-drop animation is fluid; card snaps into place; status update dispatches via API; board column counters recalculate immediately; WebSockets update boards of other concurrent viewers.  
  - **Permission Scope:** Super Admin, Admin, Manager, Standard Member (`task:update_status`).
- [ ] **Item/Action:** Enforce workflow transition rules (e.g., Task cannot move to "Done" without required QA approval sign-off).  
  - **Expected Behavior:** Dragging card to "Done" triggers validation check; if approval is missing, card bounces back to previous column; displays modal/toast: "Missing required approval: QA Lead Sign-Off".  
  - **Permission Scope:** Workflow state machine enforcement.
- [ ] **Item/Action:** Inline task creation within column (Click "+ Add Card").  
  - **Expected Behavior:** Inline input opens at bottom of column; typing title and pressing Enter immediately creates task with default attributes; auto-focus remains ready for next card.  
  - **Permission Scope:** Super Admin, Admin, Manager, Member.
- [ ] **Item/Action:** Reorder cards vertically within the same column.  
  - **Expected Behavior:** Updates task priority order / ranking index (`lexorank` or fractional indexing); persists new order on server without reloading.  
  - **Permission Scope:** Super Admin, Admin, Manager, Member.

#### 4.3.3 Detailed Task Inspector Drawer / Modal (`/projects/:id/tasks/:taskId`)
- [ ] **Item/Action:** Click task card to open task detail slide-over drawer.  
  - **Expected Behavior:** Drawer slides out from right; displays task title, ID, status dropdown, priority dropdown, assignee picker, reporter, tags, rich-text description editor, subtask checklist, attachment gallery, and comment feed.  
  - **Permission Scope:** All roles authorized for the project.
- [ ] **Item/Action:** Rich-text description editor (Markdown / WYSIWYG).  
  - **Expected Behavior:** Supports headers, bold, italics, code blocks with syntax highlighting, bulleted lists, and tables; auto-saves draft on blur or typing pause (debounce 1000ms); displays "All changes saved" indicator.  
  - **Permission Scope:** Super Admin, Admin, Manager, Member (`task:edit`).
- [ ] **Item/Action:** Assignee selector dropdown.  
  - **Expected Behavior:** Searchable dropdown listing all workspace members; selecting new assignee sends notification; shows assignee avatar; allows "Unassign".  
  - **Permission Scope:** Super Admin, Admin, Manager, Member.
- [ ] **Item/Action:** Subtask / Checklist item management.  
  - **Expected Behavior:** Add subtask, toggle checkbox (updates progress bar e.g. "3 of 5 completed"), reorder subtasks, delete subtask.  
  - **Permission Scope:** Super Admin, Admin, Manager, Member.
- [ ] **Item/Action:** File Attachment upload via Drag-and-Drop.  
  - **Expected Behavior:** Dragging file over dropzone highlights border; displays upload progress bar; enforces file size limit (max 50MB); blocks dangerous file extensions (`.exe`, `.sh`, `.bat`, `.vbs`, `.js`, `.scr`); validates MIME types; uploads to S3/Cloud Storage via pre-signed URL.  
  - **Permission Scope:** Super Admin, Admin, Manager, Member (`task:attachment_upload`).
- [ ] **Item/Action:** Download file attachment.  
  - **Expected Behavior:** Clicking attachment triggers secure download via short-lived signed URL (15-minute expiry); inline preview supports images (PNG/JPG/SVG), PDF documents, and plain text.  
  - **Permission Scope:** All roles authorized to view task (`attachment:download`).
- [ ] **Item/Action:** Commenting & Mentions system.  
  - **Expected Behavior:** Post comment with rich text; typing `@` triggers user mention popup filtered by project members; submitting comment renders immediately; mentioned user receives notification; author can edit/delete comment; other users cannot edit someone else's comment (unless Super Admin/Admin).  
  - **Permission Scope:** `comment:create`, `comment:edit_own`.
- [ ] **Item/Action:** Activity & Audit tab within task drawer.  
  - **Expected Behavior:** Chronological list of every change made to task (e.g., "Alice changed Priority from Low to Urgent", "Bob changed Due Date to Oct 30"); displays exact timestamps and user avatars.  
  - **Permission Scope:** All authorized roles (`task:audit_read`).

#### 4.3.4 Bulk Task Actions (Batch Operations)
- [ ] **Item/Action:** Select multiple tasks via table checkboxes (or "Select All 150 tasks").  
  - **Expected Behavior:** Floating bulk action bar appears at screen bottom: displays count ("12 tasks selected"), options: Bulk Assign, Bulk Status Change, Bulk Tag, Bulk Move Project, Bulk Archive, Bulk Delete.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager.
- [ ] **Item/Action:** Execute Bulk Status Change (e.g., move 25 tasks to "Completed").  
  - **Expected Behavior:** Dispatches batch update request; displays progress indicator; updates all selected tasks; handles partial failures gracefully (reports "23 updated, 2 failed due to missing required fields").  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager.
- [ ] **Item/Action:** Bulk Delete confirmation.  
  - **Expected Behavior:** Modal warns "You are about to delete 15 tasks"; requires confirmation; soft-deletes tasks to Trash Bin.  
  - **Permission Scope:** Super Admin, Workspace Admin only.

#### 4.3.5 Data Ingress & Egress: Import / Export Wizard
- [ ] **Item/Action:** Open "Import Tasks" modal (`/projects/:id/import`).  
  - **Expected Behavior:** Wizard Step 1: Upload CSV or JSON file; Step 2: Column Mapping interface (maps CSV headers like "Task Name", "Owner Email", "Due Date" to platform schema); Step 3: Dry-run preview and validation report; Step 4: Import execution with progress bar.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager (`task:import`).
- [ ] **Item/Action:** Upload malformed CSV during import (missing required columns, invalid date format).  
  - **Expected Behavior:** Wizard flags specific erroneous rows and line numbers before committing any records; offers "Skip invalid rows" or "Cancel import" options.  
  - **Permission Scope:** Ingress validation check.
- [ ] **Item/Action:** Export Project Tasks to CSV / Excel / JSON.  
  - **Expected Behavior:** Respects currently applied filters; exports clean data; generates file download within acceptable timeout (<5s for 10,000 tasks).  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Auditor (`task:export`).

---

### 4.4 Team Management & Access Governance (`/team`)

Governance controls user provisioning, invitations, role assignments, and directory management.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [👥 Team Members]                                       [+ Invite Members] [Export CSV]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Search members by name or email...]               [Role: All Roles ▼] [Status: Active]│
├──────────────────┬──────────────────────┬──────────────────┬───────────┬───────────────┤
│ User Name        │ Email Address        │ Role             │ 2FA Status│ Actions       │
├──────────────────┼──────────────────────┼──────────────────┼───────────┼───────────────┤
│ Sarah Jenkins    │ s.jenkins@corp.com   │ Workspace Admin  │ [Enabled] │ [Edit] [•••]  │
│ Alex Rivera      │ a.rivera@corp.com    │ Manager          │ [Enabled] │ [Edit] [•••]  │
│ Dave Miller      │ d.miller@corp.com    │ Standard Member  │ [Disabled]│ [Edit] [•••]  │
└──────────────────┴──────────────────────┴──────────────────┴───────────┴───────────────┘
```

#### 4.4.1 Member Directory & Profile Inspection (`/team/members`)
- [ ] **Item/Action:** Search user directory by Name, Email, or Department.  
  - **Expected Behavior:** Debounced search queries update table; highlights matching text.  
  - **Permission Scope:** All roles except Guest (Guest cannot access directory).
- [ ] **Item/Action:** Inspect user detail card (Click on member row).  
  - **Expected Behavior:** Slide-out drawer displays member info, assigned projects, join date, last login timestamp, active sessions count.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Auditor.

#### 4.4.2 User Invitations & Onboarding (`/team/invites`)
- [ ] **Item/Action:** Click "Invite Members" button.  
  - **Expected Behavior:** Modal accepts one or multiple email addresses (comma or space separated); Role selection dropdown; optional Team/Project pre-assignment dropdown; sends invitation email with signed cryptographic token link (72-hour validity).  
  - **Permission Scope:** Super Admin, Workspace Admin (and Manager if organization invitation delegation policy is enabled).
- [ ] **Item/Action:** Attempt invitation exceeding licensed seat threshold.  
  - **Expected Behavior:** System blocks invite modal; warns: "Seat limit reached (25/25). Please upgrade subscription or contact Billing Admin to purchase additional seats".  
  - **Permission Scope:** License quota enforcement.
- [ ] **Item/Action:** Resend pending invitation.  
  - **Expected Behavior:** Generates new invitation token; revokes prior token; sends fresh invitation email; updates "Last sent" timestamp.  
  - **Permission Scope:** Super Admin, Workspace Admin.
- [ ] **Item/Action:** Revoke / Cancel pending invitation.  
  - **Expected Behavior:** Invitation status marks as "Revoked"; link becomes immediately invalid; clicking revoked link shows "This invitation is no longer valid".  
  - **Permission Scope:** Super Admin, Workspace Admin.

#### 4.4.3 Role Mutation & Account Lifecycle State Changes
- [ ] **Item/Action:** Change user role (e.g. Standard Member -> Manager).  
  - **Expected Behavior:** Super Admin and Workspace Admin can change roles; dropdown updates; user permissions update on their next request or token refresh; audit log records `USER_ROLE_CHANGE`.  
  - **Permission Scope:** Super Admin, Workspace Admin (`user:role_modify`).
- [ ] **Item/Action:** Privilege Escalation Prevention Test.  
  - **Expected Behavior:** A Workspace Admin cannot promote any user to Super Admin (only Super Admin can); a Manager cannot promote anyone to Admin or Manager; direct PUT requests to `/api/v1/users/{id}/role` with elevated roles return `403 Forbidden`.  
  - **Permission Scope:** Security Boundary (Anti-Escalation).
- [ ] **Item/Action:** Self-Demotion / Self-Lockout Prevention Test.  
  - **Expected Behavior:** A Super Admin who is the sole owner cannot demote their own account or delete their own account; system displays error: "Organization must have at least one active Super Admin. Transfer ownership before demoting this account".  
  - **Permission Scope:** Anti-Lockout business logic.
- [ ] **Item/Action:** Suspend / Deactivate Member Account.  
  - **Expected Behavior:** Modal prompts for confirmation; deactivating user immediately terminates their active sessions; blacklists their JWT refresh tokens; sets account status to "Suspended"; user cannot log in; assigned tasks remain preserved with unassigned prompt.  
  - **Permission Scope:** Super Admin, Workspace Admin (`user:suspend`).
- [ ] **Item/Action:** Remove / Delete User from Organization.  
  - **Expected Behavior:** Prompts for asset transfer wizard ("Reassign tasks, projects, and documents to another team member"); permanently removes member from tenant directory.  
  - **Permission Scope:** Super Admin, Workspace Admin.

#### 4.4.4 Custom Roles & RBAC Matrix Builder (`/team/roles`)
- [ ] **Item/Action:** View custom role list and system default roles.  
  - **Expected Behavior:** Default roles (Super Admin, Member, etc.) tagged with "System Built-in" badge (uneditable name); Custom roles tagged with "Custom".  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor (Read-only).
- [ ] **Item/Action:** Click "Create Custom Role" button.  
  - **Expected Behavior:** Builder interface opens; input for Role Name and Description; granular permission tree with checkboxes across categories: Projects (Create, Edit, Delete, Archive), Billing (View, Edit), Team (Invite, Manage), Developer (API Keys, Webhooks), Audit (View, Export).  
  - **Permission Scope:** Super Admin, Workspace Admin (`roles:create`).
- [ ] **Item/Action:** Save and assign custom role to member.  
  - **Expected Behavior:** Custom role appears in member role dropdown; member receives exact subset of granted permissions; access to non-selected endpoints strictly blocked with `403`.  
  - **Permission Scope:** Super Admin, Workspace Admin.

---

### 4.5 Billing, Invoicing & Subscription Management (`/billing`)

Dedicated financial governance domain restricted to Billing Admins and Super Admins.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [💳 Billing & Subscription]                             [Billing Contact: CFO Office]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Active Plan: ENTERPRISE TIER ($499 / mo)                 Next Billing Date: Nov 1, 2026│
│ Seats Allocated: 28 of 50 Used                           [Upgrade Plan] [Add Seats]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Payment Methods]                                                                      │
│ • VISA ending in 4242 (Expires 12/28) - Default Primary          [Edit] [Remove]       │
│ • [+ Add New Payment Method]                                                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Invoices & Billing History                                                             │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬────────────────────────┐ │
│ │ Invoice #    │ Date         │ Amount (USD) │ Status       │ Actions                │ │
│ ├──────────────┼──────────────┼──────────────┼──────────────┼────────────────────────┤ │
│ │ INV-2026-009 │ Oct 01, 2026 │ $499.00      │ [PAID]       │ [Download PDF] [View]  │ │
│ │ INV-2026-008 │ Sep 01, 2026 │ $499.00      │ [PAID]       │ [Download PDF] [View]  │ │
│ └──────────────┴──────────────┴──────────────┴──────────────┴────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.5.1 Plan Management & Tier Mutations (`/billing/plan`)
- [ ] **Item/Action:** View active subscription details.  
  - **Expected Behavior:** Displays plan tier name, billing frequency (Monthly vs Annual with 20% discount badge), renewal date, seat utilization bar.  
  - **Permission Scope:** Super Admin, Billing Admin (`billing:read`).
- [ ] **Item/Action:** Upgrade subscription tier (e.g. Pro -> Enterprise).  
  - **Expected Behavior:** Proration calculation preview modal opens: displays immediate pro-rated charge, credits from unused days, new recurring amount; clicking "Confirm Upgrade" charges card via Stripe/Adyen; unlocks Enterprise features immediately without page reload.  
  - **Permission Scope:** Super Admin, Billing Admin (`billing:plan_upgrade`).
- [ ] **Item/Action:** Downgrade subscription tier (e.g. Enterprise -> Pro).  
  - **Expected Behavior:** Modal warns of feature loss (e.g., "SAML SSO and Custom Roles will be disabled at the end of the current billing cycle"); enforces seat reduction if active seats exceed lower tier limit.  
  - **Permission Scope:** Super Admin, Billing Admin (`billing:plan_downgrade`).
- [ ] **Item/Action:** Seat expansion slider (Add 10 seats).  
  - **Expected Behavior:** Calculates incremental monthly cost; charges primary card; updates seat allocation counter immediately.  
  - **Permission Scope:** Super Admin, Billing Admin.

#### 4.5.2 Payment Methods & PCI Compliance (`/billing/payment`)
- [ ] **Item/Action:** Add new Credit Card via PCI-compliant iframe (Stripe Elements / Braintree).  
  - **Expected Behavior:** Card number, CVC, and expiration inputs rendered inside isolated iframe; raw PAN never touches application backend; handles 3D Secure / Strong Customer Authentication (SCA) biometric modal; sets as default payment method.  
  - **Permission Scope:** Super Admin, Billing Admin (`billing:payment_method_add`).
- [ ] **Item/Action:** Remove secondary payment method.  
  - **Expected Behavior:** Card is removed from list and vaulted provider.  
  - **Permission Scope:** Super Admin, Billing Admin.
- [ ] **Item/Action:** Attempt to delete the sole default payment method on an active paid plan.  
  - **Expected Behavior:** System blocks deletion: "Cannot delete the active default payment method. Please add an alternative card before removing this one".  
  - **Permission Scope:** Financial safeguard.
- [ ] **Item/Action:** Update Billing Address and Tax Information (VAT ID / GSTIN / Tax Exemption).  
  - **Expected Behavior:** Validates VAT ID format via VIES API; calculates applicable sales tax/VAT dynamically based on country and zip code.  
  - **Permission Scope:** Super Admin, Billing Admin.

#### 4.5.3 Invoices & Statements (`/billing/invoices`)
- [ ] **Item/Action:** View invoice history list.  
  - **Expected Behavior:** Lists invoice number, issue date, paid date, amount, currency, and status badge (Paid, Open, Past Due, Void).  
  - **Permission Scope:** Super Admin, Billing Admin (`billing:invoice_read`).
- [ ] **Item/Action:** Download official PDF invoice.  
  - **Expected Behavior:** Downloads complete legal tax invoice including company legal name, VAT ID, itemized breakdown, and transaction ID.  
  - **Permission Scope:** Super Admin, Billing Admin.

---

### 4.6 Integrations & Ecosystem Marketplace (`/integrations`)

Integrations manage third-party SaaS connections, OAuth app authorization, and webhook subscriptions.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🔌 Integrations & Marketplace]               [Search apps...] [Category: All ▼]       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Installed Connectors                                                                   │
│ ┌──────────────────────┬────────────────────────┬─────────────┬──────────────────────┐ │
│ │ App Name             │ Connected By           │ Status      │ Action               │ │
│ ├──────────────────────┼────────────────────────┼─────────────┼──────────────────────┤ │
│ │ Slack Notifications  │ Sarah Jenkins (Admin)  │ [ACTIVE]    │ [Configure] [Remove] │ │
│ │ GitHub Sync          │ Sarah Jenkins (Admin)  │ [ACTIVE]    │ [Configure] [Remove] │ │
│ └──────────────────────┴────────────────────────┴─────────────┴──────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Available Integrations Directory                                                       │
│ • Jira Software     • Salesforce CRM    • Google Drive    • Datadog Observability      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.6.1 Marketplace & OAuth App Connections (`/integrations/marketplace`)
- [ ] **Item/Action:** Browse integration directory by category (Communication, Developer Tools, Storage, CRM).  
  - **Expected Behavior:** Displays app cards with logo, description, and "Install" or "Configure" button.  
  - **Permission Scope:** Super Admin, Workspace Admin, Manager, Standard Member (Member sees catalog in read-only).
- [ ] **Item/Action:** Click "Connect to Slack" (OAuth2 authorization workflow).  
  - **Expected Behavior:** Opens third-party OAuth consent screen; validates `state` CSRF parameter; displays requested scopes (e.g., `channels:read`, `chat:write`); redirects back to callback URL `/integrations/oauth/callback`; securely stores encrypted tokens in database; displays "Successfully connected" alert.  
  - **Permission Scope:** Super Admin, Workspace Admin (`integrations:install`).
- [ ] **Item/Action:** Disconnect / Revoke third-party integration.  
  - **Expected Behavior:** Revokes OAuth token on external provider; purges stored access/refresh tokens; deletes associated event triggers; prompts user whether to retain or delete synced data.  
  - **Permission Scope:** Super Admin, Workspace Admin (`integrations:uninstall`).

#### 4.6.2 Outbound Webhook Subscriptions (`/integrations/webhooks`)
- [ ] **Item/Action:** Click "Add New Webhook" button.  
  - **Expected Behavior:** Modal requires: Endpoint URL (must be valid HTTPS), Description, Event Triggers multi-select (`task.created`, `task.updated`, `project.archived`, `user.invited`), and Custom Secret Token (auto-generated HMAC-SHA256 secret).  
  - **Permission Scope:** Super Admin, Workspace Admin (`webhooks:manage`).
- [ ] **Item/Action:** Webhook SSRF (Server-Side Request Forgery) Prevention Test.  
  - **Expected Behavior:** Attempting to register private IP addresses or loopback domains (`https://127.0.0.1:8080`, `https://169.254.169.254/latest/meta-data`, `https://localhost`) is rejected by backend URL validator with error: "Endpoint must be a publicly accessible, valid domain".  
  - **Permission Scope:** Security Boundary (SSRF Prevention).
- [ ] **Item/Action:** "Test Webhook" button (Ping Event Dispatch).  
  - **Expected Behavior:** Dispatches mock payload `{"event": "ping", "timestamp": 1774051200}`; inspects response; displays HTTP status code (e.g., `200 OK`), round-trip latency (e.g., `124ms`), and response body in modal.  
  - **Permission Scope:** Super Admin, Workspace Admin.
- [ ] **Item/Action:** Inspect Webhook Delivery Logs.  
  - **Expected Behavior:** Displays table of recent delivery attempts: Event, Timestamp, Delivery Status (Success / Failed), Response Code; provides "Retry Delivery" button for failed attempts.  
  - **Permission Scope:** Super Admin, Workspace Admin.

---

### 4.7 Developer Hub & API Management (`/developer`)

Developer tools for enterprise integration, API key issuance, and rate limit governance.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🛠️ Developer Hub & API Keys]                          [+ Generate New API Key]        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Active Organization API Keys                                                           │
│ ┌──────────────────────┬─────────────────────┬──────────────┬─────────────┬──────────┐ │
│ │ Key Name             │ Token Prefix        │ Created By   │ Last Used   │ Actions  │ │
│ ├──────────────────────┼─────────────────────┼──────────────┼─────────────┼──────────┤ │
│ │ CI/CD Automation     │ sk_live_8f92••••••  │ Super Admin  │ 10 mins ago │ [Revoke] │ │
│ │ Prod Data Warehouse  │ sk_live_41c0••••••  │ Super Admin  │ 2 days ago  │ [Revoke] │ │
│ └──────────────────────┴─────────────────────┴──────────────┴─────────────┴──────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ API Usage & Rate Limits (RPM: 120 / 1000)               [View OpenAPI / Swagger Docs]  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.7.1 API Key Lifecycle Management (`/developer/api-keys`)
- [ ] **Item/Action:** Click "Generate New API Key" button.  
  - **Expected Behavior:** Modal inputs: Key Label, Expiration Period (30 days, 90 days, 1 Year, Never), CIDR IP Restrictions (optional), Scopes checklist (`read:projects`, `write:tasks`, `read:users`).  
  - **Permission Scope:** Super Admin, Workspace Admin (`api_keys:create`).
- [ ] **Item/Action:** Token Secret Reveal Modal.  
  - **Expected Behavior:** Displays unmasked token string (e.g., `sk_live_90df8a34bc129e...`); displays warning: "Copy this secret now. It will never be shown again"; provides "Copy to Clipboard" button; closing modal permanently masks key in UI.  
  - **Permission Scope:** Key generation security protocol.
- [ ] **Item/Action:** Revoke API Key.  
  - **Expected Behavior:** Confirmation modal opens; confirming immediately invalidates key on backend cache (Redis/DB); subsequent API calls using revoked key immediately return `401 Unauthorized`.  
  - **Permission Scope:** Super Admin, Workspace Admin (`api_keys:revoke`).
- [ ] **Item/Action:** API Key Rolling / Grace Period Rotation.  
  - **Expected Behavior:** Allows generating new secret while keeping old key valid for 24 hours to prevent production downtime during deployment; auto-expires old key after grace window.  
  - **Permission Scope:** Super Admin, Workspace Admin.

#### 4.7.2 Rate Limiting & OpenAPI Documentation (`/developer/rate-limits`)
- [ ] **Item/Action:** Test API Rate Limiting boundary (exceed allowed RPM tier).  
  - **Expected Behavior:** When client exceeds 1000 requests/minute, API returns `429 Too Many Requests`; includes response headers: `Retry-After: 30`, `X-RateLimit-Limit: 1000`, `X-RateLimit-Remaining: 0`.  
  - **Permission Scope:** Infrastructure & Rate Limit validation.
- [ ] **Item/Action:** Interactive API Console / Swagger Explorer (`/developer/docs`).  
  - **Expected Behavior:** Embedded Swagger/Redoc UI renders OpenAPI 3.1 specification; allows authenticated "Try It Out" execution scoped to user's permissions.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor.

---

### 4.8 Security, Governance & Audit Logs (`/audit-logs`)

Compliance, forensic audit logs, and immutable activity recording.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🛡️ Audit Log & Compliance]           [Export to CSV / JSONL] [Live Refresh: Active]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Actor: All Users ▼] [Action: All Actions ▼] [Entity: All ▼] [Date: Past 7 Days ▼]     │
├──────────────────┬─────────────────┬────────────────┬────────────────┬─────────────────┤
│ Timestamp (UTC)  │ Actor           │ Action         │ Entity Affected│ IP Address      │
├──────────────────┼─────────────────┼────────────────┼────────────────┼─────────────────┤
│ 2026-10-21 02:14 │ s.jenkins@corp  │ USER_ROLE_UPDT │ User #491      │ 192.0.2.45      │
│ 2026-10-21 01:50 │ a.rivera@corp   │ PROJECT_DELETE │ Project #12    │ 198.51.100.22   │
│ 2026-10-20 22:10 │ SYSTEM_SCIM     │ USER_DEPROV    │ User #882      │ 10.0.4.1        │
└──────────────────┴─────────────────┴────────────────┴────────────────┴─────────────────┘
```

#### 4.8.1 System Audit Trail (`/audit-logs/events`)
- [ ] **Item/Action:** Load audit logs table.  
  - **Expected Behavior:** Displays chronological audit records with UTC timestamps, Actor name/email, Action verb (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `EXPORT`, `AUTH_FAILURE`), Entity Target, and Client IP.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor (`audit:read`).
- [ ] **Item/Action:** Filter audit logs by Action Type, Actor, or IP Address.  
  - **Expected Behavior:** Grid updates dynamically; handles complex filter combinations.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor.
- [ ] **Item/Action:** Expand audit log entry to inspect forensic JSON Diff.  
  - **Expected Behavior:** Slide-out or nested row reveals exact technical state changes: `before` JSON vs `after` JSON highlighted in red/green diff syntax; displays Actor User-Agent string and Session ID.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor.
- [ ] **Item/Action:** Verify Audit Log Immutability (Tamper-Resistance).  
  - **Expected Behavior:** Audit log interface provides **no edit, no delete, and no alter buttons** for any role (including Super Admin); backend rejects any HTTP `PUT`, `PATCH`, or `DELETE` methods sent to `/api/v1/audit-logs/*` with `405 Method Not Allowed`.  
  - **Permission Scope:** Security Boundary (SOC2 / ISO compliance).
- [ ] **Item/Action:** Export complete audit trail to CSV or JSON Lines (`.jsonl`).  
  - **Expected Behavior:** Dispatches asynchronous export job; for large datasets (>50,000 events), displays toast: "Export processing. You will receive an email download link when ready"; download link is cryptographically signed and expires in 1 hour.  
  - **Permission Scope:** Super Admin, Workspace Admin, Auditor (`audit:export`).

---

### 4.9 System & Organization Settings (`/settings`)

Tenant-level governance, authentication policies, domain verification, and data retention.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [⚙️ Organization Settings]                                                            │
│ [General]  [Single Sign-On (SSO)]  [Domain Verification]  [Security & IP]  [Compliance]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Single Sign-On (SAML 2.0 / OIDC)                                                       │
│ • SSO Status: [ENABLED - ENFORCED]                                                     │
│ • Identity Provider: Okta / Microsoft Entra ID                                         │
│ • Entity ID: https://auth.saasplatform.com/saml/metadata/org_991                       │
│ • ACS URL:   https://auth.saasplatform.com/saml/acs/org_991                            │
│ • Certificate: Expires in 314 days (Valid)                        [Upload New Cert]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.9.1 General Organization Profile (`/settings/general`)
- [ ] **Item/Action:** Edit Organization Legal Name and Contact Email.  
  - **Expected Behavior:** Input updates; persists to database; updates company name in invoices and system emails.  
  - **Permission Scope:** Super Admin, Workspace Admin (`settings:update`).
- [ ] **Item/Action:** Upload high-resolution Organization Logo.  
  - **Expected Behavior:** Validates file dimensions and formats (SVG/PNG); crops if needed; updates header logo and login branding.  
  - **Permission Scope:** Super Admin, Workspace Admin.
- [ ] **Item/Action:** Modify Organization URL Subdomain / Slug (`orgname.saasplatform.com`).  
  - **Expected Behavior:** Displays high-severity warning modal: "Changing your organization slug will break existing bookmarks and API endpoints. Old subdomain will redirect for 30 days"; verifies slug uniqueness.  
  - **Permission Scope:** Super Admin only (`tenant:slug_modify`).
- [ ] **Item/Action:** Delete Entire Organization (Tenant Destruction).  
  - **Expected Behavior:** Highest-severity destructive barrier: requires entering exact organization name, re-entering Super Admin password, and supplying 6-digit MFA token; initiates 30-day soft-delete grace period before permanent database wipe.  
  - **Permission Scope:** Super Admin only (`tenant:destroy`).

#### 4.9.2 Enterprise Single Sign-On (SSO / SAML 2.0 & SCIM) (`/settings/sso`)
- [ ] **Item/Action:** Upload IdP SAML Metadata XML file or enter SAML endpoints manually.  
  - **Expected Behavior:** Parses IdP Entity ID, Single Sign-On Service URL, and X.509 Signing Certificate; saves configuration; validates certificate format.  
  - **Permission Scope:** Super Admin (`sso:configure`).
- [ ] **Item/Action:** "Test SAML SSO Connection" button.  
  - **Expected Behavior:** Initiates IdP-initiated or SP-initiated test SAML flow in popup window; checks SAML response assertion attributes (`email`, `firstName`, `lastName`, `groups`); displays diagnostic success screen without locking existing users out.  
  - **Permission Scope:** Super Admin.
- [ ] **Item/Action:** Toggle "Enforce SAML SSO" (Prohibit password authentication).  
  - **Expected Behavior:** When enabled, standard username/password login forms are disabled for all non-admin users with matching verified domains; forces redirect to corporate IdP (Okta/Azure AD).  
  - **Permission Scope:** Super Admin only (`sso:enforce`).
- [ ] **Item/Action:** SCIM 2.0 Automated User Provisioning configuration.  
  - **Expected Behavior:** Generates unique SCIM Base URL (`/scim/v2/`) and secret Bearer Token; accepts SCIM requests to provision, update, and de-provision users directly from corporate directory.  
  - **Permission Scope:** Super Admin.

#### 4.9.3 Custom Domain Verification (`/settings/domains`)
- [ ] **Item/Action:** Add corporate custom domain (e.g., `app.company.com`).  
  - **Expected Behavior:** System generates unique DNS TXT verification record (e.g., `saas-verify=d89f02c1a...`) and CNAME record.  
  - **Permission Scope:** Super Admin (`domains:manage`).
- [ ] **Item/Action:** Click "Verify DNS Records" button.  
  - **Expected Behavior:** Backend queries DNS nameservers for TXT record; if present, domain status changes from "Pending Verification" to "Verified"; auto-provisions SSL/TLS certificate via Let's Encrypt / Cloudflare.  
  - **Permission Scope:** Super Admin.

#### 4.9.4 Security Policies, Session Timeouts & IP Allowlisting (`/settings/security`)
- [ ] **Item/Action:** Enforce Organization-wide 2FA / MFA.  
  - **Expected Behavior:** When toggled on, any user without 2FA configured is intercepted on next login with a mandatory MFA setup screen before accessing any workspace features.  
  - **Permission Scope:** Super Admin, Workspace Admin (`security_policy:update`).
- [ ] **Item/Action:** Configure Inactive Session Timeout (e.g., 15 minutes, 30 minutes, 2 hours).  
  - **Expected Behavior:** Client monitors user activity (keystrokes, mouse moves); after timeout window with zero activity, displays 60-second warning countdown modal; logs user out if no response.  
  - **Permission Scope:** Super Admin, Workspace Admin.
- [ ] **Item/Action:** IP Allowlist CIDR Range configuration (e.g., `203.0.113.0/24`).  
  - **Expected Behavior:** Accepts valid CIDR notations; rejects invalid IPs; when active, requests originating from non-whitelisted IPs are blocked with HTTP `403 IP Not Allowed`.  
  - **Permission Scope:** Super Admin (`security:ip_allowlist`).

---

## 5. Cross-Cutting Enterprise Architectural & Non-Functional QA

A production-grade checklist must validate cross-cutting architectural qualities including multi-tenancy isolation, token lifecycle, injection prevention, accessibility, and high concurrency.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CROSS-CUTTING QA VERIFICATION SUITE                                                   │
├─────────────────────┬─────────────────────┬─────────────────────┬──────────────────────┤
│ 1. Multi-Tenancy    │ 2. Token Security   │ 3. Injection Checks │ 4. Accessibility     │
│ IDOR & RLS Checks   │ JWT & Refresh Flow  │ XSS, SQLi & CSV     │ WCAG 2.1 AA Screen   │
└─────────────────────┴─────────────────────┴─────────────────────┴──────────────────────┘
```

### 5.1 Multi-Tenancy Isolation & IDOR (Insecure Direct Object Reference)
- [ ] **Item/Action:** Cross-Tenant Resource Access via Direct ID Manipulation (IDOR test).  
  - **Expected Behavior:** User from Organization A captures project ID from Organization B (`proj_orgB_8812`); attempts `GET /api/v1/projects/proj_orgB_8812`; backend Row-Level Security (RLS) catches missing tenant key; returns `404 Not Found` (preferred to avoid leaking entity existence) or `403 Forbidden`.  
  - **Permission Scope:** Multi-tenant zero-trust boundary.
- [ ] **Item/Action:** Multi-Tenant Database Query Isolation (RLS Verification).  
  - **Expected Behavior:** Every database query executed by backend ORM/SQL connection automatically attaches `tenant_id = current_tenant_id()`; verify by reviewing query traces in OpenTelemetry/Datadog.  
  - **Permission Scope:** Database Architecture.

---

### 5.2 Authentication, Session Security & Token Lifecycle
- [ ] **Item/Action:** JWT Signature Verification & Algorithm Confusion Attack (`alg: none`).  
  - **Expected Behavior:** Token validator rejects any token with `alg: none` or mismatched asymmetric algorithms (e.g., HMAC with public key); returns `401 Unauthorized`.  
  - **Permission Scope:** Security Core.
- [ ] **Item/Action:** Refresh Token Rotation (RTR) & Replay Attack Detection.  
  - **Expected Behavior:** When refresh token is submitted to `/api/v1/auth/refresh`, backend issues new access token AND new refresh token; if old refresh token is reused, system detects token theft, immediately invalidates entire token family, and forces re-authentication across all devices.  
  - **Permission Scope:** Authentication Engine.
- [ ] **Item/Action:** Cookie Security Attributes.  
  - **Expected Behavior:** Session cookies carry flags: `HttpOnly` (inaccessible to JavaScript `document.cookie`), `Secure` (transmitted only over HTTPS), and `SameSite=Lax` or `SameSite=Strict` (mitigates CSRF).  
  - **Permission Scope:** Transport Security.

---

### 5.3 Input Sanitization, XSS & Injection Boundaries
- [ ] **Item/Action:** Stored Cross-Site Scripting (XSS) in Task Title and Comment inputs.  
  - **Expected Behavior:** Inputting payloads such as `<script>alert(1)</script>`, `"><img src=x onerror=alert(document.cookie)>`, or `javascript:void(0)` is sanitized by DOMPurify / server-side encoders; renders as escaped plain text in DOM without executing script.  
  - **Permission Scope:** Application Security.
- [ ] **Item/Action:** CSV / Formula Injection (DDE Injection).  
  - **Expected Behavior:** Creating a task title beginning with `=SUM(1+1)`, `-2+3+cmd|' /C calc'!A0`, or `@` sanitizes exports: exported spreadsheet prepends single quote (`'=SUM(...)`) so spreadsheet software treats text as literal.  
  - **Permission Scope:** Data Egress Security.
- [ ] **Item/Action:** SQL / NoSQL Injection in Search and Filter queries.  
  - **Expected Behavior:** Inputting `' OR 1=1 --`, `admin'--`, or MongoDB operators `{"$gt": ""}` into search inputs causes no database syntax errors; queries execute via parameterized prepared statements.  
  - **Permission Scope:** Database Security.

---

### 5.4 Accessibility (WCAG 2.1 AA) & Keyboard Navigation
- [ ] **Item/Action:** Full Keyboard Navigation (No Mouse) throughout navigation tree.  
  - **Expected Behavior:** User can navigate sidebar, open modals, select tabs, and trigger actions using `Tab`, `Shift + Tab`, `Enter`, `Space`, and `Esc`; active elements display clear visual focus indicator (2px high-contrast ring).  
  - **Permission Scope:** Accessibility Compliance.
- [ ] **Item/Action:** Screen Reader Compatibility (NVDA / VoiceOver).  
  - **Expected Behavior:** Modals have `role="dialog"` and `aria-modal="true"`; dropdown menus have `aria-expanded` and `aria-haspopup`; form inputs have explicitly associated `<label>` tags and `aria-describedby` for error states.  
  - **Permission Scope:** WCAG 2.1 AA.
- [ ] **Item/Action:** Color Contrast Ratios across UI elements.  
  - **Expected Behavior:** Normal text maintains minimum contrast ratio of 4.5:1 against background; large text (18pt+) and UI controls maintain minimum 3:1 contrast ratio.  
  - **Permission Scope:** Visual Accessibility.

---

### 5.5 High Concurrency, WebSockets & Optimistic UI Resilience
- [ ] **Item/Action:** Concurrent Edit Collision Detection (Optimistic Concurrency Control).  
  - **Expected Behavior:** User A and User B open the same task description simultaneously; User A saves edits (version bumps from v1 to v2); User B attempts to save edits; system detects version conflict; displays conflict resolution modal ("Alice updated this task while you were editing. Review differences").  
  - **Permission Scope:** Concurrency Control.
- [ ] **Item/Action:** Network Disconnection & Reconnection Graceful Recovery.  
  - **Expected Behavior:** Disconnecting Wi-Fi displays discrete offline banner ("You are offline - Changes will sync when reconnected"); reconnecting network triggers automatic WebSocket reconnection and data re-validation via stale-while-revalidate (SWR).  
  - **Permission Scope:** Network Fault Tolerance.

---

## 6. Automated QA Test Suite Architecture & Sign-Off Criteria

To execute this production checklist efficiently, the QA Automation Engineer must deploy automated test coverage mapped to the testing pyramid:

```
                      /\
                     /  \
                    / E2E\        10% (Playwright / Cypress)
                   /------\
                  / Integr \      30% (Supertest / API / Contract Tests)
                 /----------\
                / Component  \    20% (React Testing Library / Storybook)
               /--------------\
              /   Unit Tests   \  40% (Vitest / Jest - RBAC Matrix & Logic)
             /──────────────────\
```

### 6.1 Quality Sign-Off Release Gates

Before promoting any release candidate to Production, the following criteria must be satisfied:

- [ ] **Unit & RBAC Matrix Tests:** 100% passing rate; zero regressions on role permission assertions.
- [ ] **API Security Integration Tests:** Automated regression tests verify that all endpoints return HTTP `403` for lower-clearance roles attempting unauthorized access.
- [ ] **End-to-End (E2E) Test Suite:** Critical user journeys (Onboarding, Task Creation, Plan Upgrades, SSO Login) pass cleanly across Chromium, Firefox, and WebKit engines.
- [ ] **Vulnerability Scanning:** Automated SAST (Static Application Security Testing) and dependency audit (Snyk / Dependabot) report 0 Critical and 0 High vulnerabilities.
- [ ] **Accessibility Audit:** Lighthouse / axe-core accessibility audit reports score ≥ 95 with zero critical WCAG AA violations.

---

*Checklist verified and ratified by Principal QA Automation Engineer & Enterprise Software Architect.*  
*Signed off for Production Quality Assurance Operations.*
