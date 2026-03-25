alter table public.jobs
  add column if not exists original_summer_sausage_lbs numeric not null default 0,
  add column if not exists jalapeno_summer_sausage_cheese_lbs numeric not null default 0,
  add column if not exists original_snack_sticks_lbs numeric not null default 0,
  add column if not exists original_snack_sticks_cheese_lbs numeric not null default 0,
  add column if not exists jalapeno_snack_sticks_cheese_lbs numeric not null default 0;

update public.jobs
set
  original_summer_sausage_lbs = coalesce(nullif(original_summer_sausage_lbs, 0), coalesce(summer_sausage_lbs, 0)),
  jalapeno_summer_sausage_cheese_lbs = coalesce(nullif(jalapeno_summer_sausage_cheese_lbs, 0), coalesce(sliced_jerky_lbs, 0))
where
  coalesce(original_summer_sausage_lbs, 0) = 0
  or coalesce(jalapeno_summer_sausage_cheese_lbs, 0) = 0;

update public.jobs
set specialty_pounds =
  coalesce(original_summer_sausage_lbs, 0) +
  coalesce(summer_sausage_cheese_lbs, 0) +
  coalesce(jalapeno_summer_sausage_cheese_lbs, 0) +
  coalesce(original_snack_sticks_lbs, 0) +
  coalesce(original_snack_sticks_cheese_lbs, 0) +
  coalesce(jalapeno_snack_sticks_cheese_lbs, 0);
