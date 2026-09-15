# Shared Projects Documentation

Project is a shared Greendex feature used by Calculator and Cost Tracker. This directory owns cross-application Project identity, Project Participation, and permission rules; each application documents only its own Project workflows.

## Shared model

- [Project and Project Participation model](model.md)
- [Shared permissions and Participant authentication](permissions.md)
- [Shared domain language](../../DOMAIN-GLOSSARY.md)
- [Context relationships](../../CONTEXT-MAP.md)

## Decisions

- [ADR-0001: Project Organizations and Project Participation](../adr/0001-model-project-organizations-and-participation.md)
- [ADR-0002: Participant integration with Better Auth](../adr/0002-integrate-participants-with-better-auth.md) — superseded where noted by ADR-0005
- [ADR-0004: Scope Project Coordination Through Assignments](../adr/0004-scope-project-coordination-through-assignments.md)
- [ADR-0005: Authenticated Participant Onboarding](../adr/0005-require-authenticated-participant-onboarding.md)
- [ADR-0006: Derive Claim Participants Through Cost Allocations](../adr/0006-derive-claim-participants-through-cost-allocations.md)
- [ADR-0007: Share Participant Journeys and Cap Claims by Funding Rules](../adr/0007-share-participant-journeys-and-cap-claims-by-funding-rules.md)
- [ADR-0008: Return Claims for Partner Correction](../adr/0008-return-claims-for-partner-correction.md)
- [ADR-0009: Approve Claims Before Recording Payment](../adr/0009-approve-claims-before-recording-payment.md)
- [ADR-0010: Reject and Reopen Claims](../adr/0010-reject-and-reopen-claims.md)
- [ADR-0011: Complete Claim Submission and Payment Workflow](../adr/0011-complete-claim-submission-and-payment-workflow.md)

## Application-specific Projects features

- [Calculator Projects](../../apps/calculator/docs/projects/README.md): Project management UI, sorting, and current Calculator permission implementation
- [Cost Tracker Projects](../../apps/cost-tracker/docs/projects/README.md): Project Partnerships and the Cost Submission Window

## Persistence

Shared Project schemas and migrations are owned by [`@greendex/database`](../../packages/database/). The approved but unimplemented schema blueprint is in [model.md](model.md).
