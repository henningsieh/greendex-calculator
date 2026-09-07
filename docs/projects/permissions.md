# Shared Project Permissions and Participant Authentication

Status: approved target model; current Calculator implementation still maps Participant to Better Auth's `member` role. See [Calculator current permissions](../../apps/calculator/docs/projects/permissions.md) before changing existing code.

This document owns the cross-application permission model. Read [ADR-0002](../adr/0002-integrate-participants-with-better-auth.md) for the trade-offs behind it.

## Three separate concepts

```text
User                    login identity
Organization Membership roles within one Organization
Project Participation   involvement in one specific Project
```

One User may have several Organization Memberships and several Project Participations. One Membership may assign several distinct roles.

Example:

```text
Alice
├── Membership in Ambitia
│   ├── role: owner
│   └── role: participant
└── Project Participation in Project A
```

`owner` and `participant` remain separate roles. Participation never replaces or downgrades another role. Project Participation—not the Organization role—identifies Project A.

Greendex role assignments persist. Ending a Project, closing its Cost Submission Window, archiving a Project Participation, or merging a duplicate never removes an assigned Membership role.

## Participant invitation

A reusable Project Participation link and a Better Auth invitation are different records.

1. The reusable application link identifies the Project and represented Organization.
2. A person may provide an optional email.
3. Without email, create no Better Auth invitation.
4. With email, create an email-specific Better Auth invitation to the Project's owning Organization with the `participant` role.
5. Acceptance creates or reuses the User and Organization Membership, adds the separate `participant` role, and links the Project Participation to the User.
6. Existing roles on an existing Membership remain unchanged.

Several accepted invitations for Projects owned by the same Organization reuse one Membership. Projects owned by different Organizations may create several Memberships for one User. Better Auth's Organization listing and active-Organization switcher operate over those owning-Organization Memberships.

## Authorization

- Organization management checks the active Organization Membership and its roles.
- Personal Calculator and Cost Tracker access checks the Project Participation linked to the authenticated User.
- The `participant` role never replaces a Project Participation ownership check.
- Email matching never authenticates a person or unlocks existing data.
- An unlogged person may submit new MVP data but cannot reopen it.
- Reopening requires invitation acceptance, login, and a Project Participation linked to the User.
- Client-side permission checks control presentation only; server-side checks are authoritative.

## Current-to-target migration

The target implementation must:

- introduce a distinct Better Auth `participant` role;
- support several roles on one Membership;
- stop using the generic stored `member` role as the definition of Project Participant;
- preserve every existing role when `participant` is added;
- authorize Project-specific access through Project Participation;
- connect invitation acceptance to the relevant Project Participation transactionally.

Use the official [Better Auth Organization plugin documentation](https://better-auth.com/docs/plugins/organization) for the installed 1.7 release line.
