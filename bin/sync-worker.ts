import { createClient } from '@supabase/supabase-js';
import { generateCardNumber } from '../lib/sync/card-generator.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncUsers() {
  console.log('Starting sync cycle...');

  try {
    // 1. Get all users from auth.users (via RPC or service role query if allowed)
    // Note: Direct query to auth.users requires service_role
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    for (const user of authUsers.users) {
      // 2. Check if user exists in public.profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(`Error checking profile for user ${user.id}:`, profileError);
        continue;
      }

      if (!profile) {
        console.log(`Creating profile for new user ${user.email}...`);
        
        // Auto-parse student_id from school email: lastname.studentid@alabang.sti.edu.ph
        let studentId = "N/A";
        const emailMatch = user.email?.match(/\.(\d+)@/);
        if (emailMatch && emailMatch[1]) {
          studentId = emailMatch[1];
        }

        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            student_id: studentId,
            role: 'student'
          });

        if (createProfileError) {
          console.error(`Error creating profile for ${user.id}:`, createProfileError);
          continue;
        }
      }

      // 3. Check if user has a library card
      const { data: card, error: cardError } = await supabase
        .from('library_cards')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (cardError && cardError.code !== 'PGRST116') {
        console.error(`Error checking card for user ${user.id}:`, cardError);
        continue;
      }

      if (!card) {
        console.log(`Generating library card for user ${user.id}...`);
        const cardNumber = generateCardNumber();
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year validity

        const { error: createCardError } = await supabase
          .from('library_cards')
          .insert({
            user_id: user.id,
            card_number: cardNumber,
            status: 'pending',
            expires_at: expiresAt.toISOString()
          });

        if (createCardError) {
          console.error(`Error creating card for ${user.id}:`, createCardError);
        } else {
          console.log(`Card ${cardNumber} generated successfully.`);
        }
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }

  console.log('Sync cycle complete. Waiting for next cycle...');
}

// Polling interval: 5 minutes
const INTERVAL = 5 * 60 * 1000;

syncUsers();
setInterval(syncUsers, INTERVAL);
