import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { DEMO_ACCOUNTS } from '../lib/demo/accounts.ts';
import { buildDemoFixtures } from '../lib/demo/fixtures.ts';

config({ path: '.env.local', quiet: true });

const borrower = {
  ...DEMO_ACCOUNTS[3],
  email: 'demo.borrower@alabang.sti.edu.ph',
  fullName: 'Demo Borrower',
  studentId: 'STU-DEMO.BORROWER',
  cardNumber: 'DEMO-STU-002',
};

async function seedDemo() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, DEMO_PASSWORD: password } = process.env;
  const expectedHost = process.argv[2];
  if (!url || !key || !password || password.length < 12 || !expectedHost || new URL(url).hostname !== expectedHost) {
    throw new Error('Supply the exact target host, its service key, and DEMO_PASSWORD of at least 12 characters.');
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: admins, error: adminError } = await db.from('profiles').select('email').eq('role', 'super_admin');
  if (adminError) throw adminError;
  if (admins.some(admin => admin.email !== DEMO_ACCOUNTS[0].email)) {
    throw new Error('An institutional Super Admin already exists. Demo provisioning stopped before any writes.');
  }

  const users = new Map<string, string>();
  for (const account of [...DEMO_ACCOUNTS, borrower]) {
    const { data: existing, error: findError } = await db.from('profiles').select('id').eq('email', account.email).maybeSingle();
    if (findError) throw findError;
    const authData = {
      password: account === borrower ? randomBytes(32).toString('hex') : password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    };
    const result = existing
      ? await db.auth.admin.updateUserById(existing.id, authData)
      : await db.auth.admin.createUser({ email: account.email, ...authData });
    if (result.error) throw result.error;
    if (!result.data.user) throw new Error(`Missing account for ${account.email}`);
    const id = result.data.user.id;
    const { error: profileError } = await db.from('profiles').update({
      full_name: account.fullName, role: account.role, student_id: account.studentId,
      department: account.department, phone: account.phone, address: account.address,
      permissions: account.permissions, status: 'ACTIVE', onboarding_completed: true,
      patron_type: account.studentId.startsWith('FAC-') ? 'faculty' : 'student',
    }).eq('id', id).select('id').single();
    if (profileError) throw profileError;
    const { error: cardError } = await db.from('library_cards').upsert({
      user_id: id, card_number: account.cardNumber, status: 'ACTIVE', expires_at: '2099-12-31T00:00:00Z',
    }, { onConflict: 'user_id' });
    if (cardError) throw cardError;
    users.set(account.email, id);
  }
  const userId = (email: string) => {
    const id = users.get(email);
    if (!id) throw new Error(`Unprovisioned fixture user ${email}`);
    return id;
  };

  const fixtures = buildDemoFixtures({
    patron: userId(DEMO_ACCOUNTS[3].email),
    librarian: userId(DEMO_ACCOUNTS[1].email),
    borrower: userId(borrower.email),
  }, new Date());

  async function addRows(table: string, rows: { id: string }[]) {
    for (let index = 0; index < rows.length; index += 100) {
      const { error } = await db.from(table).upsert(rows.slice(index, index + 100), {
        onConflict: 'id', ignoreDuplicates: true,
      });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    const { count, error } = await db.from(table).select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.info(`${table}: ${rows.length} fixtures, ${count} total rows`);
  }

  await addRows('categories', fixtures.categories);
  await addRows('books', fixtures.books);
  await addRows('book_copies', fixtures.copies);
  await addRows('borrowing_records', fixtures.loans);
  await addRows('reservations', fixtures.reservations);
  await addRows('attendance', fixtures.attendance);
  await addRows('notifications', fixtures.notifications);
  console.info('Provisioned four evaluator roles and one synthetic borrower.');
}

seedDemo().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
