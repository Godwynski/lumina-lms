import { NextResponse } from 'next/server';
import { sendOverdueEmail, sendDueSoonEmail, sendTestEmail } from '@/lib/mail';
import { withAuthApi } from '@/lib/api-utils';

export const POST = withAuthApi(async (request, { profile }) => {
  try {
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
      let errorMessage = result.error instanceof Error
        ? result.error.message
        : (typeof result.error === 'string' ? result.error : 'Failed to send test email');

      if (errorMessage.includes('535') || errorMessage.includes('BadCredentials') || errorMessage.includes('Username and Password not accepted')) {
        errorMessage = 'Gmail SMTP Authentication Failed (535): Google requires a 16-character App Password. Generate one at myaccount.google.com/apppasswords and update SMTP_PASS in your environment.';
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ESOCKETTIMEDOUT')) {
        errorMessage = 'SMTP Connection timed out. Please check your SMTP_HOST and SMTP_PORT.';
      } else if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'SMTP Connection refused. Please verify your SMTP_HOST and SMTP_PORT.';
      }

      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { allowedRoles: ['super_admin', 'librarian'] });
