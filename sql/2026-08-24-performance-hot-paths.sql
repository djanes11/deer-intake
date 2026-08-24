-- Opening-weekend hot path indexes.
-- These keep public status lookups and busy staff queues on small indexed scans.

create index if not exists jobs_processor_phone_dropoff_idx
  on public.jobs (processor_id, phone, dropoff_date desc)
  where pending_deleted_at is null;

create index if not exists jobs_processor_print_queue_idx
  on public.jobs (processor_id, intake_sheet_printed_at, requires_tag, dropoff_date desc)
  where pending_deleted_at is null
    and tag is not null
    and tag <> '';

create index if not exists jobs_processor_webbs_payment_queue_idx
  on public.jobs (processor_id, paid_processing, dropoff_date desc, created_at desc)
  where pending_deleted_at is null
    and webbs_order = true;
