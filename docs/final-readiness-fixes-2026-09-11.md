# Final readiness fixes — September 11, 2026

All seven findings from the final project review have local fixes. The database migration and deployment below are still required for the live sites.

1. Order edits recalculate affected processing and specialty charges and derive the total from those components. Unchanged historical charges and explicit overrides are preserved. Removing an override returns the order to automatic pricing. The intake screen and server share the price-selection rules.
2. Read/print permissions require a staff role, and processor endpoints require a resolved processor ID. A valid Supabase account without active membership no longer receives access through the default-processor fallback. Existing platform-administrator exceptions for settings/team management are retained.
3. Square link reuse checks the environment as well as all charge components. An incompatible active link is retired atomically before inserting its replacement.
4. Checkout creation checks the current balance under a job lock both before contacting Square and before publishing the returned URL. A payment during that request rejects the stale checkout. Concurrent requests reuse the winning checkout; unused remote links are cancelled. Cancellation failures are logged with the link ID for reconciliation, and rejected new URLs are not returned to customers. Existing links from another environment cannot be cancelled using the current environment's credentials.
5. A shared staff-session component synchronizes refreshed email-login tokens to the API cookie. Writes are ordered and temporary failures are retried. Background synchronization does not replace a local-username login, and login/logout pages retain their own session handling.
6. The database version trigger preserves the loaded intake version for changes limited to print bookkeeping. Customer, payment, order, and status edits still invalidate stale forms. No conflict checks were removed.
7. Intake printing from intake, search, overnight review, and the print queue now asks whether sheets printed successfully. The printed marker is saved only after confirmation. Cancelling the confirmation leaves sheets awaiting printing; a partially successful batch can be retried by individual tag.

## Rollout

1. In the intended Supabase SQL editor, apply `sql/2026-09-11-final-readiness.sql`. The previous `2026-09-11-opening-weekend-safety.sql` must already be applied. This follow-up replaces the version-trigger function and adds `publish_square_checkout`; it does not clear records or change Square's environment. If rerunning the older migration later, run this follow-up after it again.
2. Verify the function and permissions:

```sql
select to_regprocedure('public.publish_square_checkout(uuid,uuid,numeric,numeric,jsonb)') as checkout_function;
select has_function_privilege('anon', 'public.publish_square_checkout(uuid,uuid,numeric,numeric,jsonb)', 'execute') as anonymous_access,
       has_function_privilege('authenticated', 'public.publish_square_checkout(uuid,uuid,numeric,numeric,jsonb)', 'execute') as browser_access;
```

The function must be present and both access flags false.

3. Deploy this checkout to the staff and public sites after applying the SQL, then reload open staff screens. Keep Square in sandbox for the rehearsal.
4. With designated test records, verify an order price change, save → print → edit → save, cancelled print recovery, and checkout after a partial payment. Confirm an active staff login still works and a removed membership cannot retrieve records. A physical printer and a live email-login session across token refresh still need operational verification.

## Validation and limits

All ten smoke suites and the production build passed. New coverage includes price/override/add-on/specialty changes, role denials, token refresh ordering/retry/local-login preservation, confirmed/cancelled/failed printing, print-only database versions, sandbox-to-production link replacement, duplicate checkout requests, and a payment between preflight and publication. SQL tests execute the actual migrations in isolated PGlite; they verify transactional outcomes and conflict guards, not production throughput. No real payments or production records were used.

The Square cancellation implementation follows the official [Delete payment link endpoint](https://developer.squareup.com/reference/square/checkout-api/delete-payment-link). No production credentials were installed or switched during this work. Database cleanup and the production Square transition remain separate follow-up work.
