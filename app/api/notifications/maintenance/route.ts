import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runMaintenanceTasks } from '@/lib/notifications';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin/librarian role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'librarian')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = await runMaintenanceTasks();
    return NextResponse.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
