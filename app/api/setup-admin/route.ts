import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { safeCompare } from '@/lib/server-utils';

export async function POST(request: Request) {
  try {
    const { email, password, secret } = await request.json();

    // Check against a secret configured in environment variables to prevent abuse
    // Use constant-time comparison to prevent timing attacks
    if (!process.env.ADMIN_SETUP_SECRET || !safeCompare(secret, process.env.ADMIN_SETUP_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Initialize the Supabase admin client using the service role key.
    // WARNING: This bypasses RLS. Only use the service role key in secure server routes.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 0. Prevent re-running if an admin already exists
    const { count: adminCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (adminCount && adminCount > 0) {
      return NextResponse.json({ error: 'Admin already initialized' }, { status: 403 });
    }

    // 1. Create the user in auth.users
    const { data: userAuthData, error: userAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: 'System Admin' }
    });

    if (userAuthError) {
      console.error('Error creating user auth:', userAuthError);
      return NextResponse.json({ error: userAuthError.message }, { status: 400 });
    }

    const userId = userAuthData.user.id;

    // 2. Upsert the profile to avoid depending on trigger timing/state.
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          role: 'admin',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileUpsertError) {
      console.error('Error upserting admin profile:', profileUpsertError);

      // Best-effort rollback so we don't leave orphaned auth users.
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error('Rollback failed: could not delete auth user:', deleteUserError);
        return NextResponse.json(
          {
            error:
              'Admin setup partially failed. Auth user was created but profile upsert failed, and rollback also failed.',
            userId,
            profileError: profileUpsertError.message,
            rollbackError: deleteUserError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ error: profileUpsertError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Admin user created successfully: ${email}`,
      user: userAuthData.user 
    });

  } catch (error: unknown) {
    console.error('Unhandled error setting up admin:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
