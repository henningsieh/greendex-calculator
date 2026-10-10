---
status: accepted
---

# Model Organization Membership and Participant Entry as Two Separate Relations

> Recording correction: the permission-evaluation wording below now reflects the original
> shared client/server requirement, as corrected in ADR-0014; no decision was reversed.

## Decision

Cost Tracker holds two relations that must not be collapsed into one, and the data model must
say so explicitly.

**1. Membership is `User ↔ Organization`.** It is the _only_ relation Better Auth owns, and it
carries no Project context. A User may hold Memberships in several Organizations at once. The
active Organization is the context in which Cost Tracker acts, is chosen by the User through a
switcher, and **fails closed when absent**.

Hosting and Partner are **not** two kinds of Organization and not two sides of a switch. They
are the same relation seen from different Projects: one Organization hosts one Project and
partners in another. The switcher therefore asks only "which Organization am I acting as".

**2. Participation is `User ↔ Project`.** A Project Participation belongs to a Project, not to
a Partner Organization. It is therefore **never scoped by the active Organization**. A
Participant's own view lists their Participations across every Project they belong to,
regardless of which Organization is active.

Consequences of keeping them separate:

- A Participant's Membership lives in the Hosting Organization because that Organization owns
  the Project — not because a Participant belongs to the Hosting side of anything.
- A Participant gets **no switcher**. Their whole surface is a list of their past and future
  Projects, which is an additional feature rather than a clickdummy requirement. Because that
  list is never scoped by the active Organization, a Participant never needs one. The switcher
  is staff tooling, for acting on behalf of an Organization.
- Staff procedures that read or write Partner-side or Hosting-side data must check the active
  Organization in addition to the permission statement.

## The participant entry token replaces `invitation` + `bridges`

The hand-written `invitation` row and the `bridges` table become **one app-owned token
record**:

```
token → one Project Partnership → one Project + one Partner Organization
        optional bound email address
        status (open | consumed | revoked) and expiry
```

The binding to exactly one Project Partnership — previously split across the Better Auth
`invitation` row and `bridges` — is now a column on one app-owned record. Two flavours differ
only by whether an email address is bound: a **Participant Invitation** binds one address and
only that address may redeem; a **Participant Registration Link** binds none and is redeemable
by anyone holding it. Both produce the identical result through the identical procedure.

`bridges` has no reference outside Cost Tracker, and the app holds no real data in its
development phase, so both tables are **dropped** rather than migrated.

## Declaring the permission

## The permission already exists

No new statement is required. `projectParticipation` already carries
`["create", "read", "update", "merge"]`, and `create` already means exactly what both
participant entry points need: **may bring a participant into this Project**. Adding an
already-onboarded User and inviting someone new are the same act, and were never two
permissions.

Current grants:

| Role                                    | `projectParticipation: ["create"]`           |
| --------------------------------------- | -------------------------------------------- |
| `owner`                                 | yes                                          |
| `admin`                                 | yes, inherited                               |
| `project-coordinator` (Group Organizer) | **no** — inherits only `memberAc.statements` |
| `participant`                           | no, deliberately `["read", "update"]`        |

Two changes follow.

**1. Grant it to `projectCoordinatorRole`.** It must be added, because Group Organizers are
the Partner-side operator who issues entry points. Without this they silently lose the ability
the moment the check moves off `partnershipForIssuer` — the Group Organizer role alone grants
no broad access by design, so the grant is explicit rather than inherited.

**2. Make issuance consult it.** The defect is not a missing statement; it is that the
issuance procedures never check one. `issue-invitation`, `create-registration-link`,
`set-invitation-open`, `reissue-invitation` and `set-registration-link-open` all authorize
through `partnershipForIssuer`, a scope helper that accepts **either** side of the
Partnership. Replacing it with `projectParticipation: ["create"]` **plus** the existing
Partner-side condition is what removes the Hosting Organization's capability.

Check the role permission client-side through `authClient.organization.checkRolePermission`
and through supported Better Auth checks on the server. The Partner-side and assignment
conditions belong to shared business rules, usable on both sides with the required context.
The server loads authoritative context and enforces the complete policy; client evaluation
only guides presentation and fails closed when context is unavailable, as ADR-0014 requires.

## Active Organization must gate the shell, not just the procedures

`hasOrganizationMembership` asks whether `auth.api.listOrganizations` returns any
Organization, while every procedure requires an **active** Organization
(`lib/orpc/middleware.ts`). A User with Memberships but no active Organization therefore
passes the layout gate and is refused by everything on the page.

The shell gate must check what the procedures check — an **active** Membership — and fail
closed. A gate that is looser than the procedures it fronts is worse than no gate: it renders
a page whose every action fails.

## Related

ADR-0001 (Organizations and participation), ADR-0004 (coordination through assignments),
ADR-0013 (server-authorized membership grant), ADR-0014 (shared client/server permission
and business rules with authoritative server enforcement).
