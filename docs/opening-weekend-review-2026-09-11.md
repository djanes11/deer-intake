# Opening-weekend readiness review — September 11, 2026

Update: the code findings below have been addressed locally. See [fixes and rollout instructions](opening-weekend-fixes-2026-09-11.md). The original review is retained below; deployment and hardware verification are separate remaining steps.

Recommendation: finish the record-integrity and public-intake fixes below before relying on the app for opening-weekend volume. Fix the Square issue before accepting online balances. These are findings from local source review; they were not reproduced against production customer records.

## Verification

- `npm run test:smoke`: passed all five registered suites.
- `npm run build`: passed compilation, TypeScript, page generation, and finalization.
- The separate state-form smoke suite is not registered in `smoke-tests/run.ts`. Running it directly failed because the Node strip-types runner treats the `Rect` import in `lib/stateforms/indiana.ts` as a runtime import. This is a test-runner issue; it does not establish that production PDF rendering fails.
- No application code was changed. No production writes, customer messages, payments, or hardware tests were performed.
- Production migration state, deployed version, credentials, backups, and actual printer/scanner behavior remain unverified.

## Findings to resolve

### 1. P1 — Public intake accepts staff-controlled price, payment, and workflow fields

Location: `app/api/public-drop/route.ts:174`, with persistence in `lib/jobsSupabase.ts:2589` onward.

The public endpoint spreads the submitted object into `saveJob`, preserving fields such as `processing_price_override`, `priceProcessing`, `amountPaidProcessing`, and pickup flags. It also explicitly accepts the submitted status. The shared saver trusts these values. A crafted public submission can therefore mark its own order paid or picked up, or set its processing price to zero, without staff authorization or a Square payment.

Finish: build an explicit public-input allowlist, calculate prices from the configured server catalog, and initialize payments, pickup flags, statuses, and notification stamps on the server. Treat item prices and totals inside nested order items as untrusted too.

Verify: submit a valid test intake with forged payment, price, and pickup fields; the saved record must retain the correct catalog price and unpaid/uncollected initial state.

### 2. P1 — A reused tag can overwrite another customer's intake

Location: `lib/jobsSupabase.ts:2448` and `lib/jobsSupabase.ts:2770`; caller: `app/intake/page.tsx:1092` onward.

The staff intake form sends the same save request for new and existing deer. The server identifies an existing record by tag, merges the submitted fields into it, and upserts on that tag. There is no distinction between creating a new deer and intentionally editing the existing deer. Entering an already-used tag on a fresh intake can replace the earlier customer's information and order instead of returning “tag already in use.” A unique tag index does not protect this path because the upsert intentionally updates the conflict.

Finish: separate create from update; reject duplicate tags on create and require a stable job ID on edits. Handle intentional tag changes explicitly.

Verify: create deer A, then attempt a fresh deer B with A's tag and a different valid confirmation. B must be rejected and every field of A must remain unchanged.

### 3. P1 — An older intake screen can overwrite newer payments and status

Location: `lib/jobsSupabase.ts:2465` and `lib/jobsSupabase.ts:2770`; full-form payload in `app/intake/page.tsx:1092` onward.

An intake save submits the full loaded job, including payment amounts and status. Although the server rereads the current record, it spreads the submitted job over that record and writes it without a version check. If a second station records a payment or advances processing after the first station loaded the intake, saving a notes or cutting change from the first station can restore the old unpaid amount or old status. The same risk applies to a Square webhook arriving while the form is open.

Finish: add an atomic version/updated-at condition and a clear reload/conflict message, and isolate payment/status updates from unrelated intake edits.

Verify: open the same deer on two stations, record payment and advance status on one, then save a cutting change on the other. The newer payment and status must survive, or the stale save must be rejected.

### 4. P1 if Square is enabled — Paying the remaining online balance leaves a false amount due

Location: `app/api/square/webhook/route.ts:120`; link amount calculation: `app/api/square/create-processing-payment-link/route.ts:71`.

The payment link charges the remaining balance. The webhook records the maximum of the existing paid amount and that remaining-balance payment, rather than crediting the new payment once. Example: $150 processing, $50 already paid, and a $100 processing payment online results in $100 recorded as paid and $50 still due, even though the customer paid the full $150. The online fee is separate.

Finish: apply each completed payment exactly once in an atomic transaction, preserving prior payments and handling webhook retries. Do not simply add on every delivery, which would double-credit retries.

Verify: a deposit followed by online settlement marks processing fully paid; replaying the same event does not change the total again.

### 5. P1 with multiple intake stations — A stale public queue can reassign an already-assigned deer

Location: `lib/jobsSupabase.ts:4002`–`4109`, particularly the update at line 4067.

`setJobTag` checks whether the proposed tag belongs to another job, but does not require the target job still to be pending or still to have its original pending tag. If two stations open the same public intake, the first can assign and print tag 101, and the second can later assign tag 102 from its stale queue. Both assignments can succeed; the physical paperwork for tag 101 then disagrees with the saved record. Different proposed tags do not violate the unique index.

Finish: assign only with an atomic condition that the row still requires a tag and has the expected pending identity/version; return a conflict and refresh the queue otherwise. Keep deliberate retagging in a separate workflow.

Verify: two simultaneous assignments of different tags to the same pending job produce exactly one success.

### 6. P2 — Scan progression can use a different processor from authorization

Location: `app/api/v2/jobs/route.ts:166`, `lib/jobsSupabase.ts:2813`, and `lib/processorContext.ts:72` onward.

The route resolves and authorizes `processorContext`, but calls `progressJob(finalTag)` without it. That function resolves a default context again. The default resolver does not use local-staff session identity and does not honor the selected processor the same way the permission resolver does. For local staff on a shared hostname, or a user with several processor memberships, scanning can look up the wrong processor's tag or fail to find the correct deer.

Finish: pass the authorized processor context into progression, consistently with save, search, and tag assignment.

Verify: test local staff and a multi-membership login with identical tag numbers in two test processors; only the selected authorized processor may change.

## Smaller readiness gaps

- Wire the state-form suite into the smoke command and correct the type-only imports so it runs. The current green smoke command does not check the registry despite the README's coverage claim. Also generate and inspect an actual test PDF.
- Public identifier settings allow configurable confirmation formats, but `saveJob` still requires exactly 13 digits when the tag is missing (`lib/jobsSupabase.ts:2440`). Any shop using another configured length needs that inconsistency fixed before public intake opens; a 13-digit configuration avoids this particular issue.

## Final rehearsal before opening

Use controlled test records on the actual deployed shop setup, with the owner or manager present:

1. Confirm the deployed release matches the reviewed code and required SQL migrations are applied, including the public token uniqueness, payment tracking, and specialty inventory migrations if those features are used.
2. Complete public intake on a phone, assign a tag, print the intake sheet and label, scan the label, search by customer/tag, and open customer status.
3. Test the concurrency cases above on two devices.
4. Verify one approved notification and the failure/resend workflow, then finish payment and pickup. Use the appropriate Square test setup for payment scenarios.
5. Check business hours, intake availability, prices, tag starting number, staff permissions, and the configured state-form output.
6. Confirm a recent database backup and recovery owner, the last known good deployment, a support contact, and a written paper-intake procedure if internet or the application is unavailable. Test the printer/scanner fallback and later entry of paper records without duplicate tags.

The existing pilot onboarding checklist and runbook cover much of the single-record rehearsal. The main additional opening-weekend work is protecting records when several people are working at once and verifying the deployed integrations and hardware.
