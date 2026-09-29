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
