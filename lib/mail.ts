import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendOverdueEmailOptions {
  to: string;
  userName: string;
  bookTitle: string;
  dueDate: string;
  overdueDays: number;
}

interface SendDueSoonEmailOptions {
  to: string;
  userName: string;
  bookTitle: string;
  dueDate: string;
}

/**
 * Shared email layout wrapper for professional appearance
 */
function getEmailLayout(title: string, content: string, ctaText?: string, ctaUrl?: string) {
  const primaryColor = '#2563eb';
  const appUrl = 'https://winelms.vercel.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); margin: 0 auto; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 40px 30px; background-color: #ffffff; border-bottom: 1px solid #f0f0f0;">
              <!-- Text Logo instead of broken image -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, ${primaryColor}, #1e40af); width: 48px; height: 48px; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 24px; font-weight: bold; font-family: sans-serif; line-height: 48px; display: block;">L</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.03em;">
                LUMINA<span style="color: ${primaryColor};">LMS</span>
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; background-color: #ffffff;">
              ${content}
              
              ${ctaText && ctaUrl ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 16px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #f3f4f6;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                &copy; ${new Date().getFullYear()} Lumina Library Management System
              </p>
              <p style="margin: 0 0 16px; font-size: 13px; color: #9ca3af; line-height: 1.5;">
                This is an automated notification. Please do not reply to this email.
              </p>
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="color: ${primaryColor}; text-decoration: none; font-size: 14px; font-weight: 600;">Visit Your Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Bottom padding for aesthetics -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td height="40"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Sends an email notification for an overdue book.
 */
export async function sendOverdueEmail({
  to,
  userName,
  bookTitle,
  dueDate,
  overdueDays,
}: SendOverdueEmailOptions) {
  if (!to) return { success: false, error: 'No email address' };

  const subject = `URGENT: Your borrowed book is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827;">Action Required: Overdue Item</h2>
    <p style="margin: 0 0 16px; font-size: 16px; color: #4b5563;">Hello <strong style="color: #111827;">${userName}</strong>,</p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
      Our records show that your borrowed book <span style="color: #111827; font-weight: 600;">"${bookTitle}"</span> was due on <strong style="color: #111827;">${dueDate}</strong>. It is currently <span style="color: #dc2626; font-weight: 700;">${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue</span>.
    </p>
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #991b1b;">
        Please return the item to the Main Library circulation desk as soon as possible to avoid further accumulation of fines.
      </p>
    </div>
  `;

  const html = getEmailLayout(
    'Book Overdue Notification',
    content,
    'View My Account',
    'https://winelms.vercel.app/dashboard'
  );

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lumina Library" <noreply@lumina-lms.com>',
      to,
      subject,
      text: `Hi ${userName}, your borrowed book "${bookTitle}" is ${overdueDays} day(s) overdue. Please return it immediately.`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('mail', 'Overdue email failed', { error });
    return { success: false, error };
  }
}

/**
 * Sends an email notification for a book due soon.
 */
export async function sendDueSoonEmail({
  to,
  userName,
  bookTitle,
  dueDate,
}: SendDueSoonEmailOptions) {
  if (!to) return { success: false, error: 'No email address' };

  const subject = `Reminder: Your borrowed book is due on ${dueDate}`;
  
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827;">Friendly Reminder</h2>
    <p style="margin: 0 0 16px; font-size: 16px; color: #4b5563;">Hello <strong style="color: #111827;">${userName}</strong>,</p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
      This is a quick reminder that your borrowed book <span style="color: #111827; font-weight: 600;">"${bookTitle}"</span> is due for return on <strong style="color: #111827;">${dueDate}</strong>.
    </p>
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1e3a8a;">
        You can return it to the library or renew it online if the item is still eligible for renewal.
      </p>
    </div>
  `;

  const html = getEmailLayout(
    'Book Due Soon Reminder',
    content,
    'Manage Borrowings',
    'https://winelms.vercel.app/dashboard'
  );

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lumina Library" <noreply@lumina-lms.com>',
      to,
      subject,
      text: `Hi ${userName}, your borrowed book "${bookTitle}" is due on ${dueDate}.`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('mail', 'Due soon email failed', { error });
    return { success: false, error };
  }
}

/**
 * Sends a professional test email to verify SMTP configuration.
 */
export async function sendTestEmail(to: string, userName: string) {
  if (!to) return { success: false, error: 'No email address' };

  const subject = 'Lumina LMS: Email System Test';
  
  const content = `
    <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827;">System Configuration Test</h2>
    <p style="margin: 0 0 16px; font-size: 16px; color: #4b5563;">Hello <strong style="color: #111827;">${userName}</strong>,</p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
      This is a test email sent from the Lumina Library Management System to verify that your email configuration is working correctly.
    </p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Diagnostic Details</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #475569; width: 100px;">Status</td>
          <td style="padding: 4px 0; font-size: 14px; color: #10b981; font-weight: 600;">Online &amp; Active</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #475569;">SMTP Host</td>
          <td style="padding: 4px 0; font-size: 14px; color: #0f172a; font-family: monospace;">${process.env.SMTP_HOST || 'Not specified'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #475569;">Timestamp</td>
          <td style="padding: 4px 0; font-size: 14px; color: #0f172a; font-family: monospace;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
    </div>
  `;

  const html = getEmailLayout(
    'Email System Test',
    content,
    'Open Dashboard',
    'https://winelms.vercel.app/dashboard'
  );

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lumina Library" <noreply@lumina-lms.com>',
      to,
      subject,
      text: `Lumina LMS: This is a test email to verify your SMTP configuration.`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    logger.error('mail', 'Test email failed', undefined, error);
    return { success: false, error: errorMessage };
  }
}

