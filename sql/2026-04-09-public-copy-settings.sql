alter table if exists public.site_settings
  add column if not exists public_copy jsonb not null default '{}'::jsonb;
