update public.square_payment_links spl
set
  status = 'superseded',
  last_event_type = coalesce(spl.last_event_type, 'app.in_person_processing_payment'),
  last_event_at = coalesce(spl.last_event_at, now()),
  updated_at = now()
from public.jobs j
where spl.job_id = j.id
  and spl.status in ('pending', 'created', 'open')
  and spl.completed_at is null
  and spl.square_payment_id is null
  and coalesce(j.paid_processing, false) = true
  and lower(coalesce(j.payment_method_processing, '')) in ('cash', 'check', 'card', 'other');
