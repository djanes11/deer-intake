alter table public.processors
  add column if not exists public_hostname text null,
  add column if not exists staff_hostname text null;

create unique index if not exists processors_public_hostname_unique_idx
  on public.processors (lower(public_hostname))
  where public_hostname is not null;

create unique index if not exists processors_staff_hostname_unique_idx
  on public.processors (lower(staff_hostname))
  where staff_hostname is not null;

update public.processors
set public_hostname = coalesce(public_hostname, 'deer-intake-public.vercel.app')
where slug = 'mcafee';
