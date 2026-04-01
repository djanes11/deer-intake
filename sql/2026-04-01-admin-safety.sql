alter table public.jobs
  add column if not exists pending_deleted_at timestamptz null,
  add column if not exists pending_delete_reason text null;

create index if not exists jobs_pending_deleted_at_idx
  on public.jobs (pending_deleted_at);
