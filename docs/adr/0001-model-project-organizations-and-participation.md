---
status: accepted
---

# Model Project Organizations and Project Participation

Greendex will keep one identity for every real Organization and represent Hosting/Partner distinctions through Project-specific relationships. A Project has exactly one owning Organization and zero or more Partner Organizations; Project Participation, rather than Organization Membership, records one person's involvement in one Project and the Organization represented there.

## Context

Cost Tracker introduces Partner Organizations between a Project's owning Organization and its Participants. Calculator does not need to expose this concept, but both applications must continue to reference the same Organizations, Projects, and Project Participations.

A real Organization may own one Project while participating as a Partner Organization in another. Persisting separate hosting and partner entity types would duplicate that Organization's identity and allow its name, Users, and history to diverge. Storing a permanent `organization.type` or `organization.role` would also be false: hosting and partnering depend on a particular Project.

Participants introduce a second ambiguity. The person may participate in several Projects, but each occurrence has Project-specific answers, represented Organization, carbon data, and journey costs. A single global Participant record would mix those Project-specific facts. Conversely, equating Participant with Better Auth User would exclude MVP Participants who have not created an account.

## Decision

- `Organization` remains one shared entity.
- Every Project retains exactly one owning Organization. Cost Tracker calls it the Hosting Organization only when contrasting it with Partner Organizations.
- A Project Partnership assigns one Partner Organization to one Project. It is not a global Organization-to-Organization relationship.
- The Hosting Organization is derived from the Project's existing Organization reference and is not duplicated in a partnership record.
- Reversing Hosting and Partner positions requires a separate Project relationship. Both directions may exist simultaneously across Projects.
- Project Participation is the canonical Project-scoped concept. It identifies one Project, the participating person, and exactly one represented Organization.
- The represented Organization must be the Project's Hosting Organization or one of that Project's Partner Organizations.
- The MVP introduces no global Person table. A Project Participation stores a display name, optional normalized email, and optional link to a Better Auth User.
- A non-empty normalized email identifies at most one Project Participation per Project. The same email cannot represent two Partner Organizations in that Project.
- Email remains optional, so email-less duplicate records remain possible.
- A linked User identifies at most one retained Project Participation per Project.
- Duplicate Project Participations are merged by moving dependent records to one survivor and recording the survivor on the duplicate. Merge history is retained; duplicates are not hard-deleted.

## Considered options

### Separate Hosting Organization and Partner Organization entities

Rejected because the same real Organization can occupy either position. Separate entities would create duplicate identities and synchronization requirements.

### Permanent type or role on Organization

Rejected because Hosting and Partner are Project-relative positions, not Organization attributes. Better Auth roles belong to User memberships and cannot describe Organization-to-Organization relationships.

### Global Organization partnership

Rejected because a Partner Organization is accepted for one specific Project. Assignment to Project A must not automatically make it a Partner Organization for Project B.

### Global Participant or Person required in the MVP

Rejected because optional email cannot reliably deduplicate a person across Projects. Project-specific records can later link to the same verified User without guessing identity from names.

### Project Participation represented by several Organizations

Rejected because one participation represents exactly one Organization. A group ticket may cover several Project Participations, but that does not change each participation's represented Organization.

## Consequences

- Calculator can continue treating the Project's owning Organization simply as Organization; Partner terminology stays in Cost Tracker.
- Cost Tracker needs a Project-to-Partner-Organization relation.
- The represented-Organization invariant spans Project and partnership records. The migration must enforce it transactionally and at the database level where feasible.
- Project-specific data belongs behind Project Participation even when several participations later link to one User.
- Email supports matching and invitation initiation but never authorizes access.
- Merge operations must update every Calculator and Cost Tracker reference atomically while preserving the duplicate record and merge metadata.

The detailed target model is maintained in [the shared Projects documentation](../projects/model.md).
