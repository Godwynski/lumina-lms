'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup } from '@/components/common/FieldGroup';
import { CopyAcquisitionFields, CopyLifecycleSelect } from '@/components/catalog/CopyAcquisitionFields';
import { recordCopyDisposition, updateCopyAcquisition } from '@/lib/actions/catalog';
import { copyAcquisitionSchema, copyDispositionSchema, libraryDate, type CopyAcquisition } from '@/lib/copy-acquisition';
import type { BookCopyWithReservation } from '@/lib/types';

const DISPOSITION_LABELS = { SOLD: 'Sold', DONATED_OUT: 'Donated out', LOST: 'Lost' } as const;
type Disposition = keyof typeof DISPOSITION_LABELS;

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });
const PRICE_FORMAT = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function dateReadout(value: string | null | undefined) {
  return value ? DATE_FORMAT.format(new Date(`${value}T00:00:00Z`)) : 'Unknown';
}

function acquisitionFromCopy(copy: BookCopyWithReservation): CopyAcquisition {
  return {
    method: copy.lifecycle?.acquisition_method ?? null,
    acquiredOn: copy.lifecycle?.acquired_on ?? null,
    purchasePrice: copy.lifecycle?.purchase_price?.toString() ?? null,
  };
}

function dispositionOptions(copy: BookCopyWithReservation): Disposition[] {
  switch (copy.status) {
    case 'AVAILABLE':
    case 'MAINTENANCE':
      return ['SOLD', 'DONATED_OUT', 'LOST'];
    case 'BORROWED':
      return ['LOST'];
    case 'LOST':
      return copy.lifecycle?.last_lost_on ? [] : ['LOST'];
    default:
      return [];
  }
}

interface CopyDetailsProps {
  copy: BookCopyWithReservation;
  canManage: boolean;
  reportLost?: boolean;
  onSaved: (message: string) => Promise<void>;
}

