import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthApi } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { scheduleCatalogImport } from '@/lib/catalog-import-scheduler';

export const maxDuration = 60;
const options = { allowedRoles: ['super_admin', 'librarian'] as ('super_admin' | 'librarian')[] };
const inputSchema = z.union([
  z.object({ retryJobId: z.string().uuid() }),
  z.object({ isbns: z.array(z.string().transform(s => s.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^(?:\d{9}[\dX]|\d{13})$/, 'Use complete ISBN-10 or ISBN-13 values.'))).min(1).max(500), requestId: z.string().uuid().optional() }),
]);

export const GET = withAuthApi(async (_request, { supabase }) => {
  const { data, error } = await supabase.from('catalog_import_jobs').select('id,label,created_at').order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  const jobs = await Promise.all((data || []).map(async job => {
    const result = await supabase.from('catalog_import_items').select('id,isbn,book_id,status,metadata_status,cover_status,attempts,error,title,next_attempt_at').eq('job_id', job.id).order('created_at').limit(500);
    if (result.error) throw new Error(result.error.message);
    return { ...job, items: result.data || [] };
  }));
  return NextResponse.json({ jobs });
}, options);

export const POST = withAuthApi(async (request, { user, profile }) => {
  if (profile.status?.toUpperCase() !== 'ACTIVE') return NextResponse.json({ error: 'Active staff access required.' }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Invalid import request.' }, { status: 400 }); }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid import request.' }, { status: 400 });
  const client = createAdminClient();
  const body = parsed.data;
  if ('retryJobId' in body) {
    const { error } = await client.from('catalog_import_items').update({ status: 'queued', attempts: 0, error: null, lease: null, lease_until: null, next_attempt_at: new Date().toISOString() }).eq('job_id', body.retryJobId).in('status', ['review', 'failed']);
    if (error) throw new Error(error.message);
    scheduleCatalogImport();
    return NextResponse.json({ jobId: body.retryJobId });
  }
  const quantities = new Map<string, number>();
  for (const isbn of body.isbns) quantities.set(isbn, (quantities.get(isbn) || 0) + 1);
  if ([...quantities.values()].some(n => n > 50)) return NextResponse.json({ error: 'Maximum 50 copies per ISBN in one job.' }, { status: 400 });
  const jobId = body.requestId || crypto.randomUUID();
  const { error } = await client.rpc('catalog_import_enqueue', { p_job: jobId, p_actor: user.id, p_label: `ISBN import (${body.isbns.length} copies)`, p_items: [...quantities].map(([isbn, requested_copies]) => ({ isbn, requested_copies, mode: 'create' })) });
  if (error) throw new Error(error.message);
  scheduleCatalogImport();
  return NextResponse.json({ jobId }, { status: 201 });
}, options);
