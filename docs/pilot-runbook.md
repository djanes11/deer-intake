# Pilot Runbook

This runbook is for the first live week with a processor.

## Daily Pre-Open Check

- Confirm the public site loads.
- Confirm staff login works.
- Confirm `/search` loads.
- Confirm `/reports/print-queue` loads.
- Confirm SMS/email health if enabled.
- Print one sample sheet if the shop depends on printers that day.

## Day-One Walkthrough

Run this with the owner or manager present:

1. Open the public intake form on a phone.
2. Submit a test deer.
3. Open the overnight/public intake review queue.
4. Assign the permanent tag.
5. Print paperwork.
6. Search for the deer by tag and by customer.
7. Show the status page lookup flow.
8. If scanning is enabled, scan through at least one status transition.
9. Show the pickup queue and payment entry flow.

## Fallback Rules

If texting fails:

- continue using intake/search normally
- switch to call/email/manual communication
- log affected customers for resend later

If printing fails:

- continue intake and search
- use on-screen review and reprint later
- move jobs into the print queue once printing is restored

If scanning fails:

- continue using intake and search for status updates
- do not block production-floor work on scanner recovery

## First-Week Monitoring

Check these every day:

- public intake submissions
- pending tag queue
- print queue count
- ready-to-call count
- called/pickup queue count
- notification failures
- staff questions or repeated confusion points

## Pilot Review Questions

Ask the processor:

- What took fewer steps than your old workflow?
- What still felt slow or confusing?
- What did seasonal staff struggle with?
- What broke trust?
- What did customers ask about that the software did not answer?

Document answers the same day while details are fresh.
