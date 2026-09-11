# Opening-weekend fixes — September 11, 2026

All six source-code findings from the review are addressed. The state-form test and configurable public confirmation gaps are also addressed. These changes are local and require the database migration and deployment below before they protect the live shop.

## Changed behavior

- Public intake accepts an explicit set of customer/order selections. Prices and specialty/add-on item values come from the server catalog. Public requests cannot set payments, pickup flags, identity, arbitrary statuses, or notification stamps.
- New staff intake inserts a new record. Reusing a tag or confirmation returns a conflict instead of overwriting a deer. Editing requires the saved job ID and loaded version. Tag changes through the ordinary editor are rejected.
- Every database update advances the job version. Full edits use a locked, version-checked transaction that also saves specialty items. A conflicting edit is rejected with a persistent reload message. Operational buttons use a separate, limited patch path and do not rewrite customer, pricing, or unrelated workflow fields. Payment screens pass the version they displayed.
- Pending tag assignment succeeds only while the row is still pending and retains its original pending tag. The losing station refreshes its queue and shows the conflict.
- Scanning receives the same processor context that the API authorized, with a version check on progression.
- Square completion credits the processing portion once, in a transaction with the payment-link marker. A $50 deposit plus $100 online toward a $150 processing bill is fully paid; the online fee is excluded. Retries cannot double-credit. Retired or mismatched payments require reconciliation, and stale events cannot reopen a completed link. Staff balance changes retire active links in the same save transaction.
- Public confirmation validation follows the shop's configured format instead of forcing 13 digits for every untagged intake.
- State-form tests now run in the smoke command and render all three supported forms across a pagination boundary. Printed text fits its field; the Indiana area code is included. Generated reports do not retain form widgets that can obscure painted text. Original form templates remain unchanged.

## Validation

Run `npm run test:smoke` and `npm run build` before rollout.

The smoke command includes nine suites: identifiers, site settings, processor catalog, specialty, public intake safety, state forms, job write safety, database safety, and client writes.

Database tests use an isolated, in-memory PostgreSQL runtime (PGlite) and the actual new migration. They check duplicate creates, competing edits with the same version, cross-processor writes, specialty-write rollback, competing tag assignments, deposits and online settlement, duplicate/out-of-order/retired payment events, amount/currency mismatch, rollback after a final credit-marker failure, migration reruns, and legacy completed payments. PGlite serializes connections; this validates the SQL conflict conditions and transactional outcomes, not production load capacity.

Sample Indiana, Ohio, and Michigan reports were generated and visually inspected, including overflow pages. Tests assert pagination and preserve complete confirmation text within its cell. No production customer records, payments, messages, or hardware were used for testing.

## Deployment order

1. Confirm a current database backup and the previously deployed release. Coordinate a short release window so staff can finish open intakes.
2. Confirm the earlier specialty-catalog and Square-payment migrations are present. Apply `sql/2026-09-11-opening-weekend-safety.sql` to the intended Supabase database. It is transactional and repeatable; it adds the guarded-save RPC, the job-version trigger, and Square credit markers/RPC. The two RPCs are executable by `service_role` only, not public or signed-in browser clients.
3. Check the migration using these read-only queries in the SQL editor:

```sql
select to_regprocedure('public.save_job_guarded(uuid,uuid,timestamp with time zone,jsonb,jsonb)') as guarded_save,
       to_regprocedure('public.apply_square_processing_payment(text,text,text,bigint,text,text,jsonb)') as square_payment;

select tgname, tgenabled from pg_trigger
where tgrelid = 'public.jobs'::regclass and tgname = 'zz_jobs_write_version';

select has_function_privilege('anon', 'public.save_job_guarded(uuid,uuid,timestamptz,jsonb,jsonb)', 'execute') as anonymous_save,
       has_function_privilege('authenticated', 'public.apply_square_processing_payment(text,text,text,bigint,text,text,jsonb)', 'execute') as browser_payment;
```

Both function names must be present; the trigger must be enabled; both browser privilege checks must be false.

4. Deploy the application release containing these changes to the staff and public deployments that use this database. Do not deploy the new code before the migration; saves and Square callbacks require the new functions. Existing open staff forms should be reloaded after deployment.
5. Complete the phone intake → tag → print → scan → customer status → payment → pickup rehearsal in the existing pilot runbook. Check the local-staff login and selected processor, and repeat the two-station conflict checks with designated test records. Use Square sandbox for deliberate duplicate-payment tests.
6. Review the Square reconciliation report for historical partial-payment discrepancies. The migration deliberately does not add money again to previously completed payments. Historical amounts should be corrected only against actual receipts; they are not inferred from insufficient old payment history.

## Rollback and shop fallback

Keep the additive migration and payment markers if rolling application code back. Do not drop payment-credit markers or rewrite old payment totals. Rolling back the application restores the old behavioral risks, so pause affected intake/payment workflows and use the paper fallback until the corrected release is restored.

Before opening, the shop still needs to verify its actual backup/restore access, live credentials/webhook delivery, printer and scanner, current prices/hours, and a named support contact. These cannot be established by a local code build. Keep numbered paper intake sheets available and designate one person to enter them when service returns, checking each tag and confirmation for duplicates first.
