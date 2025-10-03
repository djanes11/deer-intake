// lib/email.ts
// Minimal email abstraction. Uses Resend if RESEND_API_KEY is set; otherwise falls back to Nodemailer SMTP.
// Required env for Nodemailer: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

import type { Attachment } from 'nodemailer/lib/mailer';

type EmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

export async function sendEmail(opts: EmailOpts) {
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || process.env.SMTP_FROM;
  if (!from) throw new Error("EMAIL_FROM (or RESEND_FROM/SMTP_FROM) not set");
  // RESEND
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const res = await resend.emails.send({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments?.map(a => ({
        filename: a.filename || 'attachment',
        content: (a as any).content, // Buffer
      })),
    });
    if ((res as any).error) throw new Error((res as any).error.message || "Resend send failed");
    return { ok: true, id: (res as any).id };
  }

  // NODEMAILER (SMTP)
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP_* env vars missing (and RESEND_API_KEY not set)");

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
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