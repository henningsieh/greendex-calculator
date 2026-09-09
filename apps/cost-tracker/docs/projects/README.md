# Cost Tracker Projects

Cost Tracker extends the shared [Project model](../../../../docs/projects/model.md) with Project Partnerships and a Cost Submission Window. It does not own Project identity, Project Participation, or shared permissions.

## Project Partnerships

A Project has one Hosting Organization, derived from the Project's owning Organization, and zero or more Partner Organizations.

```text
Project
├── one Hosting Organization
└── zero or more Partner Organizations
```

Each Partner Organization assignment belongs only to that Project. The same Organization may host a different Project. A Project Participation's represented Organization must be the host or one assigned partner.

## Project application surfaces

- `/projects` is the bounded, server-authoritative collection. It has explicit Hosted and Partner scopes, truthful Project-backed filters and sorts, opaque cursor pagination, whole-scope/current-filter metrics, and links to the canonical workspace.
- `/projects/[id]` is the relationship-derived workspace. Hosted staff see Project context, the read-only Cost Submission Window, and assigned Partner Organizations. Partner staff see Project context, Hosting Organization identity, the window state, and their assignment metadata.
- `/partner-organizations` manages Project Partnerships for Projects hosted by the active Organization. Assign/remove procedures remain authoritative and refuse foreign Projects, self-Partnerships, duplicates, and removal that would invalidate represented Project Participations.

Partner projections never expose financial data, individual submissions, Proof Documents, allocations, Participant identity, or other Partner Organizations. Those persistence models are not implemented.

## Collection state and performance

The Project collection stores scope, normalized name search, window state, overlap dates, Partner filters, allowlisted sort, cursor, and page size in a shared nuqs parser contract. The procedures own filtering, sorting, exact metrics, and cursor pagination; TanStack Table renders only the returned page. Case-insensitive literal substring search uses a partial trigram index, while Hosted operational/date indexes support the principal tenant-scoped paths.

## Cost Submission Window

Each Project has one open/closed Cost Submission Window. Phase 8 displays that state read-only. The complete future [editing and authorization rules](../domain-model.md#editing-and-authorization) remain approved design; window changes never alter Better Auth Memberships or roles.

## Deferred decisions

Recently-closed filtering requires a persisted transition timestamp and duration. Existing-Organization discovery requires a directory disclosure policy; the management surface currently accepts an exact known Organization ID. Cost-derived metrics, latest operational activity, and Cost Submission workspace sections wait for their persistence and authorization designs.

## Related documentation

- [Project overview query-plan validation](query-plan-validation.md)
- [Cost Tracker domain and cost schema](../domain-model.md)
- [Shared Project permissions](../../../../docs/projects/permissions.md)
- [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0003](../../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
