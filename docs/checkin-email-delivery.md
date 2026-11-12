# Checked-in email delivery

Apply `sql/2026-11-11-checkin-email-deduplication.sql` in Supabase **before deploying** this release. It adds a service-role-only reservation table and seeds it from existing sent timestamps. It does not change deer records or send messages. The migration is safe to rerun.

Automatic checked-in emails reserve the deer ID before contacting SMTP. A primary key permits only one automatic attempt across requests and application instances. Intake saves, status changes, and tag corrections cannot release that reservation. Existing public links use the permanent public token and resolve the current tag, so tag correction does not require another email.

SMTP and Postgres cannot commit together. A timeout or worker interruption may leave delivery uncertain. We retain the reservation to avoid duplicates. Check delivery before deliberately using Search's notification resend action. Reset Flags alone does not release the automatic checked-in email reservation. Other notification events and SMS behavior are unchanged.

To inspect uncertain/incomplete attempts without changing data:

```sql
select j.tag, d.state, d.attempted_at, d.sent_at, j.dropoff_email_sent_at
from public.job_checkin_email_delivery d
join public.jobs j on j.id = d.job_id
where d.state <> 'sent'
order by d.attempted_at desc;
```

The sent timestamp means the mail server accepted the send, not proof of inbox delivery. Explicit staff resends intentionally can send another message. A manual resend may resolve an uncertain attempt without changing its reservation record.

Local regression tests exercise simultaneous automatic requests, repeated saves, a changed tag with the same public token, ambiguous SMTP failures, missing migration behavior, and the public token redirect. They do not send actual email or modify production records.
