# Cost Tracker Projects

Cost Tracker extends the shared [Project model](../../../../docs/projects/model.md) with Project Partnerships and Claim workflows. Project identity, Project Participation identity, and shared permissions remain repository-level concerns.

## Project Partnerships

A Project has one Hosting Organization, derived from the Project's owning Organization, and zero or one Partner Organization.

```text
Project
├── one Hosting Organization
└── zero or one Partner Organization
```

Each Partner Organization assignment belongs only to that Project. The same Organization may host a different Project. A Project Participation's represented Organization must be the host or one assigned partner.

## Project application surfaces

- `/projects` is the bounded, server-authoritative list. It has explicit Hosted and Partner scopes, truthful Project-backed filters and sorts, opaque cursor pagination, whole-scope/current-filter metrics, and links to the canonical workspace.
- `/projects/[id]` is the relationship-derived workspace. Hosted staff see Project context, the read-only Cost Submission Window, and assigned Partner Organizations. Partner staff see Project context, Hosting Organization identity, the window state, and their assignment metadata.
- `/partner-organizations` manages Project Partnerships for Projects hosted by the active Organization. Assign/remove procedures remain authoritative and refuse foreign Projects, self-Partnerships, duplicates, and removal that would invalidate represented Project Participations.

The Project detail's Partner projection does not expose financial data, Proof Documents, allocations, Participant identity, or other Partner Organizations. Dedicated Claim and Participant procedures authorize their own reads and writes; these workflows and their persistence are implemented.

## List state and performance

The Project list stores scope, normalized name search, window state, overlap dates, Partner filters, allowlisted sort, cursor, and page size in a shared nuqs parser contract. The procedures own filtering, sorting, exact metrics, and cursor pagination; TanStack Table renders only the returned page. Case-insensitive literal substring search uses a partial trigram index, while Hosted operational/date indexes support the principal tenant-scoped paths.

## Cost Submission Window

The legacy Project-wide Cost Submission Window flag is read-only and does not gate Claim work. Claims follow their own [lifecycle and authorization rules](../claim-workflow.md). The flag does not change Organization Memberships or roles.

## Deferred decisions

Recently-closed filtering requires a persisted transition timestamp and duration. Existing-Organization discovery requires a directory disclosure policy; the management surface currently accepts an exact known Organization ID. Cost-derived Project-list metrics and latest operational activity remain separate from the existing Claim workspace.

## Related documentation

- [Project list query-plan validation](list-query-plan-validation.md)
- [Current Cost Tracker domain model sources](../domain-model.md)
- [Shared Project permissions](../../../../docs/projects/permissions.md)
- [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0003](../../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
