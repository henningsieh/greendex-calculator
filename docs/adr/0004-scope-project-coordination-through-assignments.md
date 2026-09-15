---
status: accepted
---

# Scope Project Coordination Through Assignments, Not Separate Host and Partner Roles

`project-coordinator` is one distinct Better Auth role in every Organization. Whether it coordinates the Host side or a Partner side of a Project is decided by the assignment relationship, not by a separate role.

## Context

ADR-0001 models Hosting and Partner positions as Project-specific relationships: a Project has exactly one owning Organization and zero or more Partner Organizations joined through a Project Partnership. ADR-0002 integrates Participants with Better Auth by keeping Organization Membership roles separate from Project Participation, which remains the authority for Project-specific access.

Project coordination needs the same separation. A coordinator must be restricted to one Project or one Project Partnership, while Organization Owners and Organization Admins keep Organization-wide authority. Introducing separate Host-coordinator and Partner-coordinator roles would duplicate role definitions and misplace Project-relative scope onto Organization Membership.

Better Auth's built-in `admin` role already means Organization-wide administration. Reusing it for an assignment-scoped Project Coordinator would make a stored `admin` role ambiguous and would prevent the authorization system from distinguishing Organization-wide administration from limited coordination.

## Decision

- `project-coordinator` is one distinct custom Better Auth role in every Organization, Host or Partner.
- Better Auth's built-in roles retain their direct meanings:
  - `owner` is Organization Owner;
  - `admin` is Organization Admin;
  - `member` is only Better Auth's fallback role and does not identify a Greendex actor or grant Cost Tracker authority.
- The assignment relationship decides a Project Coordinator's coordination scope:
  - `project-coordinator` + hosted-Project assignment = Host-side coordination;
  - `project-coordinator` + Project-Partnership assignment = Partner-side coordination.
- A coordinator may work only on explicitly assigned Projects or Project Partnerships. Assignment to one Project never grants access to another.
- Organization-wide authority stays with `owner` and `admin`; coordination never implies Organization management.

### Host Organization example

```text
Ambitia Institute
├─ Karmen: `owner`
├─ Lena: `admin`
└─ Max: `project-coordinator`
    └─ assigned to Project "Erasmus 2026"
```

- Karmen (`owner`) manages Ambitia itself: users, settings, and all hosted Projects.
- Lena (`admin`) has Organization-wide staff authority across all Projects hosted by Ambitia, but is not the Owner.
- Max (`project-coordinator`) may work only on Erasmus 2026: manage its Partner Organizations, see its Participants, review its Claims, and similar Project-scoped tasks. Max cannot access Ambitia's other Projects unless explicitly assigned.

### Partner Organization example

```text
Youth Culture Berlin
├─ Ada: `owner`
└─ Jamie: `project-coordinator`
    └─ assigned to: Youth Culture Berlin ↔ Erasmus 2026
```

- Jamie's role is still `project-coordinator`.
- Jamie is assigned to a Project Partnership because Youth Culture Berlin does not own the Project.
- That assignment allows work only for Youth Culture Berlin's side of Erasmus 2026.

So:

```text
`project-coordinator` + hosted Project assignment
= Host-side coordination

`project-coordinator` + Project-Partnership assignment
= Partner-side coordination
```

One role. Two clear scopes.

## Considered options

### Separate Host-coordinator and Partner-coordinator roles

Rejected because the distinction is Project-relative, not an Organization attribute. Separate roles would duplicate Better Auth configuration and mirror the permanent `organization.type` approach already rejected in ADR-0001.

### Map Project Coordinator to Better Auth's `admin` role

Rejected because `admin` means Organization-wide administration. It cannot simultaneously communicate and safely enforce assignment-scoped coordination.

### Organization-wide coordinator authority

Rejected because coordination must be least-privilege and Project-scoped. Organization-wide access belongs to `owner` and `admin`.

### Deriving coordination scope from Project Participation alone

Rejected because Project Participation identifies one person's involvement in one Project, while coordination authorizes staff operations over other Participants, Partner Organizations, and Claims within an assigned scope.

## Consequences

- The Better Auth role configuration has one custom `project-coordinator` role definition alongside the built-in `owner` and `admin` roles and the custom `participant` role.
- Authorization checks combine Membership role with an explicit assignment: hosted-Project assignment for Host-side work, Project-Partnership assignment for Partner-side work.
- Assignment grants no Organization management authority and no access beyond the assigned Project or Partnership.
- Ending, closing, or archiving a Project or Partnership ends the effective coordination scope without removing the Membership role, consistent with the persistent-role rule in ADR-0002 and shared permissions.
- Existing stored `admin` roles currently mean Project Coordinator in the implementation. Moving Organization-wide administration to `admin` requires an explicit role/data migration rather than a blind rename.
- The detailed permission implementation remains owned by [shared Project permissions](../projects/permissions.md) and the `packages/auth` access-control statements.
