alter table public.site_settings
  add column if not exists cut_option_settings jsonb not null default '{}'::jsonb;

update public.site_settings
set cut_option_settings = jsonb_strip_nulls(
  coalesce(cut_option_settings, '{}'::jsonb) || jsonb_build_object(
    'showFrontShoulderSteaks', true,
    'showBackstrapThickness', true,
    'showRoastCounts', true
  )
)
where cut_option_settings is null
   or cut_option_settings = '{}'::jsonb;
