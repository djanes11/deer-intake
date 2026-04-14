alter table public.jobs
  add column if not exists processing_weight_lbs numeric,
  add column if not exists amount_paid_processing numeric not null default 0,
  add column if not exists amount_paid_specialty numeric not null default 0;

update public.jobs
set amount_paid_processing = case
  when coalesce(paid_processing, false) then coalesce(price_processing, 0)
  else coalesce(amount_paid_processing, 0)
end
where coalesce(amount_paid_processing, 0) = 0;

update public.jobs
set amount_paid_specialty = case
  when coalesce(paid_specialty, false) then coalesce(price_specialty, 0)
  else coalesce(amount_paid_specialty, 0)
end
where coalesce(amount_paid_specialty, 0) = 0;

update public.jobs
set paid_processing = coalesce(amount_paid_processing, 0) >= coalesce(price_processing, 0),
    paid_specialty = coalesce(amount_paid_specialty, 0) >= coalesce(price_specialty, 0),
    paid = (coalesce(amount_paid_processing, 0) >= coalesce(price_processing, 0))
      and (coalesce(amount_paid_specialty, 0) >= coalesce(price_specialty, 0));
