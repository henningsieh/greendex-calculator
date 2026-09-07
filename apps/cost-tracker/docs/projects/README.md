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

## Cost Submission Window

Each Project has one manually controlled open/closed Cost Submission Window. Cost Tracker owns its state and the complete [editing and authorization rules](../domain-model.md#editing-and-authorization). Window changes never alter Better Auth Memberships or roles.

## Related documentation

- [Cost Tracker domain and cost schema](../domain-model.md)
- [Shared Project permissions](../../../../docs/projects/permissions.md)
- [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0003](../../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
