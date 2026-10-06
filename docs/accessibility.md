# Accessibility Guidelines & Standards

This document preserves UX and accessibility patterns and rules established for the application.

## Accessible Hover Actions Pattern

### Context & Learning
Using `opacity-0 group-hover:opacity-100` on interactive elements (e.g., dropdown option triggers or quick-action buttons) makes them completely invisible/inaccessible on mobile/touch interfaces (since they have no hover capabilities) and to keyboard-only users tabbing through the page (since focus doesn't trigger parent group hover).

### Prescribed Actions & Rules
- **Mobile First / Touch Screens:** Always make action triggers visible by default on mobile (e.g., `opacity-100 sm:opacity-0 group-hover:opacity-100`).
- **Keyboard Navigation:** Ensure actions are exposed on keyboard focus via `focus-within:opacity-100` (for parent containers) or `focus-visible:opacity-100` (for direct buttons).
- **Focus Rings:** Always maintain clean, high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`).
