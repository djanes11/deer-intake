create extension if not exists pgcrypto;

create table if not exists public.specialty_inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.processors(id) on delete cascade,
  job_id uuid null references public.jobs(id) on delete cascade,
  tag text null,
  item_slug text not null,
  item_name text not null,
  short_name text not null,
  quantity_delta numeric not null,
  reason text not null,
  note text null,
  created_at timestamptz not null default now(),
  constraint specialty_inventory_ledger_reason_chk check (
    reason in ('batch', 'job_finished', 'adjustment', 'waste')
  ),
  constraint specialty_inventory_ledger_quantity_delta_chk check (quantity_delta <> 0)
);

create unique index if not exists specialty_inventory_ledger_job_item_reason_uidx
  on public.specialty_inventory_ledger (job_id, item_slug, reason);

create index if not exists specialty_inventory_ledger_processor_item_created_idx
  on public.specialty_inventory_ledger (processor_id, item_slug, created_at desc);

create index if not exists specialty_inventory_ledger_processor_created_idx
  on public.specialty_inventory_ledger (processor_id, created_at desc);

create or replace function public.record_specialty_inventory_finished_job()
returns trigger
language plpgsql
as $$
declare
  old_ready boolean := false;
  new_ready boolean := false;
begin
  old_ready := lower(coalesce(old.specialty_status, '')) ~ '(finish|ready|complete|completed|done|called)';
  new_ready := lower(coalesce(new.specialty_status, '')) ~ '(finish|ready|complete|completed|done|called)';

  if not coalesce(new.specialty_products, false) then
    return new;
  end if;

  if not new_ready or old_ready then
    return new;
  end if;

  if lower(coalesce(new.specialty_status, '')) = 'picked up' then
    return new;
  end if;

  insert into public.specialty_inventory_ledger (
    processor_id,
    job_id,
    tag,
    item_slug,
    item_name,
    short_name,
    quantity_delta,
    reason,
    note
  )
  select
    new.processor_id,
    new.id,
    new.tag,
    jsi.item_slug,
    jsi.item_name,
    jsi.short_name,
    -abs(coalesce(jsi.quantity, 0)),
    'job_finished',
    'Auto deducted when specialty job was marked finished'
  from public.job_specialty_items jsi
  where jsi.job_id = new.id
    and coalesce(jsi.quantity, 0) > 0
  on conflict (job_id, item_slug, reason) do nothing;

  return new;
end;
$$;

drop trigger if exists jobs_specialty_inventory_finished on public.jobs;

create trigger jobs_specialty_inventory_finished
after update of specialty_status on public.jobs
for each row
execute function public.record_specialty_inventory_finished_job();
