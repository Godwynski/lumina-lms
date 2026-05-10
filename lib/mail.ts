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
 * Sends an email notification for an overdue book.
 */
export async function sendOverdueEmail({
  to,
  userName,
  bookTitle,
  dueDate,
  overdueDays,
}: SendOverdueEmailOptions) {
  if (!to) {
    logger.warn('mail', 'No email address provided for overdue notification', { userName, bookTitle });
    return { success: false, error: 'No email address' };
  }

  const subject = `URGENT: Your borrowed book is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  
  const text = `Hi ${userName},

Your borrowed book "${bookTitle}" was due on ${dueDate} and is now ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.

Please return it immediately to the Main Library circulation desk to avoid further penalties.

Regards,
Lumina Library System`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #d32f2f;">URGENT: Book Overdue</h2>
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your borrowed book <strong>"${bookTitle}"</strong> was due on <strong>${dueDate}</strong> and is now <span style="color: #d32f2f; font-weight: bold;">${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue</span>.</p>
      <p>Please return it immediately to the Main Library circulation desk to avoid further penalties.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">This is an automated notification from the Lumina Library System.</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lumina Library" <noreply@lumina-lms.com>',
      to,
      subject,
      text,
      html,
    });

    logger.info('mail', `Overdue email sent to ${to}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('mail', `Failed to send overdue email to ${to}`, { error });
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
  if (!to) {
    logger.warn('mail', 'No email address provided for due soon notification', { userName, bookTitle });
    return { success: false, error: 'No email address' };
  }

  const subject = `Reminder: Your borrowed book is due on ${dueDate}`;
  
  const text = `Hi ${userName},

Your borrowed book "${bookTitle}" is due on ${dueDate}.

Please return it or renew it to avoid any overdue penalties.

Regards,
Lumina Library System`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #1976d2;">Reminder: Book Due Soon</h2>
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your borrowed book <strong>"${bookTitle}"</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please return it or renew it to avoid any overdue penalties.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">This is an automated notification from the Lumina Library System.</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lumina Library" <noreply@lumina-lms.com>',
      to,
      subject,
      text,
      html,
    });

    logger.info('mail', `Due soon email sent to ${to}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('mail', `Failed to send due soon email to ${to}`, { error });
    return { success: false, error };
  }
}
