# Accessibility Guidelines & Standards

This document preserves UX and accessibility patterns and rules established for the application.

## Assessment status

The [11 November assessment](accessibility/2026-11-11-wcag-assessment.md) records remediation checks and their limits. Results apply to the tested revision and states. This guide defines contributor practices and does not establish full WCAG conformance.

## Accessible Hover Actions Pattern

### Context & Learning
Using `opacity-0 group-hover:opacity-100` on interactive elements (e.g., dropdown option triggers or quick-action buttons) makes them completely invisible/inaccessible on mobile/touch interfaces (since they have no hover capabilities) and to keyboard-only users tabbing through the page (since focus doesn't trigger parent group hover).

### Prescribed Actions & Rules
- **Mobile First / Touch Screens:** Keep triggers visible on devices without hover support (e.g., `opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100`).
- **Keyboard Navigation:** Ensure actions are exposed on keyboard focus via `focus-within:opacity-100` (for parent containers) or `focus-visible:opacity-100` (for direct buttons).
- **Focus Rings:** Always maintain clean, high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`).


## Forms and scanner workflows

Give fields persistent labels and connect hints and validation messages with aria-describedby. Keep scanner state and errors available to assistive technology. Use native buttons for camera controls and links for profile navigation.

When a wizard changes stages, move focus to a named stage container. When a dialog closes, restore focus to its opener. Preserve draft data when navigating Back and state the effects of Start over explicitly.

Check keyboard operation, visible focus, touch targets, zoom and narrow viewports, contrast in supported themes, and representative loading, error, and empty states. Record the revision and tested conditions with any accessibility claim.
