import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendOverdueEmail, sendDueSoonEmail, sendTestEmail } from '@/lib/mail';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin or librarian role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, email, status')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'librarian')) {
      return NextResponse.json({ error: 'Forbidden. Admin or librarian only.' }, { status: 403 });
    }

    if (profile.status?.toUpperCase() === 'ARCHIVED') {
      return NextResponse.json({ error: 'Forbidden. Account archived.' }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === 'object') {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    const targetEmail = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
    const type = typeof body.type === 'string' ? body.type : 'overdue';
    const to = targetEmail || profile.email;
    const name = profile.full_name || 'Administrator';

    if (!to) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
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
    } else if (type === 'test') {
      result = await sendTestEmail(to, name);
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
      const errorMessage = result.error instanceof Error
        ? result.error.message
        : (typeof result.error === 'string' ? result.error : 'Failed to send test email');
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
