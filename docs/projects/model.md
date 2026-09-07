# Shared Project and Project Participation Model

Status: approved design; the proposed schema changes are not implemented.

This document is the cross-application source of truth for Project identity and Project Participation. Read [ADR-0001](../adr/0001-model-project-organizations-and-participation.md) for rationale and [shared permissions](permissions.md) for Better Auth integration.

## Project

Every Project has exactly one owning Organization. Applications may present that Organization differently, but they reference the same Project and Organization records.

- Calculator presents the owning Organization without a Hosting/Partner distinction.
- Cost Tracker calls it the Hosting Organization when contrasting it with Project-specific Partner Organizations.
- Cost Tracker may assign zero or more Partner Organizations to a Project.
- A Project Partnership is Project-specific. Assignment to one Project does not apply to another.
- The Hosting Organization remains `project.organizationId` and is not duplicated in a Project Partnership row.

```text
Project
├── exactly one owning Organization
├── zero or more Project Participations
├── Calculator-owned carbon data
└── Cost Tracker-owned Project Partnerships and Cost Submissions
```

## Project Participation

Project Participation records one person's involvement in one Project. It is shared by Calculator questionnaire data and Cost Tracker allocations.

```text
Project Participation
├── Project
├── represented Organization
├── display name
├── optional contact email
└── optional User
```

The represented Organization is required and must be either:

1. the Project's owning Organization; or
2. one of that Project's Partner Organizations.

One Project Participation represents only one Organization. A Travel Cost Entry may cover several Project Participations, but that does not change their individual representation.

### MVP identity

The MVP has no global Person record. A person participating in several Projects has one Project Participation per Project. Those records may later link to the same verified Better Auth User.

- Email is optional.
- Email is contact and invitation data, not authentication.
- A normalized non-empty email identifies at most one Project Participation per Project.
- The same email cannot represent two Organizations in the same Project.
- A linked User identifies at most one retained Project Participation per Project.
- Knowing an email never grants access to an existing Project Participation or its data.

### Merge behavior

Duplicate Project Participations are merged explicitly:

1. choose one surviving record;
2. move Calculator and Cost Tracker references to it in one transaction;
3. mark the duplicate as merged into the survivor;
4. retain the duplicate as merge history.

A merge never hard-deletes the duplicate.

## Proposed shared Drizzle schema

This is the approved migration blueprint, not current schema.

### `project`

Keep `organization_id` as the sole owning-Organization reference. Cost Tracker adds:

- `cost_submission_window_open boolean not null default false`

### `project_partner_organization`

- `id` primary key
- `project_id` required foreign key to `project`
- `organization_id` required foreign key to Better Auth `organization`
- creation and update timestamps
- unique `(project_id, organization_id)`

The Partner Organization must differ from the Project's owning Organization.

### `project_participant`

Keep the existing physical table name while treating it as Project Participation. Change it to contain:

- `id` primary key
- `project_id` required foreign key to `project`
- `represented_organization_id` required foreign key to Better Auth `organization`
- `display_name` required
- `email` nullable normalized contact email
- `user_id` nullable foreign key to Better Auth `user`
- Calculator-owned fields such as `country` nullable when participation may be created before the questionnaire
- `merged_into_participant_id` nullable self-reference
- `merged_at` nullable timestamp
- creation and update timestamps

Remove the existing required `member_id`. The Hosting Organization Membership is found from the linked User and `project.organization_id`; storing both `member_id` and `user_id` would allow contradictory identity links.

Required constraints and indexes:

- unique `(project_id, email)` when email is not null
- unique `(project_id, user_id)` when user is not null
- a record cannot merge into itself
- normal reads exclude merged duplicates
- represented Organization equals `project.organization_id` or occurs in `project_partner_organization`

The represented-Organization rule spans tables. Schema implementation must validate it in the write transaction and enforce it with a PostgreSQL constraint trigger or an equivalent database mechanism.

### `project_participation_link`

A reusable application link identifies a Project and represented Organization:

- `id` primary key
- `project_id` required foreign key
- `represented_organization_id` required foreign key
- `token_hash` required unique value
- `enabled` required boolean
- `created_by_user_id` required foreign key
- timestamps

Raw link secrets are never stored. The represented Organization follows the same owning-or-assigned-partner invariant as Project Participation.

### `project_participant_invitation`

This bridge connects a Project Participation to an email-specific Better Auth invitation:

- `id` primary key
- `project_participant_id` required foreign key
- `invitation_id` required unique foreign key to Better Auth `invitation`
- timestamps

Several historical invitation records may reference one Project Participation. Better Auth remains authoritative for invitation status.

## Application extensions

- [Calculator Projects documentation](../../apps/calculator/docs/projects/README.md)
- [Cost Tracker Projects documentation](../../apps/cost-tracker/docs/projects/README.md)
- [Cost Tracker cost model](../../apps/cost-tracker/docs/domain-model.md)
