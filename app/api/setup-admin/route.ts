import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, secret } = await request.json();

    // Check against a secret configured in environment variables to prevent abuse
    if (secret !== process.env.ADMIN_SETUP_SECRET) {
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

    // 2. The trigger `on_auth_user_created` (if you ran the migration) should have 
    // automatically created a profile with the 'student' role.
    // We now need to update that profile to 'admin'.
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile role:', profileUpdateError);
      // Clean up the created auth user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileUpdateError.message }, { status: 400 });
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
