import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

async function seedToday() {
  console.log('Seeding attendance for today (2026-10-28 Manila time)...');

  // Verify no open sessions exist for these users
  const userIds = [
    'f1d742df-ca66-4ac8-a4e2-7369c1dc4460', // Godwyn Neri
    '5e674c6d-cf73-4b78-a2e9-9f32f9553511', // Jerico Dadea
    '486205e4-1fad-421c-8946-fdd0da5217bf', // Kenneth James Tolentino
    '00000000-0000-0000-0000-000000000006', // Kayle Floriano
    '31afd312-7272-413a-892a-a67be05caf10', // Rhed Resurreccion
    '31a98d40-ad47-4593-aee1-b62ff387153d', // Kayle Andrew Floriano
    '00000000-0000-0000-0000-000000000005', // Lumina Staff
    '00000000-0000-0000-0000-000000000002', // Lumina Librarian
  ];

  // Close any stale active sessions for these users if any
  const { error: closeErr } = await supabase
    .from('attendance')
    .update({ check_out_at: '2026-10-28T11:00:00+08:00' })
    .in('user_id', userIds)
    .is('check_out_at', null);

  if (closeErr) console.warn('Warning closing stale sessions:', closeErr);

  const sampleRecords = [
    // 3 Active sessions currently inside the library (check_out_at is null)
    {
      user_id: 'f1d742df-ca66-4ac8-a4e2-7369c1dc4460', // Godwyn Neri
      check_in_at: '2026-10-28T18:15:00+08:00',
      check_out_at: null,
      notes: 'Thesis research & system testing'
    },
    {
      user_id: '5e674c6d-cf73-4b78-a2e9-9f32f9553511', // Jerico Dadea
      check_in_at: '2026-10-28T18:45:00+08:00',
      check_out_at: null,
      notes: 'Circulation & inventory duty'
    },
    {
      user_id: '486205e4-1fad-421c-8946-fdd0da5217bf', // Kenneth James Tolentino
      check_in_at: '2026-10-28T19:10:00+08:00',
      check_out_at: null,
      notes: 'Reading reference textbooks'
    },

    // 5 Completed sessions earlier today
    {
      user_id: '00000000-0000-0000-0000-000000000006', // Kayle Floriano
      check_in_at: '2026-10-28T08:30:00+08:00',
      check_out_at: '2026-10-28T11:45:00+08:00',
      notes: 'Capstone mock testing'
    },
    {
      user_id: '31afd312-7272-413a-892a-a67be05caf10', // Rhed Resurreccion
      check_in_at: '2026-10-28T09:15:00+08:00',
      check_out_at: '2026-10-28T12:30:00+08:00',
      notes: 'Literature study session'
    },
    {
      user_id: '31a98d40-ad47-4593-aee1-b62ff387153d', // Kayle Andrew Floriano
      check_in_at: '2026-10-28T13:00:00+08:00',
      check_out_at: '2026-10-28T16:30:00+08:00',
      notes: 'Web development team meeting'
    },
    {
      user_id: '00000000-0000-0000-0000-000000000005', // Lumina Staff
      check_in_at: '2026-10-28T10:00:00+08:00',
      check_out_at: '2026-10-28T14:00:00+08:00',
      notes: 'Catalog shelving and check-ins'
    },
    {
      user_id: '00000000-0000-0000-0000-000000000002', // Lumina Librarian
      check_in_at: '2026-10-28T08:00:00+08:00',
      check_out_at: '2026-10-28T17:00:00+08:00',
      notes: 'Library supervision & administrative work'
    }
  ];

  const { data: inserted, error: insertErr } = await supabase
    .from('attendance')
    .insert(sampleRecords)
    .select('id, user_id, check_in_at, check_out_at');

  if (insertErr) {
    console.error('Failed to insert sample attendance records:', insertErr);
    process.exit(1);
  }

  console.log(`Successfully seeded ${inserted.length} attendance records for today!`);
}

seedToday().catch(console.error);
