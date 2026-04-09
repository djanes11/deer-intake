alter table public.jobs
  add column if not exists hunting_license_number text;

alter table public.site_settings
  add column if not exists state_form_type text not null default 'indiana';

update public.site_settings
set state_form_type = 'indiana'
where state_form_type is null
   or btrim(state_form_type) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_state_form_type_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_state_form_type_check
      check (state_form_type in ('indiana', 'ohio', 'michigan'));
  end if;
end $$;
