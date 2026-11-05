'use client';

import * as React from 'react';
import { memo, useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { FieldControlIdContext } from '@/components/ui/field-context';

export interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Id of the control. Generated when omitted; shared controls pick it up automatically. */
  htmlFor?: string;
}

export const FieldGroup = memo(({
  label,
  children,
  className,
  htmlFor,
}: FieldGroupProps) => {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={controlId} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <FieldControlIdContext.Provider value={controlId}>
        {children}
      </FieldControlIdContext.Provider>
    </div>
  );
});

FieldGroup.displayName = 'FieldGroup';
