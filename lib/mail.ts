import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '2525'),
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
  const logoUrl = 'https://winelms.vercel.app/logo.png'; // Placeholder if exists
  const appUrl = 'https://winelms.vercel.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 30px 40px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <div style="margin-bottom: 12px;">
                <img src="${logoUrl}" alt="Lumina Logo" width="40" height="40" style="display: block; border-radius: 8px;">
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em;">
                LUMINA<span style="color: ${primaryColor};">LMS</span>
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
              
              ${ctaText && ctaUrl ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">
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
            <td align="center" style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                &copy; ${new Date().getFullYear()} Lumina Library Management System
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">
                This is an automated notification. Please do not reply to this email.
              </p>
              <div style="margin-top: 16px;">
                <a href="${appUrl}" style="color: ${primaryColor}; text-decoration: none; font-size: 13px; font-weight: 500;">Visit Dashboard</a>
              </div>
            </td>
          </tr>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #b91c1c;">Return Requested: Book Overdue</h2>
    <p style="margin: 0 0 12px; font-size: 16px; color: #334155;">Hello <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #475569;">
      Our records show that your borrowed book <span style="color: #0f172a; font-weight: 600;">"${bookTitle}"</span> was due on <strong>${dueDate}</strong> and is currently <span style="color: #b91c1c; font-weight: 700;">${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue</span>.
    </p>
    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #475569;">
      Please return the item to the Main Library circulation desk as soon as possible to avoid further accumulation of fines.
    </p>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #1e40af;">Friendly Reminder: Book Due Soon</h2>
    <p style="margin: 0 0 12px; font-size: 16px; color: #334155;">Hello <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #475569;">
      This is a friendly reminder that your borrowed book <span style="color: #0f172a; font-weight: 600;">"${bookTitle}"</span> is due for return on <strong>${dueDate}</strong>.
    </p>
    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #475569;">
      You can return it to the library or renew it online if the item is still eligible for renewal.
    </p>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">System Configuration Test</h2>
    <p style="margin: 0 0 12px; font-size: 16px; color: #334155;">Hello <strong>${userName}</strong>,</p>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #475569;">
      This is a test email sent from the Lumina Library Management System to verify that your email configuration is working correctly.
    </p>
    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
      <p style="margin: 0; font-size: 14px; color: #334155; font-family: monospace;">
        Status: Online<br>
        SMTP Host: ${process.env.SMTP_HOST}<br>
        Timestamp: ${new Date().toLocaleString()}
      </p>
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
    logger.error('mail', 'Test email failed', { error });
    return { success: false, error };
  }
}
