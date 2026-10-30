import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Define all profiles/users in the database
export const profileIds = {
  godwynStudent: 'f1d742df-ca66-4ac8-a4e2-7369c1dc4460', // Godwyn Neri (STU-376375)
  calinogStudent: '36d142ea-ade7-4f20-9095-80373b63f67c', // Josh Raizen Calinog (STU-190782)
  kayleStudent: '31a98d40-ad47-4593-aee1-b62ff387153d', // Kayle Andrew Floriano (STU-376536)
  kaylePersonal: 'ed6532f0-0a72-4689-8a87-6080a289d3b8', // Kayle Floriano Personal (STU-826019)
  jericoSA: '5e674c6d-cf73-4b78-a2e9-9f32f9553511', // Jerico Dadea (STU-368330)
  kennethStudent: '486205e4-1fad-421c-8946-fdd0da5217bf', // Kenneth James Tolentino (STU-351534)
  rhedStudent: '31afd312-7272-413a-892a-a67be05caf10', // Rhed Resurreccion (STU-357161)
  baybayLibrarian: '769c24e8-098a-464e-b304-b42049da60fa', // John Renaund Baybay (FAC-982441)
  luminaAdmin: '00000000-0000-0000-0000-000000000001', // Lumina Admin (FAC-ADM-001)
  luminaLibrarian: '00000000-0000-0000-0000-000000000002', // Lumina Librarian (FAC-LIB-001)
  luminaSA: '00000000-0000-0000-0000-000000000005', // Lumina Staff (FAC-STF-001)
  demoStudent: '00000000-0000-0000-0000-000000000006', // Demo Student Patron (STU-001)
  luminaSuperAdmin: '00000000-0000-0000-0000-000000000008', // Lumina Super Admin (FAC-SAD-001)
};

async function clean() {
  console.info('🧹 Cleaning up database tables in dependency order...');
  
  try {
    await supabase.from('rate_limit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('deleted_profile_info').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('ui_preferences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
    
    // Preserve library cards that belong to the real profiles
    await supabase.from('library_cards').delete().not('user_id', 'in', `(${Object.values(profileIds).join(',')})`);
    
    await supabase.from('book_copies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('books').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.info('✨ Database cleanup completed successfully! (Preserved all user profiles and cards)');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  }
}

clean();
