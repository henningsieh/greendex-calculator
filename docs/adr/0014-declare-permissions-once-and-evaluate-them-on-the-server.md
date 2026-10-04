---
status: accepted
---

# Declare Permissions Once and Evaluate Them on the Server

## Decision

Permissions are declared **once**, as Better Auth statements and roles, and evaluated **only
on the server** — twice: authoritatively in the procedure, and again at render time to decide
what to render. A component never re-derives a role rule of its own. Consumers receive a
server-computed capability as a **prop**. Every render-time check is **fail-closed**: any
lookup failure hides the management UI.

Client-side role-only checks via `authClient.organization.checkRolePermission` are permitted
**where the rule is genuinely role-only** — Calculator's `useProjectPermissions` is the
reference implementation. They are **not** permitted where the rule also depends on state the
browser cannot see authoritatively. The participants page is exactly that case: its rule is
role **plus** which side of the Project Partnership the active Organization is, so that gate
stays server-side.

## Why

Single-sourced permissions were a main implementation requirement: Better Auth was adopted
because one definition can be applied consistently on both sides. The server-render-gate
form is _stronger_ than a browser check rather than a weaker substitute for it. It cannot be
bypassed by a crafted request, it cannot be stale in the way a cached client decision can,
and it does not drift from the procedure's own check because it **composes the same helpers**
instead of restating role strings.

`features/organizations/access.ts` states the intent and is the reference implementation: it
opens with `import "server-only"`, wraps every check in a fail-closed `try`, and documents
that it "composes the exact checks securing `projectPartnerships.list`" with "**no role
strings of its own**." Its consumers take the result as a prop
(`project-partnership-manager.tsx`), which is why the capability never leaks into a component
as a re-derived boolean.

## Enforcement

Three components already follow the pattern: `project-list.tsx:236`,
`project-partnership-manager.tsx:88,179`, and `claim-review.tsx:160`.

`features/projects/components/participant-coordination.tsx` does not. Across 968 lines it has
**no** `canManage` / `canAssign` / `canReview` / `role ===` check, and all thirteen of its
`disabled=` occurrences test `isPending` — none test authority. The country editor, "Remove
Project Participation", Group Organizer assign and revoke, Review Task resolution and the
issuance controls therefore render for every authorized reader, while `participations.ts`
refuses every one of those writes unless the active Organization is the **Partner** side. The
refusal is silent, so a Hosting Organization member is shown a working control panel that
does nothing.

This file is the single outlier and its fix is to copy the pattern already established three
files away, not to invent a new gate.

## Consequences

- An **Organization switcher is required**. Hosting and Partner are the same `User ↔
Organization` relation — an Organization hosts one Project and partners in another — so
  there is one switcher, not a host switcher and a partner switcher. `auth.api.setActiveOrganization`
  already exists in Better Auth; only the UI is missing. Today the active Organization is
  chosen **silently** as the most recently created Membership
  (`packages/auth/src/server-auth.ts`), which is a wrong-tenant failure mode once a User
  belongs to more than one Organization.
- Because the active Organization is authorization context, any capability that reads or
  writes Partner-side or Hosting-side data must be gated on it — and must fail closed when it
  is absent.
- Presentation-only gating never substitutes for procedure authorization. The procedure stays
  authoritative; the render gate exists so the screen stops lying.
