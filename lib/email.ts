// lib/email.ts (SMTP-only, no 'resend' import to avoid build errors)
import type { Attachment } from 'nodemailer/lib/mailer';

type EmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

export async function sendEmail(opts: EmailOpts) {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM not set");

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP_* env vars missing");

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
  if (!info.messageId) throw new Error("SMTP send failed");
  return { ok: true, id: info.messageId };
}
