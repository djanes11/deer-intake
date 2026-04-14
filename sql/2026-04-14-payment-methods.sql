alter table public.jobs
  add column if not exists payment_method_processing text,
  add column if not exists payment_method_specialty text;

update public.jobs
set payment_method_processing = null
where payment_method_processing is not null
  and lower(payment_method_processing) not in ('cash', 'card', 'check', 'other');

update public.jobs
set payment_method_specialty = null
where payment_method_specialty is not null
  and lower(payment_method_specialty) not in ('cash', 'card', 'check', 'other');
