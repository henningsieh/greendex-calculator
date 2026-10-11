---
name: "Email"
description: "Greendex transactional templates, rendering, localization, and SMTP injection"
applyTo: "packages/email/src/**/*.ts,packages/email/src/**/*.tsx,apps/calculator/src/lib/email.ts"
---

# Email

## Official documentation

Confirm installed React Email and Nodemailer versions before changing email code. Start with the official [React Email `llms.txt` index](https://react.email/docs/llms.txt) for templates and [Nodemailer documentation](https://nodemailer.com/) for transport APIs; fetch only the needed pages and compare them with installed declarations. The broad React Email provider/editor skill is not installed because it does not match this SMTP-focused integration.

- Reusable transactional templates, rendering, and delivery primitives belong in `packages/email/`.
- The Calculator owns SMTP configuration, application URLs, and the injected sender in `apps/calculator/src/lib/email.ts`.
- Keep templates localized through their caller-provided content. Do not put Calculator environment access in `@greendex/email`.
- Do not log SMTP credentials, reset links, invitation tokens, or rendered private data.

## Automated tests and mail safety

- UI-driven tests (Playwright, or anything hitting a dev server wired to real SMTP) must NEVER submit a form that triggers outbound mail: registration, resend-verification, staff/Participant invitations, setup-link delivery. There is no dev mail sink; every submit sends through `mail.sieh.org`.
- Fake recipient domains do NOT make this safe: delivery to a nullMX domain bounces straight back into our own mailbox (learned 2026-09-29: four `Undelivered Mail` bounces from `@example.org` registrations). Real `@sieh.org` aliases are worse — they land in a human inbox.
- Mail-dependent preconditions (verified User, issued invitation/setup link) are created via DB/test-helper setup in `beforeAll`, logged as an API-setup exception in the spec header; the browser then exercises the in-app surface (e.g. navigate to the setup-created `/accept-invitation/{id}` and click accept). Mail delivery itself stays covered by Vitest plus the manual journey, never by automated browser specs.
- Cost Tracker's `access-and-links`, `hosting-setup`, `partnership-setup`, `participant-onboarding`, `claim-draft-and-costs`, `claim-review`, `project-readiness`, and `sign-in-navigation` Playwright specs keep trace, video and automatic screenshots off, including tracing of hand-built contexts and auth API requests. Full-URL/value assertions retain their original checks but pass booleans to matcher diagnostics. File-scoped runs are audited for zero trace archives; this is **not** an absolute artifact-privacy guarantee or a claim that secrets exist only in memory (global setup deliberately writes ignored `.auth/` session storage).
- Deep artifact privacy is a non-blocking follow-up: automatic failure aria snapshots, reporter step values and failed navigation API diagnostics can still reveal private links. `fixtures/artifact-privacy.ts` retains a dormant Playwright **1.63.0** experiment; its default test export installs no runner hooks or snapshot environment guard. See [the follow-up backlog](../../../apps/cost-tracker/docs/backlog/e2e-artifact-privacy-followup.md) before enabling it. The earlier induced-failure/diagnostics audit proved the experiment, not the final MVP default. Never publish unsanitized artifacts or substitute post-run deletion for a future privacy boundary.
- `claim-navigation.spec.ts` (N5 evidence) is separately owned and untouched; its auth tracing needs independent review. `.playwright/` and `.auth/` are gitignored at root and app level, not approved publication/upload locations. No CI artifact uploader is configured in this repository; external CI retention must be checked separately.
