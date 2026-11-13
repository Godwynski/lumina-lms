import { after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createHmac } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { processCatalogImportChunk } from '@/lib/catalog-import-worker';

export function catalogWorkerToken() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Import worker is not configured.');
  return createHmac('sha256', key).update('catalog-import-worker-v1').digest('hex');
}

/** Bounded invocations continue a saved job without relying on an open browser tab. */
export function scheduleCatalogImport(continuation = false) {
  after(async () => {
    try {
      const client = createAdminClient();
      const { processed } = await processCatalogImportChunk(client);
      if (processed || continuation) for (const tag of ['catalog', 'books', 'public-books']) revalidateTag(tag, { expire: 0 });
      // Browser polling can wake a job, but must not spawn idle continuation chains.
      if (!processed && !continuation) return;
      const { count, error: activeError } = await client.from('catalog_import_items').select('id', { count: 'exact', head: true }).eq('status', 'processing').gt('lease_until', new Date().toISOString());
      if (activeError) throw new Error(activeError.message);
      if (!processed && count) return;
      const { data, error } = await client.from('catalog_import_items').select('next_attempt_at,lease_until,status').in('status', ['queued', 'retry', 'processing']).order('next_attempt_at').limit(1);
      if (error) throw new Error(error.message);
      if (!data?.length) return;
      const next = data[0];
      const readyAt = new Date(next.status === 'processing' ? next.lease_until : next.next_attempt_at).getTime();
      await new Promise(resolve => setTimeout(resolve, Math.min(10_000, Math.max(750, readyAt - Date.now()))));
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
      const base = host ? `https://${host}` : 'http://localhost:3000';
      const response = await fetch(`${base}/api/catalog/import-jobs/process`, { method: 'POST', headers: { Authorization: `Bearer ${catalogWorkerToken()}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Import continuation returned HTTP ${response.status}.`);
    } catch (error) {
      // A failed wake leaves saved items available for the next UI/cron invocation.
      console.error('Catalog import worker paused; saved progress can resume.', error instanceof Error ? error.message : 'Worker error');
    }
  });
}
