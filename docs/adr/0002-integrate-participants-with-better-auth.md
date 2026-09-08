---
status: accepted
---

# Integrate Participants with Better Auth

Participants who accept an invitation will use normal Better Auth Users, Organization Memberships, and distinct roles. The accepted invitation creates or reuses Membership in the Project's Hosting Organization; Project Participation remains the authority for which specific Projects and personal records the User may access.

## Context

The MVP permits participation without login, while a later Participant-facing experience must let one person sign in, see carbon and journey-cost data across Projects, list the Hosting Organizations in which they participate, and switch active Organization. A User may participate in Projects owned by several Organizations and may already hold an administrative role in one of them.

Better Auth 1.7 supports multiple Organization Memberships for one User and multiple role names on one Membership. A Membership role answers what a User may do within an Organization. It does not identify a Project, a Project Partnership, or the Organization represented by a Project Participation.

The model must also preserve a key case: Alice may be an Organization Administrator for Ambitia and participate in an Ambitia Project. Participation must not replace or downgrade her administrative authority.

## Decision

- One real person uses one Better Auth User after account creation or sign-in.
- A User may have Memberships in several Hosting Organizations.
- A Membership may carry several separate roles, including `owner` and `participant`. These remain distinct roles; no combined role is introduced.
- Assigning `participant` never removes or replaces an existing role.
- Greendex role assignments are persistent. Project closure, Cost Submission Window closure, Project Participation archival, or merge operations do not expire or remove Membership roles.
- Project Participation identifies the specific Project. The Organization-level `participant` role is never used as a substitute for a Project Participation check.
- An invited Participant who accepts becomes a restricted member of the Project's Hosting Organization, not the represented Partner Organization.
- Several accepted invitations for Projects with the same Hosting Organization reuse one Membership. Participation in Projects with different Hosting Organizations may create several Memberships for one User.
- Better Auth's Organization list and active-Organization switching operate over those Hosting Organization Memberships.
- If the User already has a Membership in the Hosting Organization, acceptance reuses it and adds the separate `participant` role while preserving all existing roles.

## Invitation flow

The invitation design has two levels:

1. A reusable application link identifies one Project and one represented Partner Organization. It may be shared through email, messaging, or another channel and used by several people.
2. After a person supplies an email, the application creates an email-specific Better Auth invitation to the Project's Hosting Organization with the `participant` role.

The reusable link is not itself a Better Auth invitation. An application bridge record connects each generated Better Auth invitation to the Project Participation that initiated it.

Email is optional. If no email is supplied, the Project Participation may be created but no Better Auth invitation exists. If email is supplied, the person is known by contact address but remains unauthenticated until invitation acceptance and login.

Email matching never grants access. An unlogged person cannot reopen an existing Cost Submission by entering its email address. Reopening requires an accepted invitation, a valid User session, and a Project Participation linked to that User.

## Authorization model

Authorization combines two checks rather than stretching one role across both scopes:

- Organization-level operation: check the active Hosting Organization Membership and its roles.
- Participant operation: check that the authenticated User is linked to the Project Participation being read or changed.

For Alice, the model is:

```text
Alice
├── Membership in Ambitia
│   ├── role: owner
│   └── role: participant
└── Project Participation in Project A
```

`owner` authorizes Organization management. `participant` enables Participant-facing Organization behavior. Project Participation authorizes Alice's personal Project A data. Alice never loses `owner` when participating.

## Considered options

### One Membership only

Rejected because Better Auth Membership is naturally many-to-many: one User may belong to several Organizations. Multiple Project participations across Hosting Organizations are therefore not a technical conflict.

### Membership in the represented Partner Organization

Rejected for Participant access. The Project and its protected records belong to the Hosting Organization's workspace, Calculator has no Partner Organization concept, and Hosting Organization Membership preserves the existing tenant model. The represented Partner Organization remains explicit on Project Participation for grouping and reporting.

### Create both Hosting and Partner Memberships

Rejected because one Project Participation should not grant two Organization-level access relationships. It would also blur tenant access with representation.

### User without Organization Membership

Rejected for the accepted-invitation flow because the product requires Participants to use Better Auth Organization listing, role assignment, and active-Organization switching. Project Participation still narrows access within that Membership.

### Replace an existing role with participant

Rejected because a User may manage and participate simultaneously. Role replacement would silently remove valid authority.

### Email-only reopening

Rejected because knowing or guessing an email address is not authentication. Email may locate an invitation workflow but never disclose or unlock existing data.

## Consequences

- The Better Auth role configuration needs a distinct `participant` role instead of treating the built-in `member` label as Project Participation.
- Permission checks must support several roles on one Membership.
- Project queries for Participant-facing data must require both Hosting Organization Membership and the relevant Project Participation.
- The existing `project_participant.memberId` and `userId` duplication should be removed during schema implementation. A nullable User reference is sufficient; Hosting Organization Membership is derived through the Project and User.
- Invitation acceptance must transactionally connect Better Auth invitation, User, Membership, roles, and Project Participation without overwriting existing roles.
- Account recovery or claiming beyond normal Better Auth invitation acceptance remains deferred.

Better Auth behavior is documented by the official [Organization plugin reference](https://better-auth.com/docs/plugins/organization). The detailed target model is maintained in [shared Project permissions](../projects/permissions.md).
