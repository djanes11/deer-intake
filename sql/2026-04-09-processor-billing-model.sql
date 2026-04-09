alter table public.processors
  add column if not exists setup_fee numeric null,
  add column if not exists per_deer_rate numeric null;

update public.processors
set per_deer_rate = case
  when coalesce(features->>'plan', 'basic') = 'custom' then 5
  when coalesce(features->>'plan', 'basic') = 'texting' then 3
  else 2
end
where per_deer_rate is null;
