'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';

export interface AuditOption { id: string; label: string; description: string }
const fetchOptions = async (url: string): Promise<{ options: AuditOption[] }> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load choices. Reopen to retry.');
  return response.json();
};

export function AuditSubjectChip({ kind, label, value, bookId, onRemove }: { kind: string; label: string; value: string; bookId?: string; onRemove: () => void }) {
  const { data } = useSWR(`/api/admin/audit-logs/options?kind=${kind}&id=${value}${bookId ? `&bookId=${bookId}` : ''}`, fetchOptions);
  const option = data?.options[0];
  return <button type="button" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()} filter`} title={option?.description} className="max-w-full rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-left text-xs hover:bg-muted/60">
    <span className="font-semibold">{label}: </span>{option ? `${option.label}${kind === 'student' && option.description ? ` · ${option.description.split(' · ')[0]}` : ''}` : 'Selected record'} <span aria-hidden="true">×</span>
  </button>;
}

export function AuditSubjectFilter({ kind, label, value, bookId, onChange }: {
  kind: 'book' | 'student' | 'actor' | 'copy'; label: string; value: string;
  bookId?: string; onChange: (option: AuditOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!details.current?.contains(event.target as Node) && details.current) details.current.open = false; };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  useEffect(() => { const timer = setTimeout(() => setTerm(search), 250); return () => clearTimeout(timer); }, [search]);
  const base = `/api/admin/audit-logs/options?kind=${kind}${bookId ? `&bookId=${bookId}` : ''}`;
  const { data: selected } = useSWR(value ? `${base}&id=${value}` : null, fetchOptions);
  const { data, error, isLoading } = useSWR(open ? `${base}&query=${encodeURIComponent(term)}` : null, fetchOptions);
  return (
    <details ref={details} onToggle={event => setOpen(event.currentTarget.open)} className="relative min-w-0" onKeyDown={event => { if (event.key === 'Escape' && details.current) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}>
      <summary className="cursor-pointer rounded-xl border border-border/30 bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
        <span className="text-muted-foreground">{label}: </span><span>{selected?.options[0]?.label || (value ? 'Selected record' : 'All')}</span>
      </summary>
      {open && <div className="mt-2 w-full rounded-xl border bg-popover p-2 text-popover-foreground">
        <Input autoFocus aria-label={`Search ${label.toLowerCase()}`} placeholder={kind === 'book' ? 'Title, ISBN, or barcode…' : kind === 'copy' ? 'Barcode or accession…' : 'Name, ID, or email…'} value={search} onChange={event => setSearch(event.target.value)} />
        <div className="mt-2 max-h-64 overflow-y-auto" aria-label={`${label} choices`}>
          <button type="button" className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent" onClick={() => { onChange(null); if (details.current) details.current.open = false; }}>Clear {label.toLowerCase()} selection</button>
          {isLoading && <p role="status" className="p-2 text-sm text-muted-foreground">Loading choices…</p>}
          {error && <p role="alert" className="p-2 text-sm text-destructive">{error.message}</p>}
          {data?.options.map(option => <button type="button" key={option.id} aria-pressed={value === option.id} className="block w-full rounded-md p-2 text-left hover:bg-accent focus-visible:bg-accent" onClick={() => { onChange(option); if (details.current) details.current.open = false; }}>
            <span className="block text-sm font-medium">{option.label}</span><span className="block break-words text-xs text-muted-foreground">{option.description}</span>
          </button>)}
          {data?.options.length === 0 && <p className="p-2 text-sm text-muted-foreground">No matches. Try another name or identifier.</p>}
          {(data?.options.length || 0) >= 20 && <p className="p-2 text-xs text-muted-foreground">Showing the first 20. Type more to narrow the choices.</p>}
        </div>
      </div>}
    </details>
  );
}
