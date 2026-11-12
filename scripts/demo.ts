// Turns demo accounts on or off.
//   npm run demo:on   -> creates/updates the four demo accounts and allows their sign-up
//   npm run demo:off  -> deletes the four demo accounts and removes them from the allowlist
// The landing-page buttons additionally need DEMO_MODE=true (see lib/demo/config.ts).
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { DEMO_ACCOUNTS } from '../lib/demo/config.ts';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FAR_FUTURE = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
}

async function demoOn() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) {
    console.error('Set DEMO_PASSWORD in your env (at least 12 characters) before running demo:on');
    process.exit(1);
  }

  // Does a real super admin already exist? Only one is allowed (unique index).
  const { data: existingSuper, error: superError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin');
  if (superError) throw new Error(`Failed to read profiles: ${superError.message}`);

  for (const account of DEMO_ACCOUNTS) {
    // Allow the sign-up trigger to accept this email before the user is created.
    const { error: allowError } = await supabase.from('demo_accounts').upsert({ email: account.email });
    if (allowError) throw new Error(`Failed to allow ${account.email}: ${allowError.message}`);

    let userId = await findUserIdByEmail(account.email);
    if (userId) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (error) throw new Error(`Failed to update ${account.email}: ${error.message}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      });
      if (error || !data.user) throw new Error(`Failed to create ${account.email}: ${error?.message}`);
      userId = data.user.id;
    }

    // Only one super admin is allowed, so the demo admin takes the role from whoever holds it.
    // The previous holder becomes a librarian and is remembered so demo:off can hand it back.
    const previousSuper = account.role === 'super_admin' ? (existingSuper ?? []).find((p) => p.id !== userId) : undefined;
    if (previousSuper) {
      const { error: transferError } = await supabase.rpc('transfer_super_admin_ownership', {
        p_current_admin_id: previousSuper.id,
        p_new_admin_id: userId,
      });
      if (transferError) throw new Error(`Failed to move super admin to ${account.email}: ${transferError.message}`);
      const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { previous_super_admin_id: previousSuper.id },
      });
      if (metaError) throw new Error(`Failed to record the previous super admin: ${metaError.message}`);
      console.warn(`  ! ${account.email} is now the super admin. The previous super admin is a librarian until demo:off.`);
    }
    const role = account.role;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: account.fullName, role, status: 'ACTIVE', onboarding_completed: true })
      .eq('id', userId);
    if (profileError) throw new Error(`Failed to update profile for ${account.email}: ${profileError.message}`);

    const { error: cardError } = await supabase.from('library_cards').upsert(
      { user_id: userId, card_number: account.cardNumber, status: 'ACTIVE', expires_at: FAR_FUTURE },
      { onConflict: 'user_id' },
    );
    if (cardError) throw new Error(`Failed to set card for ${account.email}: ${cardError.message}`);

    console.info(`✔ ${account.label.padEnd(12)} ${account.email} (${role})`);
  }

  console.info('\nDemo accounts are on. Set DEMO_MODE=true to show the landing-page buttons.');
}

async function demoOff() {
  for (const account of DEMO_ACCOUNTS) {
    const userId = await findUserIdByEmail(account.email);
    if (userId) {
      if (account.role === 'super_admin') await restoreSuperAdmin(userId);
      // Deleting the auth user cascades to profile and library card.
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        throw new Error(`Failed to delete ${account.email}: ${error.message}. Demo is NOT fully off; fix this and re-run demo:off.`);
      }
    }
    const { error: allowError } = await supabase.from('demo_accounts').delete().eq('email', account.email);
    if (allowError) throw new Error(`Failed to remove allowlist entry for ${account.email}: ${allowError.message}`);
    console.info(`✔ removed ${account.email}`);
  }
  console.info('\nDemo accounts are off. Sign-up is limited to @alabang.sti.edu.ph again.');
}

// Hands super admin back to whoever held it before demo:on, if anyone did.
async function restoreSuperAdmin(demoAdminId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(demoAdminId);
  if (error) throw new Error(`Failed to read the demo admin: ${error.message}`);
  const previousId = data.user?.app_metadata?.previous_super_admin_id as string | undefined;
  const { data: rows, error: rowsError } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', [demoAdminId, previousId ?? demoAdminId]);
  if (rowsError) throw new Error(`Failed to read profiles: ${rowsError.message}`);
  const demoIsSuper = rows?.some((r) => r.id === demoAdminId && r.role === 'super_admin');
  if (!demoIsSuper) return; // someone already moved the role elsewhere in the app
  if (!previousId || !rows?.some((r) => r.id === previousId)) {
    console.warn('  ! No previous super admin to hand back to: the next person to sign up becomes super admin.');
    return;
  }
  const { error: transferError } = await supabase.rpc('transfer_super_admin_ownership', {
    p_current_admin_id: demoAdminId,
    p_new_admin_id: previousId,
  });
  if (transferError) {
    throw new Error(`Failed to hand super admin back: ${transferError.message}. Demo is NOT off; fix this and re-run demo:off.`);
  }
  console.info('✔ super admin handed back to the previous holder');
}

async function main() {
  const command = process.argv[2];
  if (command === 'on') return demoOn();
  if (command === 'off') return demoOff();
  console.error('Usage: npm run demo:on | npm run demo:off');
  process.exit(1);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
