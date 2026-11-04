import type { SupabaseClient } from '@supabase/supabase-js';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'];

// clean/seed delete whole tables. Refuse unless the target is a local database,
// or the caller passes --yes-really (e.g. `npm run seed -- --yes-really`).
export function assertSafeTarget(supabaseUrl: string) {
  let host = supabaseUrl;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    // Not a URL: treat as remote.
  }
  if (LOCAL_HOSTS.includes(host) || process.argv.includes('--yes-really')) return;
  console.error(`Refusing to wipe "${host}": it is not a local database.`);
  console.error('If you really mean to delete its data, re-run with: -- --yes-really');
  process.exit(1);
}

// Deletes every row of a table and stops on the first error.
export async function clearTable(supabase: SupabaseClient, table: string) {
  const { error } = await supabase.from(table).delete().neq('id', NIL_UUID);
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}
