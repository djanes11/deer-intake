alter table if exists public.staff_local_users
  add column if not exists must_change_password boolean not null default false;

update public.staff_local_users
set must_change_password = false
where must_change_password is distinct from false;
