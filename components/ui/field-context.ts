import * as React from "react";

/**
 * Set by FieldGroup. Shared form controls (Input, Textarea, SelectTrigger) use
 * it as their id when none is passed, so the group's visible <Label htmlFor>
 * points at the control and gives it an accessible name.
 */
export const FieldControlIdContext = React.createContext<string | undefined>(undefined);

export function useFieldControlId(explicitId?: string) {
  const contextId = React.useContext(FieldControlIdContext);
  return explicitId ?? contextId;
}
