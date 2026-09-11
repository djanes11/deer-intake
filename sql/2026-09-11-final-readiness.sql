-- Apply AFTER 2026-09-11-opening-weekend-safety.sql and BEFORE deploying this release.
begin;

create or replace function public.advance_job_write_version()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Print bookkeeping is not an intake edit. All other changes still invalidate snapshots.
  if (to_jsonb(new) - array['updated_at','intake_sheet_printed_at','intake_sheet_print_count'])
     is not distinct from (to_jsonb(old) - array['updated_at','intake_sheet_printed_at','intake_sheet_print_count'])
     and (new.intake_sheet_printed_at is distinct from old.intake_sheet_printed_at
       or new.intake_sheet_print_count is distinct from old.intake_sheet_print_count) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := greatest(clock_timestamp(), coalesce(old.updated_at, '-infinity'::timestamptz) + interval '1 microsecond');
  end if;
  return new;
end;
$$;

-- Check/reuse/publish checkout links under the same job lock used by saves and webhooks.
-- With no URL this is a preflight; after Square responds the entire check runs again.
create or replace function public.publish_square_checkout(
  p_job_id uuid, p_processor_id uuid, p_expected_price numeric, p_expected_paid numeric, p_link jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  job public.jobs%rowtype;
  existing public.square_payment_links%rowtype;
  saved public.square_payment_links%rowtype;
  retired jsonb;
begin
  select * into job from public.jobs where id = p_job_id
    and processor_id is not distinct from p_processor_id for update;
  if not found or job.pending_deleted_at is not null or not coalesce(job.webbs_order, false)
    or coalesce(job.paid_processing, false)
    or job.price_processing is distinct from p_expected_price
    or coalesce(job.amount_paid_processing, 0) is distinct from p_expected_paid
    or round((job.price_processing - coalesce(job.amount_paid_processing, 0)) * 100) <= 0 then
    raise exception 'The balance changed. Refresh the intake before paying.' using errcode = '40001';
  end if;
  if p_link->>'square_environment' not in ('sandbox', 'production')
    or (p_link->>'processing_amount_cents')::integer is distinct from round((job.price_processing - coalesce(job.amount_paid_processing, 0)) * 100)::integer
    or (p_link->>'amount_cents')::integer is distinct from ((p_link->>'processing_amount_cents')::integer + (p_link->>'online_fee_cents')::integer) then
    raise exception 'Invalid checkout amount or environment' using errcode = '22023';
  end if;
  select * into existing from public.square_payment_links
    where job_id = job.id and status in ('pending', 'created', 'open') for update;
  if found and existing.square_environment = p_link->>'square_environment'
    and existing.amount_cents = (p_link->>'amount_cents')::integer
    and existing.processing_amount_cents = (p_link->>'processing_amount_cents')::integer
    and existing.online_fee_cents = (p_link->>'online_fee_cents')::integer
    and nullif(existing.square_checkout_url, '') is not null then
    return jsonb_build_object('checkoutUrl', existing.square_checkout_url, 'reused', true);
  end if;
  if nullif(p_link->>'square_checkout_url', '') is null then
    return jsonb_build_object('needsCreation', true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', square_payment_link_id, 'environment', square_environment)), '[]'::jsonb)
    into retired from public.square_payment_links where job_id = job.id and status in ('pending', 'created', 'open', 'approved');
  update public.square_payment_links set status = 'superseded', updated_at = clock_timestamp()
    where job_id = job.id and status in ('pending', 'created', 'open', 'approved');
  insert into public.square_payment_links (
    job_id, processor_id, tag, confirmation, customer_name, amount_cents, processing_amount_cents,
    online_fee_cents, currency, status, square_environment, square_payment_link_id, square_order_id,
    square_checkout_url, square_long_url, idempotency_key, raw_create_response
  ) values (
    job.id, job.processor_id, job.tag, job.confirmation, job.customer_name,
    (p_link->>'amount_cents')::integer, (p_link->>'processing_amount_cents')::integer,
    (p_link->>'online_fee_cents')::integer, 'USD', 'pending', p_link->>'square_environment',
    p_link->>'square_payment_link_id', p_link->>'square_order_id', p_link->>'square_checkout_url',
    p_link->>'square_long_url', p_link->>'idempotency_key', p_link->'raw_create_response'
  ) returning * into saved;
  return jsonb_build_object('checkoutUrl', saved.square_checkout_url, 'reused', false, 'retired', retired);
end;
$$;
revoke all on function public.publish_square_checkout(uuid, uuid, numeric, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.publish_square_checkout(uuid, uuid, numeric, numeric, jsonb) to service_role;

commit;
