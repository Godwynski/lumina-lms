import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import nodemailer from 'nodemailer';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const tables = [
  'categories',
  'books',
  'book_copies',
  'profiles',
  'library_cards',
  'borrowing_records',
  'reservations',
  'system_settings',
  'audit_logs',
  'checkout_idempotency',
  'return_idempotency',
  'notifications',
  'attendance',
  'ui_preferences',
  'announcements',
  'reports',
  'deleted_profile_info',
  'rate_limit_log',
  'checklist_dropdown_options',
  'checklist_items'
];

async function runDiagnostics() {
  console.log('==================================================');
  console.log('           LUMINA LMS DIAGNOSTICS RUN             ');
  console.log('==================================================');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // 1. Check Env Config
  console.log('1. Checking Environment Variables...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Configured (' + supabaseUrl + ')' : '❌ Missing'}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`- SMTP_HOST: ${smtpHost ? `✅ Configured (${smtpHost})` : '❌ Missing'}`);
  console.log(`- SMTP_PORT: ${smtpPort ? `✅ Configured (${smtpPort})` : '❌ Missing'}`);
  console.log(`- SMTP_USER: ${smtpUser ? `✅ Configured (${smtpUser})` : '❌ Missing'}`);
  console.log(`- SMTP_PASS: ${smtpPass ? '✅ Configured' : '❌ Missing'}`);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase keys missing. Aborting diagnostics.');
    process.exit(1);
  }

  // 2. Initialize Supabase
  console.log('\n2. Testing Supabase Service Connection...');
  let supabase;
  try {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized.');
  } catch (err: any) {
    console.error(`❌ Failed to initialize Supabase client: ${err.message}`);
    process.exit(1);
  }

  // 3. Check Table Accessibility and Row Counts
  console.log('\n3. Querying Database Tables...');
  const tableResults: Record<string, { status: string; count?: number; error?: string }> = {};
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        tableResults[table] = { status: '❌ Error', error: error.message };
        console.log(`- ${table.padEnd(28)}: ❌ Error: ${error.message}`);
      } else {
        tableResults[table] = { status: '✅ Connected', count: count ?? 0 };
        console.log(`- ${table.padEnd(28)}: ✅ Connected (Count: ${count ?? 0})`);
      }
    } catch (err: any) {
      tableResults[table] = { status: '❌ Exception', error: err.message };
      console.log(`- ${table.padEnd(28)}: ❌ Exception: ${err.message}`);
    }
  }

  // 4. Test Write/Delete Transaction to verify privileges
  console.log('\n4. Testing Read/Write/Delete Permissions...');
  try {
    const testCategory = {
      name: `TEMP_TEST_DIAGNOSTICS_${Date.now()}`,
      slug: `temp-test-diagnostics-${Date.now()}`,
      description: 'Temporary category for automated diagnostics write check'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('categories')
      .insert(testCategory)
      .select();

    if (insertError) {
      console.log(`❌ Insert check failed: ${insertError.message}`);
    } else {
      console.log('✅ Insert check succeeded.');
      const insertedId = insertData?.[0]?.id;
      
      if (insertedId) {
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('id', insertedId);
        
        if (deleteError) {
          console.log(`⚠️ Cleanup delete failed: ${deleteError.message}`);
        } else {
          console.log('✅ Cleanup delete succeeded. Full transaction cycle complete.');
        }
      }
    }
  } catch (err: any) {
    console.error(`❌ Transaction cycle exception: ${err.message}`);
  }

  // 5. Test SMTP Transport Verification
  console.log('\n5. Verifying SMTP Server Connection...');
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '465'),
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.verify();
      console.log('✅ SMTP Server verified successfully. Ready to send emails.');
    } catch (err: any) {
      console.error(`❌ SMTP Verification failed: ${err.message}`);
    }
  } else {
    console.log('⚠️ SMTP variables incomplete. Skipping SMTP transport verification.');
  }

  console.log('\n==================================================');
  console.log('        LUMINA LMS DIAGNOSTICS COMPLETED          ');
  console.log('==================================================');
}

runDiagnostics().catch(err => {
  console.error('Fatal diagnostics error:', err);
  process.exit(1);
});
