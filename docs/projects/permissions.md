---
applyTo: "**"
description: Current Calculator project permissions and organization role gates
---

# Project permissions

This document describes the current Calculator implementation, not a proposed staffing model. Stored organization roles, in descending hierarchy order, are **`owner` > `admin` > `coordinator` > `participant`**. Domain-facing names follow the [canonical glossary](../../DOMAIN-GLOSSARY.md): Organization Administrator, Project Coordinator, and Participant. Stored values remain distinct from those names.

## Source of truth

| Module | Responsibility |
| --- | --- |
| [packages/config/src/organization-roles.ts](../../packages/config/src/organization-roles.ts) | Canonical `ORGANIZATION_ROLES` stored values and `OrganizationRole` type. |
| [packages/auth/src/organization-roles.ts](../../packages/auth/src/organization-roles.ts) | Re-exports the role constants; validates, parses, adds, and checks comma-separated role strings. `assertRoleMapCoversRoles` checks exact role-map coverage and descending key order. |
| [packages/auth/src/permissions.ts](../../packages/auth/src/permissions.ts) | Access-control statements, `accessControl`, `calculatorRoles`, and `ProjectPermission`. |
| [Shared server factory](../../packages/auth/src/server-auth.ts) | `createServerAuth`: one home for the Better Auth setup. Owns the organization plugin, `calculatorRoles`, session tenant select, and country checks. |
| [Calculator Better Auth server](../../apps/calculator/src/lib/better-auth/index.ts) and [browser client](../../apps/calculator/src/lib/better-auth/auth-client.ts) | Thin wrapper passes env, email sender, invitation link, and magic link. Browser client configures the organization plugin with the shared access controller and `calculatorRoles`. |
| [oRPC middleware](../../apps/calculator/src/lib/orpc/middleware.ts) | `authorized` authenticates requests; `requireProjectPermissions` calls `auth.api.hasPermission` for project actions. |
| [Project procedures](../../apps/calculator/src/features/projects/procedures.ts) | Active-organization filtering and project-specific role/responsibility checks. |
| [Browser permission utilities](../../apps/calculator/src/lib/better-auth/permissions-utils.ts) | `useProjectPermissions` checks role permissions for UI decisions; it does not perform the handlers' responsibility checks. |

## Declared project permissions

The project statement defines `create`, `read`, `update`, `delete`, and `archive`; there is no `share` action. The following table describes **`calculatorRoles` declarations**, not every handler's authorization logic.

| Stored role | create | read | update | delete | archive |
| --- | --- | --- | --- | --- | --- |
| `owner` | Yes | Yes | Yes | Yes | Yes |
| `admin` | Yes | Yes | Yes | No | Yes |
| `coordinator` | Yes | Yes | Yes | No | No |
| `participant` | No | Yes | No | No | No |

The definitions also include Better Auth's organization-plugin statements: `owner` spreads `ownerAc`, `admin` and `coordinator` spread `adminAc`, and `participant` spreads `memberAc`. Descending role order is a structural contract, not a substitute for these explicit permissions.

Simple rule: Organization Administrator can archive. Project Coordinator mirrors Organization Administrator for now, but has no archive yet. Only Organization Owner can delete.

## Procedure gates and scope

The [project procedures](../../apps/calculator/src/features/projects/procedures.ts) distinguish role permissions from project responsibility. Here, **own project** means `project.responsibleUserId === context.user.id`, not staffing membership.

- `createProject` uses `requireProjectPermissions(["create"])`, sets the active organization as `organizationId`, and sets the caller as `responsibleUserId`.
- `listProjects`, `getProjectById`, and `getProjectParticipants` use the `read` middleware and constrain access to the active organization. Listing is not restricted to own projects or projects in which the caller participates.
- `updateProject` uses the `update` middleware and looks up the project in the active organization. It has **no own-project check**.
- The handler checks in `deleteProject`, `batchDeleteProjects`, and `archiveProject` allow `owner` to act on any project in the active organization; `admin` and `coordinator` may act only on own projects. `participant` does not pass these checks. Batch deletion checks responsibility for every requested project before deleting.
- Deletion procedures additionally use `requireProjectPermissions(["delete"])`; `archiveProject` does not use project-permission middleware. The declared role map above does **not** grant `delete` to `admin` or `coordinator`, and grants `archive` only to `admin` (not to `coordinator`), even though the handler responsibility checks allow both on own projects. These are separate layers and must not be represented as one unconditional permission matrix.
- `setActiveProject` checks for `owner`, `admin`, or `coordinator` and active-organization project membership when `projectId` is supplied. It does not require responsibility for that project. When `projectId` is omitted, those checks are skipped and the session update still runs.
- `getProjectForParticipation` uses the unauthenticated `base` procedure and fetches by project ID without an active-organization check. It is a public participation endpoint, not an organization-role read gate.

`participant` is read-only for the declared project resource. This does not describe every participation workflow or the session-update case above.

## Enforcement details

In [middleware](../../apps/calculator/src/lib/orpc/middleware.ts), `authorized` raises `UNAUTHORIZED` when no session/user is present. `requireProjectPermissions` raises `FORBIDDEN` if there is no active organization, calls `auth.api.hasPermission`, and raises `FORBIDDEN` when the returned value is falsy. That is the current implementation; the role declaration table and handler checks should be read alongside it rather than treated as proof of the complete API result.

Protected project handlers check the active organization before accessing the requested project. Several subsequent writes use only the project ID after that lookup; not every query has an `organizationId` predicate. The public participation lookup is explicitly outside this organization-scoped flow.

Browser checks are UI aids, not server enforcement. `useProjectPermissions` defaults to `participant` and uses `checkRolePermission`; it does not inspect `responsibleUserId`.

## Open staffing scope

Issue #237 remains open for staffing-scope decisions. The current project handler gates use stored roles, the active organization, and (for deletion and archiving) `responsibleUserId`. They do not use country as a permission condition, and the role contract has no country column. This document does not decide who should be allowed to staff projects or change that behavior.
