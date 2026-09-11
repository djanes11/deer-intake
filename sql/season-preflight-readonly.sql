-- READ ONLY. Run in the intended Supabase SQL editor before choosing a cleanup scope.
-- Returns counts/configuration only; no customer names, contact details, or credentials.
begin read only;

select p.id as processor_id, p.slug, p.name,
  (select count(*) from public.jobs j where j.processor_id = p.id) as deer_records,
  (select min(j.created_at) from public.jobs j where j.processor_id = p.id) as earliest_record,
  (select max(j.created_at) from public.jobs j where j.processor_id = p.id) as latest_record,
  (select count(*) from public.processor_users u where u.processor_id = p.id) as email_staff_memberships,
  (select count(*) from public.staff_local_users u where u.processor_id = p.id) as local_staff_accounts
from public.processors p order by p.slug;

select processor_id, square_environment, status, count(*) as links,
  count(*) filter (where credited_at is not null) as credited_links
from public.square_payment_links group by processor_id, square_environment, status
order by processor_id, square_environment, status;

select processor_id, item_slug, sum(quantity_delta) as current_stock,
  sum(quantity_delta) filter (where job_id is not null) as job_linked_movements,
  count(*) as ledger_entries
from public.specialty_inventory_ledger group by processor_id, item_slug
order by processor_id, item_slug;

select processor_id, stateform_page_number, state_form_type from public.site_settings;
select count(*) as deer_without_processor from public.jobs where processor_id is null;

-- Inspect the actual live relationships, including dependencies not in this checkout.
select conrelid::regclass as dependent_table, conname,
  pg_get_constraintdef(oid) as relationship
from pg_constraint where contype = 'f' and confrelid = 'public.jobs'::regclass
order by conrelid::regclass::text, conname;

select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger where tgrelid = 'public.jobs'::regclass and not tgisinternal;

commit;
