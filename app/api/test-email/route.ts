import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendOverdueEmail, sendDueSoonEmail } from '@/lib/mail';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });
    }

    const { email: targetEmail, type } = await request.json().catch(() => ({ email: null, type: 'overdue' }));
    const to = targetEmail || profile.email;
    const name = profile.full_name || 'super_admin';

    if (!to) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 400 });
    }

    let result;
    if (type === 'due_soon') {
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString();
      result = await sendDueSoonEmail({
        to,
        userName: name,
        bookTitle: 'The Pragmatic Programmer (Test)',
        dueDate,
      });
    } else {
      const dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString();
      result = await sendOverdueEmail({
        to,
        userName: name,
        bookTitle: 'Clean Code (Test)',
        dueDate,
        overdueDays: 5,
      });
    }

    if (result.success) {
      return NextResponse.json({ success: true, message: `Test email sent to ${to}`, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
