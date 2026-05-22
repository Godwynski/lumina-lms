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

async function testOverdueReturn() {
  console.log('=== TESTING OVERDUE BOOK RETURN ===\n');

  // 1. Fetch an overdue borrowing record
  console.log('1. Fetching an overdue borrowing record...');
  const { data: record, error: recordError } = await supabase
    .from('borrowing_records')
    .select(`
      id,
      status,
      due_date,
      user_id,
      book_copy_id,
      book_copies (
        id,
        qr_string,
        status,
        books (
          title
        )
      )
    `)
    .eq('status', 'OVERDUE')
    .limit(1)
    .single();

  if (recordError || !record) {
    console.error('❌ Failed to fetch an overdue borrowing record:', recordError?.message || 'No overdue records found.');
    console.log('Tip: Make sure you have run "npm run seed" to seed the database with overdue books.');
    process.exit(1);
  }

  const copy = (record.book_copies as any);
  const bookTitle = copy?.books?.title || 'Unknown Book';
  const qrString = copy?.qr_string;
  const originalCopyStatus = copy?.status;

  console.log(`✅ Found Overdue Loan:`);
  console.log(`   - Book: "${bookTitle}"`);
  console.log(`   - Copy QR Code: "${qrString}"`);
  console.log(`   - Due Date: ${record.due_date}`);
  console.log(`   - Borrowing Record ID: ${record.id}`);
  console.log(`   - Current Borrow Record Status: ${record.status}`);
  console.log(`   - Current Copy Status: ${originalCopyStatus}\n`);

  if (!qrString) {
    // If QR string is missing, let's assign a temporary one for testing
    console.log('⚠️ Copy is missing qr_string. Assigning temporary QR...');
    const tempQr = `TEST-QR-${Date.now()}`;
    const { error: qrError } = await supabase
      .from('book_copies')
      .update({ qr_string: tempQr })
      .eq('id', record.book_copy_id);
    
    if (qrError) {
      console.error('❌ Failed to assign temporary QR code:', qrError.message);
      process.exit(1);
    }
    
    // Refresh copy detail
    copy.qr_string = tempQr;
    console.log(`✅ Temporary QR code assigned: "${tempQr}"`);
  }

  // 2. Call the return RPC
  console.log('2. Invoking public.process_qr_return RPC...');
  const librarianId = '00000000-0000-0000-0000-000000000002'; // Demo Librarian ID
  
  const { data: returnResult, error: returnError } = await supabase.rpc('process_qr_return', {
    p_librarian_id: librarianId,
    p_book_qr: copy.qr_string,
    p_preview_only: false
  });

  if (returnError) {
    console.error('❌ process_qr_return RPC failed with database error:', returnError.message);
    process.exit(1);
  }

  console.log('✅ RPC return completed successfully. Result:', returnResult);

  // 3. Verify database updates
  console.log('\n3. Verifying updated database states...');
  
  const { data: updatedRecord } = await supabase
    .from('borrowing_records')
    .select('status, returned_at')
    .eq('id', record.id)
    .single();

  const { data: updatedCopy } = await supabase
    .from('book_copies')
    .select('status')
    .eq('id', record.book_copy_id)
    .single();

  console.log(`   - Updated Borrow Record Status: ${updatedRecord?.status} (Expected: RETURNED)`);
  console.log(`   - Borrow Record returned_at: ${updatedRecord?.returned_at}`);
  console.log(`   - Updated Copy Status: ${updatedCopy?.status} (Expected: AVAILABLE or RESERVED)`);

  const success = updatedRecord?.status === 'RETURNED' && (updatedCopy?.status === 'AVAILABLE' || updatedCopy?.status === 'RESERVED');
  
  if (success) {
    console.log('\n🎉 SUCCESS: The overdue book was successfully returned!');
  } else {
    console.log('\n❌ FAILURE: Database states were not updated correctly.');
  }

  // 4. Safely Revert DB States to preserve demo data
  console.log('\n4. Restoring database to original state for clean environment...');
  
  await supabase
    .from('borrowing_records')
    .update({
      status: 'OVERDUE',
      returned_at: null,
      returned_by: null
    })
    .eq('id', record.id);

  await supabase
    .from('book_copies')
    .update({
      status: originalCopyStatus
    })
    .eq('id', record.book_copy_id);

  console.log('✅ Original database states restored.');
}

testOverdueReturn().catch(err => {
  console.error('Fatal testing error:', err);
});
