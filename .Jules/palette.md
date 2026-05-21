# Palette's Journal

Critical UX/accessibility learnings only.

## 2026-05-21 - Accessible Hover Actions Pattern
**Learning:** Using `opacity-0 group-hover:opacity-100` on interactive elements (e.g., dropdown option triggers or quick-action buttons) makes them completely invisible/inaccessible on mobile/touch interfaces (since they have no hover capabilities) and to keyboard-only users tabbing through the page (since focus doesn't trigger parent group hover).
**Action:** Always make action triggers visible by default on mobile (e.g., `opacity-100 sm:opacity-0 group-hover:opacity-100`) and ensure they are exposed on keyboard focus via `focus-within:opacity-100` (for parent containers) or `focus-visible:opacity-100` (for direct buttons) along with clean focus rings.


