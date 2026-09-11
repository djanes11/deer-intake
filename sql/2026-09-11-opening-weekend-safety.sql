-- Apply before deploying the opening-weekend safety release.
-- Requires the jobs, specialty catalog, and Square payment-link migrations.
begin;

-- Every writer (including legacy RPCs and webhooks) invalidates stale intake screens.
create or replace function public.advance_job_write_version()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := greatest(clock_timestamp(), coalesce(old.updated_at, '-infinity'::timestamptz) + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists zz_jobs_write_version on public.jobs;
create trigger zz_jobs_write_version before update on public.jobs
for each row execute function public.advance_job_write_version();

create or replace function public.save_job_guarded(
  p_job_id uuid, p_processor_id uuid, p_expected_updated_at timestamptz,
  p_payload jsonb, p_specialty_items jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  current_job public.jobs%rowtype;
  saved_job public.jobs%rowtype;
  column_list text;
  item jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' or p_payload = '{}'::jsonb then
    raise exception 'Missing job payload' using errcode = '22023';
  end if;
  if p_job_id is not null then
    select * into current_job from public.jobs
      where id = p_job_id and processor_id is not distinct from p_processor_id for update;
    if not found or current_job.pending_deleted_at is not null
      or current_job.updated_at is distinct from p_expected_updated_at then
      raise exception 'Job changed; reload before saving' using errcode = '40001';
    end if;
    if current_job.tag is distinct from (p_payload->>'tag') then
      raise exception 'Tag changes require a separate assignment' using errcode = '40001';
    end if;
  end if;

  -- Only the server's service-role connection may call this function. Quoted column
  -- names and jsonb_populate_record keep values out of dynamic SQL.
  p_payload := (p_payload - 'id' - 'created_at' - 'updated_at') || jsonb_build_object('processor_id', p_processor_id);
  select string_agg(format('%I', key), ', ' order by key) into column_list
    from jsonb_object_keys(p_payload) as keys(key);
  if p_job_id is null then
    execute format('insert into public.jobs (%1$s) select %1$s from jsonb_populate_record(null::public.jobs, $1) returning *', column_list)
      into saved_job using p_payload;
  else
    saved_job := current_job;
  end if;

  -- Keep order items and the job in the same transaction. Update items before the
  -- status so inventory triggers see the quantities actually saved with this edit.
  if p_specialty_items is not null then
    if jsonb_typeof(p_specialty_items) <> 'array' then
      raise exception 'Invalid specialty items' using errcode = '22023';
    end if;
    delete from public.job_specialty_items where job_id = saved_job.id;
    for item in select value from jsonb_array_elements(p_specialty_items) loop
      insert into public.job_specialty_items (
        job_id, processor_id, processor_specialty_item_id, item_slug, item_name,
        short_name, unit, price_type, quantity, unit_price, total_price, sort_order
      ) values (
        saved_job.id, p_processor_id, nullif(item->>'catalogId', '')::uuid,
        item->>'slug', item->>'name', item->>'shortName', item->>'unit', item->>'priceType',
        (item->>'quantity')::numeric, (item->>'pricePerUnit')::numeric,
        (item->>'total')::numeric, (item->>'sortOrder')::integer
      );
    end loop;
  end if;

  if p_job_id is not null then
    execute format('update public.jobs set (%1$s) = (select %1$s from jsonb_populate_record(null::public.jobs, $1)) where id = $2 returning *', column_list)
      into saved_job using p_payload, p_job_id;
    -- Retire checkout links when a staff save changes the processing balance.
    -- Job-before-link locking is shared with the webhook to avoid deadlocks.
    if saved_job.amount_paid_processing is distinct from current_job.amount_paid_processing
      or saved_job.price_processing is distinct from current_job.price_processing then
      update public.square_payment_links set status = 'superseded', updated_at = clock_timestamp()
        where job_id = saved_job.id and status in ('pending', 'created', 'open', 'approved');
    end if;
  end if;
  return to_jsonb(saved_job);
end;
$$;
revoke all on function public.save_job_guarded(uuid, uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_job_guarded(uuid, uuid, timestamptz, jsonb, jsonb) to service_role;

alter table public.square_payment_links
  add column if not exists credited_at timestamptz,
  add column if not exists credited_payment_id text;
create unique index if not exists square_payment_links_credited_payment_uidx
  on public.square_payment_links(credited_payment_id) where credited_payment_id is not null;

-- Old completed payments were already applied by the old handler. Do not add them
-- again when Square retries. Historical partial-payment discrepancies need review.
update public.square_payment_links
  set credited_at = coalesce(completed_at, updated_at, now())
  where status = 'completed' and credited_at is null;

create or replace function public.apply_square_processing_payment(
  p_order_id text, p_payment_id text, p_status text, p_amount_cents bigint,
  p_currency text, p_event_type text, p_event jsonb
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  link public.square_payment_links%rowtype;
  job public.jobs%rowtype;
  next_paid numeric;
  processing_credit numeric;
  processing_paid boolean;
  specialty_paid boolean;
  result_status text;
begin
  select * into link from public.square_payment_links where square_order_id = p_order_id;
  if not found then return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'unknown_order'); end if;
  select * into job from public.jobs where id = link.job_id for update;
  if not found then raise exception 'Payment job missing'; end if;
  select * into link from public.square_payment_links where id = link.id for update;
  if link.processor_id is distinct from job.processor_id then raise exception 'Payment processor mismatch'; end if;

  -- Covers an old webhook finishing between migration and application deployment.
  -- The new handler never commits a completed link without its credit marker.
  if link.status = 'completed' and link.credited_at is null then
    update public.square_payment_links set credited_at = coalesce(completed_at, updated_at, clock_timestamp()) where id = link.id;
    return jsonb_build_object('ok', true, 'status', 'completed', 'alreadyApplied', true, 'legacyPayment', true);
  end if;

  if link.credited_at is not null then
    return jsonb_build_object('ok', true, 'status', link.status, 'alreadyApplied', true,
      'needsReview', p_status = 'COMPLETED' and link.credited_payment_id is not null and link.credited_payment_id <> p_payment_id);
  end if;

  if p_status <> 'COMPLETED' then
    -- Preserve retired and completed states when events arrive out of order.
    update public.square_payment_links set last_event_type = p_event_type,
      last_event_at = clock_timestamp(), raw_last_event = p_event, updated_at = clock_timestamp()
      where id = link.id;
    return jsonb_build_object('ok', true, 'status', link.status);
  end if;

  if link.status in ('superseded', 'cancelled', 'canceled', 'voided', 'completed_after_superseded') then
    result_status := 'completed_after_superseded';
  elsif p_currency is distinct from link.currency or p_amount_cents is distinct from link.amount_cents::bigint
    or coalesce(link.processing_amount_cents, 0) <= 0 then
    result_status := 'completed_amount_mismatch';
  else
    result_status := 'completed';
  end if;

  update public.square_payment_links set status = result_status, square_payment_id = p_payment_id,
    last_event_type = p_event_type, last_event_at = clock_timestamp(), raw_last_event = p_event,
    completed_at = coalesce(completed_at, clock_timestamp()), updated_at = clock_timestamp() where id = link.id;
  if result_status <> 'completed' then
    return jsonb_build_object('ok', true, 'status', result_status, 'needsReview', true);
  end if;

  processing_credit := link.processing_amount_cents / 100.0;
  next_paid := coalesce(job.amount_paid_processing, 0) + processing_credit;
  processing_paid := next_paid >= coalesce(job.price_processing, 0);
  specialty_paid := coalesce(job.amount_paid_specialty, 0) >= coalesce(job.price_specialty, 0);
  update public.jobs set amount_paid_processing = next_paid, paid_processing = processing_paid,
    payment_method_processing = 'card',
    paid_processing_at = case when processing_paid then coalesce(paid_processing_at, clock_timestamp()) else null end,
    paid = processing_paid and specialty_paid
    where id = job.id;
  update public.square_payment_links set credited_at = clock_timestamp(), credited_payment_id = p_payment_id where id = link.id;
  return jsonb_build_object('ok', true, 'status', 'completed', 'amountPaidProcessing', next_paid,
    'needsReview', next_paid > coalesce(job.price_processing, 0));
end;
$$;
revoke all on function public.apply_square_processing_payment(text, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_square_processing_payment(text, text, text, bigint, text, text, jsonb) to service_role;

commit;
