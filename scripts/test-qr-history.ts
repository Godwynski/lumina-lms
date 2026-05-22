import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: copy } = await supabase.from('book_copies').select('id, status').eq('qr_string', 'QR-2239').single();
  console.log('Copy:', copy);
  
  if (copy) {
    const { data: records } = await supabase.from('borrowing_records').select('*').eq('book_copy_id', copy.id);
    console.log('Records:', records);
  }
}
run();
