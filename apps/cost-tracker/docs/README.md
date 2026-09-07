# Cost Tracker Engineering Documentation

These documents describe behavior owned by the Cost Tracker application.

## Read first

- [Cost Tracking context](../CONTEXT.md)
- [Shared Greendex language](../../../DOMAIN-GLOSSARY.md)
- [Shared Projects documentation](../../../docs/projects/README.md)
- [Cost Tracker Projects](projects/README.md)
- [Cost model and schema blueprint](domain-model.md)

## Decisions

- [Project Organizations and Project Participation](../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [Participant integration with Better Auth](../../../docs/adr/0002-integrate-participants-with-better-auth.md)
- [Cost Submissions and Travel Costs](../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)

## Scope

Cost Tracker owns Project Partnerships, Cost Submission Windows, Cost Submissions, Proof Documents, Travel Cost Entries, and Cost Allocations. Shared Organizations, Projects, Users, Project Participations, database persistence, and transport configuration remain repository-level concerns.
