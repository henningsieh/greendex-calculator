# Calculator Project Permissions

Status: current Calculator implementation. The accepted future Participant integration is defined by [ADR-0002](../../../../docs/adr/0002-integrate-participants-with-better-auth.md) and must not be treated as implemented until its auth and schema migration lands.

## Current model

Calculator uses Better Auth Organization Membership roles to authorize Organization-owned Project operations. The current stored values map to product language as follows:

| Stored role | Current product term       |
| ----------- | -------------------------- |
| `owner`     | Organization Administrator |
| `admin`     | Project Coordinator        |
| `member`    | Participant                |

The accepted target model introduces a distinct `participant` role and supports several separate roles on one Membership. Current code still treats `member` as the Participant role.

## Project permissions

| Current role | create | read | update | delete | archive                       |
| ------------ | ------ | ---- | ------ | ------ | ----------------------------- |
| `owner`      | yes    | yes  | yes    | yes    | yes                           |
| `admin`      | yes    | yes  | yes    | no     | only Projects they coordinate |
| `member`     | no     | yes  | no     | no     | no                            |

Organization Administrators may manage every Project in the active Organization. Project Coordinators may manage Projects for which they are responsible. Only Organization Administrators may delete Projects.

## Enforcement

- Server enforcement is authoritative; client checks only control presentation.
- Procedures require an authenticated session and active Organization before permission checks.
- Organization-owned reads and writes are constrained by `activeOrganizationId`.
- Dynamic ownership checks supplement static role permissions for coordinator-only operations.
- Preserve `UNAUTHORIZED` for missing authentication and `FORBIDDEN` for insufficient permission.

## Sources of truth

- [`src/features/projects/permissions.ts`](../../src/features/projects/permissions.ts): access-control statements and current roles
- [`src/features/projects/procedures.ts`](../../src/features/projects/procedures.ts): Project operations and resource checks
- [`src/lib/better-auth/index.ts`](../../src/lib/better-auth/index.ts): Better Auth Organization plugin
- [`src/lib/better-auth/auth-client.ts`](../../src/lib/better-auth/auth-client.ts): browser plugin configuration
- [`src/lib/better-auth/permissions-utils.ts`](../../src/lib/better-auth/permissions-utils.ts): client presentation helpers
- [`src/lib/orpc/middleware.ts`](../../src/lib/orpc/middleware.ts): authorization middleware

## Accepted target

Before changing Participant roles, invitations, or Project Participation identity, read:

- [Shared domain language](../../../../DOMAIN-GLOSSARY.md)
- [Cost Tracker domain model](../../../cost-tracker/docs/domain-model.md)
- [ADR-0001: Project Organizations and Project Participation](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0002: Participant integration with Better Auth](../../../../docs/adr/0002-integrate-participants-with-better-auth.md)
