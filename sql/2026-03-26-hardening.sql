create unique index if not exists jobs_confirmation_unique_idx
  on public.jobs (confirmation)
  where confirmation is not null and confirmation <> '';

create table if not exists public.api_rate_limits (
  bucket text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create or replace function public.mcafee_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_row public.api_rate_limits%rowtype;
begin
  loop
    update public.api_rate_limits
       set count = case when reset_at <= v_now then 1 else count + 1 end,
           reset_at = case when reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else reset_at end
     where bucket = p_bucket
     returning * into v_row;

    if found then
      exit;
    end if;

    begin
      insert into public.api_rate_limits (bucket, count, reset_at)
      values (p_bucket, 1, v_now + make_interval(secs => p_window_seconds))
      returning * into v_row;
      exit;
    exception
      when unique_violation then
        -- Retry if another request inserted the same bucket first.
    end;
  end loop;

  return jsonb_build_object(
    'allowed', v_row.count <= p_limit,
    'remaining', greatest(0, p_limit - v_row.count),
    'resetAt', floor(extract(epoch from v_row.reset_at) * 1000)
  );
end;
$$;

create or replace function public.mcafee_log_call(
  p_tag text,
  p_scope text default null,
  p_reason text default null,
  p_notes text default null,
  p_outcome text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job public.jobs%rowtype;
  v_note_line text;
begin
  select *
    into v_job
    from public.jobs
   where tag = p_tag
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Job not found');
  end if;

  insert into public.call_logs (
    job_id,
    tag,
    customer_name,
    phone,
    scope,
    reason,
    outcome,
    notes
  ) values (
    v_job.id,
    p_tag,
    v_job.customer_name,
    v_job.phone,
    nullif(p_scope, ''),
    nullif(p_reason, ''),
    nullif(p_outcome, ''),
    nullif(p_notes, '')
  );

  if nullif(trim(coalesce(p_notes, '')), '') is not null then
    v_note_line := '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' | ' ||
      coalesce(nullif(p_reason, ''), 'Call Attempt (' || coalesce(nullif(p_scope, ''), 'auto') || ')') ||
      '] ' || trim(p_notes);
  end if;

  update public.jobs
     set call_attempts = coalesce(call_attempts, 0) + 1,
         meat_attempts = case when p_scope = 'meat' then coalesce(meat_attempts, 0) + 1 else meat_attempts end,
         cape_attempts = case when p_scope = 'cape' then coalesce(cape_attempts, 0) + 1 else cape_attempts end,
         webbs_attempts = case when p_scope = 'webbs' then coalesce(webbs_attempts, 0) + 1 else webbs_attempts end,
         last_call_at = now(),
         last_call_outcome = coalesce(nullif(p_outcome, ''), last_call_outcome),
         call_notes = case
           when v_note_line is null then call_notes
           when nullif(trim(coalesce(call_notes, '')), '') is null then v_note_line
           else call_notes || E'\n' || v_note_line
         end,
         updated_at = now()
   where id = v_job.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.mcafee_mark_called(
  p_tag text,
  p_scope text default 'auto',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job public.jobs%rowtype;
  v_scope text := coalesce(nullif(p_scope, ''), 'auto');
  v_meat_ready boolean;
  v_cape_ready boolean;
  v_webbs_ready boolean;
  v_note_line text;
begin
  select *
    into v_job
    from public.jobs
   where tag = p_tag
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Job not found');
  end if;

  v_meat_ready := coalesce(lower(v_job.status), '') ~ '(finish|ready|complete|completed|done)' and coalesce(lower(v_job.status), '') <> 'called';
  v_cape_ready := coalesce(lower(v_job.caping_status), '') ~ '(ready|complete|completed|done|caped)' and coalesce(lower(v_job.caping_status), '') <> 'called';
  v_webbs_ready := coalesce(lower(v_job.webbs_status), '') ~ '(ready|complete|completed|done|delivered)' and coalesce(lower(v_job.webbs_status), '') <> 'called';

  if v_scope = 'auto' then
    if v_webbs_ready then
      v_scope := 'webbs';
    elsif v_cape_ready then
      v_scope := 'cape';
    else
      v_scope := 'meat';
    end if;
  end if;

  if nullif(trim(coalesce(p_notes, '')), '') is not null then
    v_note_line := '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' | Marked Called (' || v_scope || ')] ' || trim(p_notes);
  end if;

  update public.jobs
     set status = case
           when v_scope = 'all' and v_meat_ready then 'Called'
           when v_scope = 'meat' then 'Called'
           else status
         end,
         caping_status = case
           when v_scope = 'all' and v_cape_ready then 'Called'
           when v_scope = 'cape' then 'Called'
           else caping_status
         end,
         webbs_status = case
           when v_scope = 'all' and v_webbs_ready then 'Called'
           when v_scope = 'webbs' then 'Called'
           else webbs_status
         end,
         call_attempts = coalesce(call_attempts, 0) + 1,
         meat_attempts = case when v_scope = 'meat' then coalesce(meat_attempts, 0) + 1 else meat_attempts end,
         cape_attempts = case when v_scope = 'cape' then coalesce(cape_attempts, 0) + 1 else cape_attempts end,
         webbs_attempts = case when v_scope = 'webbs' then coalesce(webbs_attempts, 0) + 1 else webbs_attempts end,
         last_call_at = now(),
         call_notes = case
           when v_note_line is null then call_notes
           when nullif(trim(coalesce(call_notes, '')), '') is null then v_note_line
           else call_notes || E'\n' || v_note_line
         end,
         updated_at = now()
   where id = v_job.id;

  insert into public.call_logs (
    job_id,
    tag,
    customer_name,
    phone,
    scope,
    reason,
    outcome,
    notes
  ) values (
    v_job.id,
    p_tag,
    v_job.customer_name,
    v_job.phone,
    v_scope,
    'Marked Called (' || v_scope || ')',
    null,
    nullif(p_notes, '')
  );

  return jsonb_build_object('ok', true, 'tag', p_tag, 'scope', v_scope);
end;
$$;
