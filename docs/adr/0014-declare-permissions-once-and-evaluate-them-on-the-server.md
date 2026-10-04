---
status: accepted
---

# Share Permission and Business Rules Between Client and Server

> Recording correction, approved by the user: the original server-only evaluation
> restriction was an authoring error, not an agreed decision. This corrects the record;
> it does not reverse the requirement. The existing filename is retained for stable links.

## Decision

Permissions are declared **once**, as Better Auth statements and roles, and checked on
**both client and server** through supported Better Auth interfaces. Client checks include
`authClient.organization.checkRolePermission`, as demonstrated by Calculator's
`useProjectPermissions`.

Relational and lifecycle business rules are also declared **once**, in shared policy code.
Both sides may evaluate them using the required context: active Organization, Project or
Project Partnership assignment, and relevant lifecycle state. Components must not maintain
independent copies of those rules.

The server loads authoritative context and enforces the policy for every protected operation.
Client checks guide presentation; they never authorize a request. The server never trusts
client-supplied capabilities or authorization context. Send only authorized, non-secret
context needed for client evaluation; missing or unavailable context fails closed.

Server-computed capabilities remain useful for server-only facts and initial rendering.
They supplement, rather than replace, the required client checks and do not prohibit
shared client-side business-rule evaluation.

## Why

Single-sourced permissions and business rules were the requirement: the UI and procedures
must not maintain competing definitions of who may do what. Better Auth provides the shared
permission definitions; shared policy composes them with domain context. Server enforcement
protects operations even when a client is modified or its view of that context is stale.

## Enforcement

Participant management and Claim controls consume the shared policy rather than duplicating
role, Organization-side, assignment, or status checks. Procedures independently enforce it
using authoritative state.

Tests through the agreed authorization interface compare client and server decisions for
equivalent context and verify refusal of forged or stale client decisions. Sharing policy
does not prevent state changes between rendering and a request, so the UI must still handle
server refusals safely. No additional test interface is needed.

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
  authoritative. Organization changes and relevant mutations refresh client context and
  capabilities; missing or pending context fails closed.
