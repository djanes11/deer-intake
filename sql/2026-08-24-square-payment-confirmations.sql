alter table public.square_payment_links
  add column if not exists payment_confirmation_channel text,
  add column if not exists payment_confirmation_email_sent_at timestamptz,
  add column if not exists payment_confirmation_sms_sent_at timestamptz,
  add column if not exists payment_confirmation_sms_sid text,
  add column if not exists payment_confirmation_error text;

create index if not exists square_payment_links_processor_status_updated_idx
  on public.square_payment_links (processor_id, status, updated_at desc);

create index if not exists square_payment_links_confirmation_error_idx
  on public.square_payment_links (processor_id, updated_at desc)
  where payment_confirmation_error is not null and payment_confirmation_error <> '';
