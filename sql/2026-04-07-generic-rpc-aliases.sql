create or replace function public.shared_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language sql
security definer
as $$
  select public.mcafee_rate_limit(p_bucket, p_limit, p_window_seconds);
$$;

create or replace function public.log_processor_call(
  p_tag text,
  p_scope text default null,
  p_reason text default null,
  p_notes text default null,
  p_outcome text default null
)
returns jsonb
language sql
security definer
as $$
  select public.mcafee_log_call(p_tag, p_scope, p_reason, p_notes, p_outcome);
$$;

create or replace function public.mark_processor_called(
  p_tag text,
  p_scope text default 'auto',
  p_notes text default null
)
returns jsonb
language sql
security definer
as $$
  select public.mcafee_mark_called(p_tag, p_scope, p_notes);
$$;
