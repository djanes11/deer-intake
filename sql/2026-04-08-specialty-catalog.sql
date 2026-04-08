create table if not exists public.processor_specialty_items (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  slug text not null,
  name text not null,
  short_name text not null,
  unit text not null default 'lb',
  price_type text not null default 'per_lb',
  price numeric not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  legacy_field_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists processor_specialty_items_processor_slug_idx
  on public.processor_specialty_items (processor_id, lower(slug));

create index if not exists processor_specialty_items_processor_active_sort_idx
  on public.processor_specialty_items (processor_id, active, sort_order);

create table if not exists public.job_specialty_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  processor_id uuid references public.processors(id) on delete cascade,
  processor_specialty_item_id uuid references public.processor_specialty_items(id) on delete set null,
  item_slug text not null,
  item_name text not null,
  short_name text not null,
  unit text not null default 'lb',
  price_type text not null default 'per_lb',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_specialty_items_job_slug_idx
  on public.job_specialty_items (job_id, lower(item_slug));

create index if not exists job_specialty_items_job_sort_idx
  on public.job_specialty_items (job_id, sort_order);

insert into public.processor_specialty_items (
  processor_id,
  slug,
  name,
  short_name,
  unit,
  price_type,
  price,
  active,
  sort_order,
  legacy_field_key
)
select
  p.id,
  seed.slug,
  seed.name,
  seed.short_name,
  'lb',
  'per_lb',
  case
    when seed.category = 'summer' then coalesce(ss.summer_sausage_price_per_lb, 5)
    else coalesce(ss.snack_stix_price_per_lb, 8)
  end,
  true,
  seed.sort_order,
  seed.legacy_field_key
from public.processors p
left join public.site_settings ss
  on ss.processor_id = p.id
cross join (
  values
    ('original-summer-sausage', 'Original Summer Sausage', 'Original SS', 'summer', 10, 'originalSummerSausageLbs'),
    ('summer-sausage-cheese', 'Summer Sausage + Cheese', 'SS + Cheese', 'summer', 20, 'summerSausageCheeseLbs'),
    ('jalapeno-summer-sausage-cheese', 'Jalapeno Summer Sausage + Cheddar', 'Jalapeno SS + Cheddar', 'summer', 30, 'jalapenoSummerSausageCheeseLbs'),
    ('original-snack-stix', 'Original Snack Stix', 'Original Stix', 'snack', 40, 'originalSnackSticksLbs'),
    ('original-snack-stix-cheese', 'Original Snack Stix + Cheddar', 'Stix + Cheddar', 'snack', 50, 'originalSnackSticksCheeseLbs'),
    ('jalapeno-snack-stix-cheese', 'Jalapeno Snack Stix + Cheddar', 'Jalapeno Stix + Cheddar', 'snack', 60, 'jalapenoSnackSticksCheeseLbs')
) as seed(slug, name, short_name, category, sort_order, legacy_field_key)
where not exists (
  select 1
  from public.processor_specialty_items psi
  where psi.processor_id = p.id
);

insert into public.job_specialty_items (
  job_id,
  processor_id,
  processor_specialty_item_id,
  item_slug,
  item_name,
  short_name,
  unit,
  price_type,
  quantity,
  unit_price,
  total_price,
  sort_order
)
select
  j.id,
  j.processor_id,
  psi.id,
  psi.slug,
  psi.name,
  psi.short_name,
  psi.unit,
  psi.price_type,
  qty.quantity,
  psi.price,
  qty.quantity * psi.price,
  psi.sort_order
from public.jobs j
join lateral (
  values
    ('originalSummerSausageLbs', coalesce(nullif(j.original_summer_sausage_lbs, 0), coalesce(j.summer_sausage_lbs, 0))),
    ('summerSausageCheeseLbs', coalesce(j.summer_sausage_cheese_lbs, 0)),
    ('jalapenoSummerSausageCheeseLbs', coalesce(nullif(j.jalapeno_summer_sausage_cheese_lbs, 0), coalesce(j.sliced_jerky_lbs, 0))),
    ('originalSnackSticksLbs', coalesce(j.original_snack_sticks_lbs, 0)),
    ('originalSnackSticksCheeseLbs', coalesce(j.original_snack_sticks_cheese_lbs, 0)),
    ('jalapenoSnackSticksCheeseLbs', coalesce(j.jalapeno_snack_sticks_cheese_lbs, 0))
) as qty(legacy_field_key, quantity)
  on qty.quantity > 0
join public.processor_specialty_items psi
  on psi.processor_id = j.processor_id
 and psi.legacy_field_key = qty.legacy_field_key
where not exists (
  select 1
  from public.job_specialty_items jsi
  where jsi.job_id = j.id
);
