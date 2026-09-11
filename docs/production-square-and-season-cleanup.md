# Production Square and season preparation

Status: preparation only. No hosting settings or database records have been changed.

## Square settings used by this application

Set these as server-side environment variables on the deployment serving customer checkout and its webhook. Use the Square application's Production environment in the Developer Console:

| Variable | Production value |
| --- | --- |
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_ACCESS_TOKEN` | Production access token for the intended seller |
| `SQUARE_APPLICATION_ID` | Production application ID |
| `SQUARE_LOCATION_ID` | The intended seller's production processing location |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Signature key from the production webhook subscription |
| `SQUARE_WEBHOOK_URL` | Exact public HTTPS URL ending in `/api/square/webhook` registered in Square |

The current default API version is `2026-08-19`; keep any explicit `SQUARE_API_VERSION` and the subscription version aligned with the tested release. Subscribe to `payment.created` and `payment.updated`. Use an endpoint that does not require staff login or deployment-protection authentication. Redeploy after changing hosting environment variables. Do not place access tokens or webhook keys in `NEXT_PUBLIC_` variables, source control, or chat.

Square production credentials and webhook subscriptions are distinct from sandbox. Follow the official [production webhook steps](https://developer.squareup.com/docs/webhooks/movetoprod) and [credential guide](https://developer.squareup.com/docs/build-basics/access-tokens). The production account must be ready to accept payments. A successful dashboard test delivery only verifies endpoint delivery/signature handling; it does not establish that a real order was credited.

This application currently uses Square-hosted online checkout for the remaining regular processing balance on eligible public Webbs orders. It adds the configured **$6 online payment fee**. This switch does not add an in-person Square Terminal integration or collect specialty balances online. Confirm that these are the intended launch behaviors.

## Season cleanup preparation

Run `sql/season-preflight-readonly.sql` in the intended database to inspect processor counts, payment environments, specialty stock, state-form settings, and actual job dependencies. It does not delete or alter records.

Before constructing the final deletion script, identify the processor, whether every target record is test data, whether inventory should reset or carry forward, and whether the state-form starting page should change. Preserve accounts, memberships, processor settings, branding, catalogs/prices, and schema/functions. Customer lookup currently derives from jobs, so removing test jobs also removes those customer suggestions.

Deleting jobs cascades to linked specialty items, Square tracking, and job-linked inventory ledger entries in the checked-in schema. SMS logs use `ON DELETE SET NULL`, and activity logs are not job foreign keys; they require deliberate handling rather than assuming they disappear. Preserve useful administrative audit history. Confirm the live foreign keys before finalizing the script.

Obtain a current recoverable backup before deletion. Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) describes dashboard backups and logical exports. Database backups do not include uploaded Storage objects; this cleanup should not delete files or buckets.

Perform the approved cleanup during a pause in intake writes, before opening production checkout to customers. Use one transaction with explicit processor scope, expected record counts, and a guard against deleting production payment history. Retire sandbox webhook delivery to the live endpoint at cutover. Complete production configuration and verification afterward, so real launch transactions are not included in the test-data cleanup.
