create extension if not exists pg_trgm;

create index if not exists jobs_processor_pending_dropoff_idx
  on public.jobs (processor_id, pending_deleted_at, dropoff_date desc);

create index if not exists jobs_processor_requires_tag_idx
  on public.jobs (processor_id, requires_tag)
  where pending_deleted_at is null;

create index if not exists jobs_processor_status_idx
  on public.jobs (processor_id, status)
  where pending_deleted_at is null;

create index if not exists jobs_processor_caping_status_idx
  on public.jobs (processor_id, caping_status)
  where pending_deleted_at is null;

create index if not exists jobs_processor_webbs_status_idx
  on public.jobs (processor_id, webbs_status)
  where pending_deleted_at is null;

create index if not exists jobs_tag_trgm_idx
  on public.jobs using gin (tag gin_trgm_ops);

create index if not exists jobs_confirmation_trgm_idx
  on public.jobs using gin (confirmation gin_trgm_ops);

create index if not exists jobs_phone_trgm_idx
  on public.jobs using gin (phone gin_trgm_ops);

create index if not exists jobs_customer_name_trgm_idx
  on public.jobs using gin (customer_name gin_trgm_ops);
