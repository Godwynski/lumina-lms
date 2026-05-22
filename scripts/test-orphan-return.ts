import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: result, error } = await supabase.rpc('process_qr_return', {
    p_librarian_id: '00000000-0000-0000-0000-000000000000', // random uuid
    p_book_qr: 'QR-2239',
    p_preview_only: false
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', result);
  }

  // check new status
  const { data: copy } = await supabase.from('book_copies').select('status').eq('qr_string', 'QR-2239').single();
  console.log('New Copy Status:', copy?.status);
}
run();
