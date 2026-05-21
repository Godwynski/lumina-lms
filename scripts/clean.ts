import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Define profiles/users we expect in the DB for demo access
const profileIds = {
  godwynStudent: 'f1d742df-ca66-4ac8-a4e2-7369c1dc4460',
  kayleStudent: '00000000-0000-0000-0000-000000000006',
  jericoSA: '5e674c6d-cf73-4b78-a2e9-9f32f9553511',
  luminaSA: '00000000-0000-0000-0000-000000000005',
  rhedLibrarian: '31afd312-7272-413a-892a-a67be05caf10',
  luminaLibrarian: '00000000-0000-0000-0000-000000000002',
  kennethAdmin: '486205e4-1fad-421c-8946-fdd0da5217bf',
  luminaSuperAdmin: '00000000-0000-0000-0000-000000000008',
  luminaAdmin: '00000000-0000-0000-0000-000000000001',
};

async function clean() {
  console.info('🧹 Cleaning up database tables in dependency order...');
  
  try {
    await supabase.from('checklist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('checklist_dropdown_options').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('borrowing_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('checkout_idempotency').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('return_idempotency').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Preserve library cards that belong to the demo profiles
    await supabase.from('library_cards').delete().not('user_id', 'in', `(${Object.values(profileIds).join(',')})`);
    
    await supabase.from('book_copies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('books').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.info('✨ Database cleanup completed successfully! (Preserved demo library cards)');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  }
}

clean();