export function CopyDetails({ copy, canManage, reportLost, onSaved }: CopyDetailsProps) {
  const [mode, setMode] = useState<'acquisition' | 'disposition' | null>(reportLost ? 'disposition' : null);
  const [acquisition, setAcquisition] = useState(() => acquisitionFromCopy(copy));
  const [status, setStatus] = useState<Disposition | ''>(reportLost ? 'LOST' : '');
  const [date, setDate] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedAcquisition = acquisitionFromCopy(copy);
  const acquisitionLabel = savedAcquisition.method === 'PURCHASED' ? 'Bought' : savedAcquisition.method === 'DONATED' ? 'Donated' : 'Unknown';
  const lifecycle = copy.lifecycle;
  const isDisposed = copy.status === 'SOLD' || copy.status === 'DONATED_OUT';
  const options = canManage ? dispositionOptions(copy) : [];
  const editingAcquisition = canManage && mode === 'acquisition';
  const recordingDisposition = options.length > 0 && mode === 'disposition';

  function startRecording() {
    setStatus(options.length === 1 ? options[0] : '');
    setDate('');
    setSaleAmount('');
    setError(null);
    setMode('disposition');
  }

  function closeForm() {
    setError(null);
    setMode(null);
  }

  async function saveAcquisition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAcquisition || busy) return;
    const validation = copyAcquisitionSchema.safeParse(acquisition);
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateCopyAcquisition({ id: copy.id, acquisition });
      if (!result.success) throw new Error(result.error);
      closeForm();
      await onSaved('Acquisition details saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save acquisition details.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDisposition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recordingDisposition || busy) return;
    if (!status || !options.includes(status)) {
      setError('Choose the new status.');
      return;
    }
    if (!date) {
      setError('Enter the date of change.');
      return;
    }
    if (status === 'SOLD' && !saleAmount) {
      setError('Enter the sale amount.');
      return;
    }
    const change = { id: copy.id, status, occurredOn: date, ...(status === 'SOLD' ? { saleAmount } : {}) };
    const validation = copyDispositionSchema.safeParse(change);
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await recordCopyDisposition(change);
      if (!result.success) throw new Error(result.error);
      closeForm();
      await onSaved(`Copy status recorded as ${DISPOSITION_LABELS[status]}.${result.data?.queueWaiting ? ' A reservation is still waiting.' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the copy status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 space-y-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Acquisition</h4>
        {canManage && !editingAcquisition && (
          <Button type="button" variant="outline" size="sm" disabled={busy || recordingDisposition} onClick={() => {
            setAcquisition(acquisitionFromCopy(copy));
            setMode('acquisition');
            setError(null);
          }}>
            Edit acquisition
          </Button>
        )}
      </div>

      {editingAcquisition ? (
        <form noValidate onSubmit={saveAcquisition} className="space-y-3">
          <CopyAcquisitionFields value={acquisition} onChange={(value) => { setAcquisition(value); setError(null); }} disabled={busy} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save acquisition'}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={closeForm} disabled={busy}>Cancel</Button>
          </div>
        </form>
      ) : savedAcquisition.method || savedAcquisition.acquiredOn || savedAcquisition.purchasePrice !== null ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Method</dt><dd>{acquisitionLabel}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Acquisition date</dt><dd>{dateReadout(savedAcquisition.acquiredOn)}</dd></div>
          {savedAcquisition.method === 'PURCHASED' && (
            <div><dt className="text-xs text-muted-foreground">Price per copy</dt><dd className="tabular-nums">{lifecycle?.purchase_price == null ? 'Unknown' : PRICE_FORMAT.format(lifecycle.purchase_price)}</dd></div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No acquisition details recorded.</p>
      )}

      {(isDisposed || lifecycle?.last_lost_on) && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {isDisposed && <div><dt className="text-xs text-muted-foreground">{copy.status === 'SOLD' ? 'Sold on' : 'Donated out on'}</dt><dd>{dateReadout(lifecycle?.disposition_on)}</dd></div>}
          {copy.status === 'SOLD' && <div><dt className="text-xs text-muted-foreground">Sale amount</dt><dd className="tabular-nums">{lifecycle?.sale_amount == null ? 'Unknown' : PRICE_FORMAT.format(lifecycle.sale_amount)}</dd></div>}
          {lifecycle?.last_lost_on && <div><dt className="text-xs text-muted-foreground">Last reported lost</dt><dd>{dateReadout(lifecycle.last_lost_on)}</dd></div>}
        </dl>
      )}

      {options.length > 0 && (
        <div className="border-t border-border/60 pt-3">
          {recordingDisposition ? (
            <form noValidate onSubmit={saveDisposition} className="space-y-3">
              <h4 className="text-sm font-semibold">Record change</h4>
              <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldGroup label="New status">
                  <CopyLifecycleSelect value={status} required onChange={(event) => {
                    const value = event.target.value as Disposition | '';
                    setStatus(value);
                    if (value !== 'SOLD') setSaleAmount('');
                    setError(null);
                  }}>
                    {options.length > 1 && <option value="">Select status</option>}
                    {options.map((option) => <option key={option} value={option}>{DISPOSITION_LABELS[option]}</option>)}
                  </CopyLifecycleSelect>
                </FieldGroup>
                <FieldGroup label="Date of change">
                  <Input type="date" max={libraryDate()} required className="h-9 min-w-0" value={date} onChange={(event) => { setDate(event.target.value); setError(null); }} />
                </FieldGroup>
                {status === 'SOLD' && <FieldGroup label="Sale amount (₱)">
                  <Input type="number" inputMode="decimal" min={0} step="0.01" required className="h-9" value={saleAmount} onChange={(event) => { setSaleAmount(event.target.value); setError(null); }} />
                </FieldGroup>}
              </fieldset>
              {status && <p className="text-xs text-muted-foreground">{copy.status === 'LOST' ? 'This adds the date to the existing loss record.' : `This copy will be marked ${DISPOSITION_LABELS[status].toLowerCase()}.`}</p>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={busy}>{busy ? 'Recording…' : 'Confirm change'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={closeForm} disabled={busy}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={startRecording} disabled={busy || editingAcquisition}>Record change</Button>
          )}
        </div>
      )}
    </div>
  );
}
