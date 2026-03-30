# UI Cleanup & Technical Debt Roadmap

This document outlines all currently identified UI problems, technical debt, and layout responsiveness issues across the system, focusing specifically on mobile unresponsiveness and hardcoded non-compliant styles.

## 1. Mobile Unresponsiveness (Fixed Widths & Overflows)
Several core components and pages apply fixed width constraints that break on mobile viewports (causing horizontal scrolling or layout shifts).
- **Hardcoded Widths**: Components like `ViolationsClient`, `AuditLogClient`, `DashboardSearch`, and `ModernInventoryClient` use rigid desktop widths (`w-64`, `w-72`, `w-80`, `w-96`, `w-[...px]`).
  - *Fix*: Replace with fluid, responsive widths (`w-full md:w-64` or `w-full max-w-sm`).
- **Table Viewport Breaking**: `<Table>` elements (e.g., in `AuditLogClient.tsx` and catalog displays) lack mobile scroll constraint wrappers.
  - *Fix*: Encapsulate all native/custom tables inside a `<div className="overflow-x-auto w-full">` wrapper.
- **Mobile Sidebars**: Ensure `components/ui/sidebar.tsx` supports graceful collapsing (hamburger toggle) and doesn't overlap or push primary container content off-screen on `< md` devices.

## 2. Inefficient Spacing on Smaller Viewports
The overuse of large static padding causes massive white-space waste on mobile phones, limiting readable content area.
- **Static Paddings**: Pages such as `app/admin/page.tsx`, `auth/sign-up-success/page.tsx`, and `app/protected/catalog/add/page.tsx` use hardcoded `p-6` or `p-8` classes on their main containers. 
  - *Fix*: Use responsive padding scales `p-4 sm:p-6 md:p-8` to reclaim screen real estate on mobile devices.

## 3. Dark Mode Inconsistencies (Hardcoded Light Variables)
Despite previous migrations, several areas still hardcode static light-mode values, resulting in UI bugs (blinding whites or invisible text) when flipped to Dark Theme.
- **Rogue Colors**: Components such as `ui/slider.tsx`, `ui/empty-state.tsx`, `hero.tsx`, and `RecomputeExpiryDates.tsx` contain direct usage of `bg-white`, `border-gray-200`, and `text-black`.
  - *Fix*: strictly replace these with semantic tokens: `bg-background`, `bg-card`, `text-foreground`, and `border-border`.

## 4. Modal and Dialog Responsiveness
Popup experiences are breaking on shorter mobile viewports (e.g., old iPhones, landscape orientation).
- **Out of Bounds Elements**: `SelfDeleteAccountDialog.tsx`, `RecordViolationModal.tsx`, and `qr-printer-modal.tsx` can push primary Call-To-Action (CTA) buttons below the fold on small screens because they lack max-height capping.
  - *Fix*: Add `max-h-[90vh] sm:max-h-[85vh]` along with `overflow-y-auto` to the internal body of these dialogs so users can always scroll down to the "Save" or "Cancel" buttons.

## 5. Interactive Polish & Accessibility
Minor interactive UX misses that hurt perceived quality and usability across devices.
- **Focus Rings Missing**: Some interactive elements lack `focus-visible:ring-2` focus states, which hurts navigation for keyboard/screen-reader users.
- **Touch Targets**: Some icons or links on mobile lack `min-h-[44px] min-w-[44px]`, creating frustrating tap experiences. 

## 6. Sidebar & Navigation Technical Debt (`ProtectedNav.tsx` & `sidebar.tsx`)
A comprehensive audit of the navigation architecture reveals severe scalability, performance, and accessibility flaws that warrant immediate remediation.

- **Constant Layout Re-renders**: `usePathname()` and `useSearchParams()` trigger a full re-render of the entire navigation on every route/param change. Complex derivations (like `openGroups`, `filteredGroups`, and nested loops calculating `isActive`) run inline without robust memoization, causing micro-stutters during client-side navigation.
  - *Fix*: Memoize route matching and use derived state or `useMemo` for group expansions to prevent complete component hydration loops.
- **Desynced Active State Bugs**: `openGroups` is initialized via `useState()` evaluating the path once on mount. If a user navigates to a new section from outside the sidebar (e.g., clicking a dashboard card), `openGroups` fails to update and leaves the newly active section collapsed.
  - *Fix*: Synchronize `openGroups` dynamically using `useEffect` tied to `pathname` or purely derived state computations.
- **Heavy Client Payload Cache (Framer Motion)**: `ProtectedNav.tsx` loads global animation frameworks (`framer-motion`) on top of Radix primitives and 14+ `lucide-react` icons. This balloons the global layout bundle unnecessarily.
  - *Fix*: Remove `framer-motion` and utilize native Radix `CollapsibleContent` CSS-based animations (`--radix-collapsible-content-height`).
- **Broken Screen Reader Accessibility**: `ProtectedNav.tsx` uses custom `<motion.div>` animations instead of the mandatory Radix `<CollapsibleContent>`. Without `CollapsibleContent`, Radix cannot link the `aria-controls` attribute, rendering every dropdown inaccessible to screen readers.
- **Hardcoded RBAC Limitations**: `NAV_GROUPS` validates visibility against hardcoded string arrays (`roles: ["admin", "librarian", "staff", "student"]`).
  - *Fix*: Transition to a centralized policy validator or integer-based bitmasks (`role >= ROLE_LIBRARIAN`) for scalable permission architecture.
- **Duplicate Navigation Loops**: The "Settings" menu group does not use the dynamic `NAV_GROUPS` configuration. Instead, it fully duplicates the `Collapsible` rendering mapped inline specifically for Settings, violating DRY principles and risking diverging UI synchronization.

---
_**Action Plan:** Address these incrementally per component. Test using Chrome DevTools Device Mode (specifically set to narrower devices like iPhone SE/12 Pro to capture 320px-390px edge cases)._
