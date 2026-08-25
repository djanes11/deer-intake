alter table public.square_payment_links
  add column if not exists payment_confirmation_channel text,
  add column if not exists payment_confirmation_email_sent_at timestamptz,
  add column if not exists payment_confirmation_sms_sent_at timestamptz,
  add column if not exists payment_confirmation_sms_sid text,
  add column if not exists payment_confirmation_error text;
