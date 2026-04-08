drop index if exists public.staff_local_users_processor_username_uidx;

create unique index if not exists staff_local_users_username_uidx
  on public.staff_local_users (lower(username));
