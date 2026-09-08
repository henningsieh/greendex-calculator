---
applyTo: '**'
description: Permissions and access control model using Better Auth organization plugin
---

## Permissions & Access Control (Better Auth)

This consolidated document explains the abstract permissions model used in this project and the current concrete implementation. The design is an abstract, extensible access control pattern based on Better Auth's organization plugin and an access control statement. In this repository the model is currently implemented for the `project` resource — see `src/components/features/projects` for full implementation details.

---

## TL;DR — Key Points ✅

- This is an abstract permission system (roles, resources, actions) implemented with Better Auth's organization plugin.
- The repository uses this pattern to implement resource-level permissions for `project` today; the pattern is reusable for other resources.
- Server-side enforcement is required and performed with middleware (`requireProjectPermissions`) and handler checks.
- Client-side permission utilities are present for UI/UX optimizations but are not a security boundary.

---

## Table of Contents

- Overview
- Permission Model (Roles / Actions / Resources)
- Implementation (where code lives)
- How It Works (server middleware, handlers, client utilities)
- Permission Matrix (owner/admin/member)
- Security Considerations
- Migration & Next Steps
- Testing checklist
- Examples

---

## Overview

This repository uses Better Auth and a type-safe access control (AC) statement to provide organization-scoped role-based access control. The modular pieces are:

- An AC statement (resource -> actions) and role definitions
- Client-side role checks (for UX) using a CheckRolePermission API
- Server-side enforcement using `auth.api.hasPermission()` and oRPC middleware
- Database queries scoped by `organizationId`

Note: The permission model is abstract and extendable. In this application the core implementation is for `project` and project-related endpoints & components; however, the same pattern is intended to be used for additional resources as required.

---

## Permission Model

Roles (abstract):

| Role  | Description |
|-------|-------------|
| owner | Organization creator. Full privileges across resources by default. |
| admin | Organization admin. Manage resources & organization settings. |
| member| Organization member. Limited/default privileges (commonly read-only). |

Example resource: `project` — actions implemented:

- create — create a new project
- read — view project listing & project details
- update — modify project details
- delete — delete project (owner-only constraint in this repo)
- share — share projects (future feature)

Permissions are enforced in three layers:

1. Middleware (oRPC middleware) — quick fail for missing permissions
2. Handler checks — verify correct organization ownership and resource scoping
3. Database constraints — queries are always run with `organizationId` filters

---

## Where the code lives (project-specific)

- `src/components/features/projects/permissions.ts` — AC statements and role definitions for project resource (owner/admin/member)
- `src/lib/better-auth/index.ts` — Better Auth server configuration & organization plugin initialization
- `src/lib/better-auth/auth-client.ts` — Client-side plugin registration (roles & ac passed to client), used for UI role checks
- `src/lib/better-auth/permissions-utils.ts` — Client-side helpers/hooks such as `checkProjectPermission`, `useProjectPermissions`
- `src/lib/orpc/middleware.ts` — oRPC middleware and `requireProjectPermissions()` implementation
- `src/components/features/projects/procedures.ts` — Project endpoints (or procedures) and permission-protected handlers

---

## How it works (pattern)

1. Define access control statements (resources -> actions) and create roles via `createAccessControl()`.
2. Create roles (owner/admin/member) with their permitted actions.
3. Configure Better Auth with the AC (`ac`) and pass roles into both server and client plugins.
4. Use server middleware `requireProjectPermissions(permissions[])` to gate handlers.
5. In handler code, verify the resource belongs to the active organization.
6. For UI/UX, use `useProjectPermissions()` to determine which actions the current role can perform.

---

## Permission Matrix (project resource)

| Role | create | read | update | delete | share |
|------|--------|------|--------|--------|-------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ❌ | ✅ |
| Member | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## Security Considerations

- Organization Isolation — all handlers & DB queries are scoped by `activeOrganizationId`.
- Multi-layer protection — middleware (FastFail), handler checks (resource ownership), DB-level filter.
- Server-side permissions are authoritative; client-side checks are for UX only.

---

## Migration & Important Notes

If you are migrating from a custom `projectParticipant` model to organization-based permissions, perform the following steps:

1. Run Better Auth migration: `npx @better-auth/cli migrate` (follow Better Auth docs & local practice)
2. Migrate participant records into organization member records as required (consult `/docs/PERMISSIONS_MIGRATION.md` for SQL examples)
3. Remove legacy `projectParticipant` table & references after validating that organization membership is sufficient for access control

---

## Testing Checklist

- [ ] Members can view all projects in their organization
- [ ] Members cannot create/update/delete projects via UI & API
- [ ] Admins and owners can create/update/delete according to role
- [ ] Active organization selection works correctly
- [ ] Server-side permission middleware blocks unauthorized access
- [ ] Database queries are always filtered by `organizationId`

---

## Example Usage (snippets)

Server (oRPC):

```ts
export const createProject = authorized
  .use(requireProjectPermissions(["create"]))
  .handler(async ({ input, context }) => {
    // Only owners and admins reach here
  });
```

Client (React):

```tsx
import { useProjectPermissions } from "@/lib/better-auth/permissions-utils";

function ProjectActions() {
  const { canCreate, canUpdate, canDelete } = useProjectPermissions();

  return (
    <div>
      {canCreate && <Button>New Project</Button>}
      {canUpdate && <Button>Edit</Button>}
      {canDelete && <Button>Delete</Button>}
    </div>
  );
}
```

---

## Extending the model (example)

To add a new resource (e.g., `report`):

1. Add the resource & actions to the AC statement in `permissions.ts`.
2. Add role permissions for that resource.
3. Create `requireReportPermissions` middleware and use it on report handlers.
4. Add client utilities and tests as necessary.

---

## Where to find project-specific code

- `src/components/features/projects/permissions.ts` — AC + roles for project
- `src/components/features/projects/procedures.ts` — Project CRUD + permission middleware
- `src/lib/better-auth/` — server & client Better Auth setup
- `src/lib/orpc/middleware.ts` — `requireProjectPermissions` implementation
