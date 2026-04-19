# Deer Intake

Deer Intake is a deer-first, wild-game-expandable operations app for processors. It combines:

- public intake before drop-off
- staff intake and search
- tag assignment and print queue
- scan-driven processing flow
- customer status lookup
- notifications
- pickup/payment tracking
- owner reporting
- multi-processor configuration

It is intentionally **not** positioned as livestock software for cattle, pigs, or poultry.

## Product Scope

Current target:

- deer processors in the U.S.
- shops that only use cell phones
- shops using labels and scanners
- processors that may expand into other wild game later

Out of scope:

- cattle/pork/chicken production workflows
- full slaughterhouse/USDA livestock ERP behavior

## Core Commands

```bash
npm run dev
npm run build
npm run test:smoke
```

## Pilot Readiness

Before inviting processors into a pilot, run:

```bash
npm run test:smoke
npm run build
```

Then walk through the docs in this order:

1. [Pilot Onboarding Checklist](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-onboarding-checklist.md)
2. [Pilot Runbook](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-runbook.md)
3. [Pilot Support Playbook](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-support-playbook.md)

## Smoke Test Coverage

The smoke tests are lightweight checks for high-value behavior that should stay stable between pilot builds:

- identifier normalization and validation
- processor feature normalization
- public copy normalization
- process/add-on catalog behavior
- state form registry coverage

These tests are not a replacement for end-to-end UI testing, but they do protect the most important configuration and workflow assumptions.

## Deployment Notes

The app uses Next.js with Supabase-backed data and staff/public routing.

Important operational expectations:

- processor-facing behavior should not depend on tenant-specific hardcoded defaults
- public forms should always be rate limited
- staff access should rely on real staff auth/session flows, not public client tokens
- every pilot deployment should have a rollback path and a named support contact

## Key Pilot Docs

- [Pilot Onboarding Checklist](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-onboarding-checklist.md)
- [Pilot Runbook](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-runbook.md)
- [Pilot Support Playbook](C:/Users/Alyssa%20Janes/Desktop/deer-intake/docs/pilot-support-playbook.md)
