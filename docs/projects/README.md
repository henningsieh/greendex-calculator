# Shared Projects Documentation

Project is a shared Greendex feature used by Calculator and Cost Tracker. This directory owns cross-application Project identity, Project Participation, and permission rules; each application documents only its own Project workflows.

## Shared model

- [Project and Project Participation model](model.md)
- [Shared permissions and Participant authentication](permissions.md)
- [Shared domain language](../../DOMAIN-GLOSSARY.md)
- [Context relationships](../../CONTEXT-MAP.md)

## Decisions

- [ADR-0001: Project Organizations and Project Participation](../adr/0001-model-project-organizations-and-participation.md)
- [ADR-0002: Participant integration with Better Auth](../adr/0002-integrate-participants-with-better-auth.md)

## Application-specific Projects features

- [Calculator Projects](../../apps/calculator/docs/projects/README.md): Project management UI, sorting, and current Calculator permission implementation
- [Cost Tracker Projects](../../apps/cost-tracker/docs/projects/README.md): Project Partnerships and the Cost Submission Window

## Persistence

Shared Project schemas and migrations are owned by [`@greendex/database`](../../packages/database/). The approved but unimplemented schema blueprint is in [model.md](model.md).
