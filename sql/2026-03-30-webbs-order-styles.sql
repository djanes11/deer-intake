alter table public.jobs
  add column if not exists webbs_order_style text,
  add column if not exists webbs_allocations jsonb not null default '[]'::jsonb;

update public.jobs
set webbs_order_style = coalesce(nullif(webbs_order_style, ''), 'itemized_lbs')
where coalesce(webbs_order, false) = true;
