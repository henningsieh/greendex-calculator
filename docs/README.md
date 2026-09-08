---
applyTo: "**"
description: "Repository-wide documentation index and application documentation routes"
---

# Documentation Index

## Ownership rule

Place documentation with the module that owns the behavior:

- Root `docs/`: cross-application architecture, operations, ADRs, and agent routes.
- `apps/<app>/docs/`: behavior and workflows owned by one application.
- `packages/<package>/docs/`: package interfaces and package-owned implementation guidance when needed.
- `apps/documentation/content/docs/`: published user documentation, not engineering documentation.

Sharing a table does not make an application workflow repository-wide. Keep the shared invariant at the root and the consuming workflow with its application.

## Agent navigation

- [Repository rules and scoped instruction index](../AGENTS.md)
- [Task routes](agents/agent-workflows.md)
- [Integration reference routes](agents/integrations.md)
- [Domain documentation route](agents/domain.md)
- [Context map](../CONTEXT-MAP.md) and [shared glossary](../DOMAIN-GLOSSARY.md)
- [Accepted architectural decisions](adr/)

Use the [integration registry](agents/integrations.md) for vendor APIs. Its linked maps preserve Greendex ownership and invariants; official routes provide current library APIs.

## Shared feature documentation

- [Projects](projects/README.md): shared Project identity, Project Participation, and permissions

## Application documentation

### Calculator

- [Calculator documentation index](../apps/calculator/docs/README.md)
- [Participant questionnaire](../apps/calculator/docs/participate/README.md)
- [Emissions calculations](../apps/calculator/docs/participate/emissions-calculations.md)
- [Project behavior and permissions](../apps/calculator/docs/projects/README.md)

### Cost Tracker

- [Cost Tracker documentation index](../apps/cost-tracker/docs/README.md)
- [Cost Tracker Projects](../apps/cost-tracker/docs/projects/README.md)
- [Cost model and proposed Drizzle schema](../apps/cost-tracker/docs/domain-model.md)

## Repository architecture and operations

- [Database documentation](database/README.md)
- [Coolify deployment map](agents/instructions/coolify.md)
- [Drizzle schema and migration map](agents/instructions/drizzle.md)
- [Documentation application map](agents/instructions/documentation-app.md)

## Integration maps

- [oRPC](agents/instructions/orpc.md)
- [TanStack Query](agents/instructions/tanstack-query.md)
- [TanStack Table](agents/instructions/tanstack-table.md)
- [Better Auth](agents/instructions/better-auth.md)
- [Internationalization](agents/instructions/i18n.md)
- [Email](agents/instructions/email.md)
- [shadcn/ui](agents/instructions/shadcn.md)
- [Repository conventions and Oxc](agents/instructions/conventions.md)
