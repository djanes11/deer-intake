alter table public.site_settings
  add column if not exists process_catalog jsonb not null default '[]'::jsonb,
  add column if not exists add_on_catalog jsonb not null default '[]'::jsonb,
  add column if not exists notification_templates jsonb not null default '{}'::jsonb;

alter table public.jobs
  add column if not exists process_type_slug text,
  add column if not exists process_type_requires_cape boolean not null default false,
  add column if not exists add_on_items jsonb not null default '[]'::jsonb;

update public.jobs
set
  process_type_slug = case
    when lower(coalesce(process_type, '')) like '%cape%donate%' then 'cape-donate'
    when lower(coalesce(process_type, '')) like '%donate%' then 'donate'
    when lower(coalesce(process_type, '')) like '%cape%' and lower(coalesce(process_type, '')) not like '%skull%' then 'caped'
    when lower(coalesce(process_type, '')) like '%skull%' then 'skull-cap'
    when lower(coalesce(process_type, '')) like '%euro%' then 'european'
    when lower(coalesce(process_type, '')) like '%standard%' then 'standard-processing'
    else process_type_slug
  end,
  process_type_requires_cape = case
    when lower(coalesce(process_type, '')) like '%cape%' and lower(coalesce(process_type, '')) not like '%skull%' then true
    else coalesce(process_type_requires_cape, false)
  end
where process_type is not null
  and (
    process_type_slug is null
    or process_type_slug = ''
    or process_type_requires_cape = false
  );
