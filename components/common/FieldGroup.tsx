'use client';

import * as React from 'react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const FieldGroup = memo(({ 
  label, 
  children,
  className 
}: FieldGroupProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
});

FieldGroup.displayName = 'FieldGroup';
