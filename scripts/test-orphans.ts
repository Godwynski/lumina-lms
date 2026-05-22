import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphans() {
  const { data: copies, error } = await supabase
    .from('book_copies')
    .select(`
      id, 
      qr_string, 
      status, 
      borrowing_records(id, status)
    `)
    .eq('status', 'BORROWED');

  if (error) {
    console.error(error);
    return;
  }

  const orphans = copies.filter(c => !c.borrowing_records.some(r => r.status === 'ACTIVE' || r.status === 'OVERDUE'));

  console.log(`Found ${copies.length} borrowed copies. ${orphans.length} are orphans.`);
  if (orphans.length > 0) {
    console.log(JSON.stringify(orphans, null, 2));
  }
}

checkOrphans();
