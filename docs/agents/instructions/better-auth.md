---
name: "Better Auth"
description: "Greendex authentication, organizations, permissions, and auth persistence"
applyTo: "apps/calculator/src/lib/better-auth/**/*.ts,apps/calculator/src/features/authentication/**/*.ts,apps/calculator/src/features/authentication/**/*.tsx,apps/calculator/src/features/organizations/**/*.ts,apps/calculator/src/features/organizations/**/*.tsx,packages/auth/src/permissions.ts,packages/auth/src/organization-roles.ts,apps/calculator/src/lib/orpc/middleware.ts,apps/calculator/src/lib/orpc/procedures.ts,apps/calculator/src/app/api/auth/**/*.ts,packages/database/src/schemas/auth-schema.ts"
---

# Better Auth

## Official documentation and skill

1. Confirm the installed `better-auth` 1.7 major in `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
2. Start with the official [Better Auth `llms.txt` index](https://better-auth.com/llms.txt), then use the [documentation index](https://better-auth.com/docs/llms.txt) to select the relevant page.
3. Fetch only pages compatible with the installed major and compare them with installed declarations and Greendex source.
4. Use the official `better-auth-best-practices` skill, listed by `pnpm dlx skills list`, as supplementary workflow guidance.

## Greendex rules

- Server configuration: `apps/calculator/src/lib/better-auth/index.ts`; browser client: `apps/calculator/src/lib/better-auth/auth-client.ts`; route: `apps/calculator/src/app/api/auth/[...all]/route.ts`.
- Preserve request headers through the oRPC context. Server code uses `auth.api` or the server oRPC client; Client Components use the browser client or hydrated `orpcQuery` data.
- `session.activeOrganizationId` is the Organization tenant boundary. Constrain Organization-owned reads and writes by it; apply `authorized` before permission middleware; use `requireProjectPermissions` and preserve `UNAUTHORIZED` versus `FORBIDDEN`.
- OAuth credentials come from `apps/calculator/src/env.ts`. Keep deployed callback paths. Never log or commit OAuth, session, invitation, or verification secrets or tokens.
- Reusable email templates and delivery are in `@greendex/email`; the Calculator injects its sender.

## Pinned options (#373)

The repository pins `better-auth@1.7.15` (`pnpm-workspace.yaml` / lockfile). These audit-relevant options are explicit in `packages/auth/src/server-auth.ts` or the Calculator plugin config; do not remove them and fall back to library defaults.

| Lead | Greendex setting | Better Auth 1.7.15 default | Reference |
| --- | --- | --- | --- |
| Trusted origins | `trustedOriginsFor(baseURL)`: own origin plus `www` alias, no wildcards | Trusts `baseURL` only | [Options: trustedOrigins](https://better-auth.com/docs/reference/options#trustedorigins) |
| Account linking | `enabled: true`, `trustedProviders: []`, `requireLocalEmailVerified: true`, `allowDifferentEmails: false` | `enabled: true`; `requireLocalEmailVerified` and `allowDifferentEmails` are library defaults | [Options: accountLinking](https://better-auth.com/docs/reference/options#accountlinking) |
| Invitation email gate | `requireEmailVerificationOnInvitation: true` for both apps | Unset: opaque invitation IDs keep the normal emailed-invitation flow; predictable IDs require verification | [Organization: email verification requirement](https://better-auth.com/docs/plugins/organization#email-verification-requirement) |
| Password-reset TTL | `resetPasswordTokenExpiresIn: 3600` | 3600 seconds | [Options: resetPasswordTokenExpiresIn](https://better-auth.com/docs/reference/options#resetpasswordtokenexpiresin) |
| Magic-link TTL | `magicLink({ expiresIn: 300 })` | 300 seconds | [Magic link plugin](https://better-auth.com/docs/plugins/magic-link) |
| Session tenant fields | `activeProjectId` is the only app-declared `additionalFields` entry; `activeOrganizationId` is owned by the organization plugin schema | Organization plugin persists `activeOrganizationId`; do not declare it twice | [Organization: schema](https://better-auth.com/docs/plugins/organization#schema) |

Local validation (development DB): an auth POST from an off-allowlist origin returns `403 INVALID_ORIGIN`; the allowlisted origin reaches the credential check. An issued magic-link token carries a 300-second TTL, a password-reset token 3600 seconds, and the session payload carries both `activeOrganizationId` and `activeProjectId`. Staging observations with test accounts for OAuth linking, invitation-to-unverified, reset replay, and magic-link replay still need to be recorded before closing #373.

## Schema changes

Update the auth configuration, run `pnpm --filter @greendex/calculator auth:generate`, inspect `packages/database/src/schemas/auth-schema.ts`, generate and inspect the Drizzle migration, and update integration tests. A new database needs migrations before auth testing; OAuth initiation writes to `verification` before provider redirect.

[Shared Project permissions](../../projects/permissions.md) define the accepted cross-application target. [Calculator Project permissions](../../../apps/calculator/docs/projects/permissions.md) describe the current implementation. Do not treat [ADR-0002](../../adr/0002-integrate-participants-with-better-auth.md) as implemented until its schema and auth changes land.
