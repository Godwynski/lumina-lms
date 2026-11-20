'use client';

import { useId, useState, type ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFieldControlId } from '@/components/ui/field-context';
import { FieldGroup } from '@/components/common/FieldGroup';
import { libraryDate, type CopyAcquisition } from '@/lib/copy-acquisition';
import { cn } from '@/lib/utils';

export const EMPTY_ACQUISITION: CopyAcquisition = { method: null, acquiredOn: null, purchasePrice: null };

export function CopyLifecycleSelect({ id, className, ...props }: ComponentProps<'select'>) {
  const controlId = useFieldControlId(id);
  return (
    <div className="relative">
      <select
        id={controlId}
        className={cn('h-11 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50', className)}
        {...props}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

interface AcquisitionFieldsProps {
  value: CopyAcquisition;
  onChange: (value: CopyAcquisition) => void;
  disabled?: boolean;
}

export function CopyAcquisitionFields({ value, onChange, disabled }: AcquisitionFieldsProps) {
  return (
    <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      <FieldGroup label="Acquisition method">
        <CopyLifecycleSelect value={value.method ?? ''} onChange={(event) => {
          const method = event.target.value === 'PURCHASED' ? 'PURCHASED' : event.target.value === 'DONATED' ? 'DONATED' : null;
          onChange({ ...value, method, purchasePrice: method === 'PURCHASED' ? value.purchasePrice : null });
        }}>
          <option value="">Unknown</option>
          <option value="PURCHASED">Bought</option>
          <option value="DONATED">Donated</option>
        </CopyLifecycleSelect>
      </FieldGroup>
      <FieldGroup label="Acquisition date">
        <Input type="date" max={libraryDate()} className="h-11 min-w-0" value={value.acquiredOn ?? ''} onChange={(event) => onChange({ ...value, acquiredOn: event.target.value || null })} />
      </FieldGroup>
      {value.method === 'PURCHASED' && (
        <FieldGroup label="Price per copy (₱)">
          <Input type="number" inputMode="decimal" min={0} step="0.01" className="h-11" value={value.purchasePrice ?? ''} onChange={(event) => onChange({ ...value, purchasePrice: event.target.value || null })} />
        </FieldGroup>
      )}
    </fieldset>
  );
}

export function OptionalCopyAcquisition(props: AcquisitionFieldsProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 px-0 text-sm font-medium hover:bg-transparent hover:text-primary"
        aria-label="Acquisition details"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(!open)}
      >
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        Acquisition details
        <span className="text-xs font-normal text-muted-foreground">Optional</span>
      </Button>
      <div id={detailsId} hidden={!open}>
        {open && (
          <div className="space-y-3 pb-1 pt-1">
            <p className="text-xs text-muted-foreground">These details apply to each copy in this batch.</p>
            <CopyAcquisitionFields {...props} />
          </div>
        )}
      </div>
    </div>
  );
}
