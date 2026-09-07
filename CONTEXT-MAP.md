# Context Map

Greendex has shared project-administration language and two application contexts. Read the shared glossary first, then the context for the application being changed.

## Shared language

- [Greendex Shared Language](./DOMAIN-GLOSSARY.md): Organization, User, Organization Membership, Project, Project Participation, and the people and roles shared by both applications.

## Shared features

- [Projects](./docs/projects/README.md): cross-application Project identity, Project Participation, permissions, and persistence blueprint.

## Contexts

- [Carbon-footprint calculation](./apps/calculator/CONTEXT.md): collects Participant journey and questionnaire data and calculates Project emissions.
- [Cost tracking](./apps/cost-tracker/CONTEXT.md): assigns Partner Organizations to Projects and records journey-ticket costs during a Cost Submission Window.

## Relationships

- Both applications reference the same Organizations, Projects, Users, and Project Participations.
- A Project is owned by one Organization. Cost Tracker calls that Organization the Hosting Organization when contrasting it with Project-specific Partner Organizations.
- Calculator does not expose Project Partnerships or the Hosting/Partner distinction.
- Calculator and Cost Tracker use the same transport configuration, but their CO₂ and cost records remain independent in the MVP.
- Better Auth Organization Memberships provide Organization-level roles. Project Participation identifies the specific Projects in which a person participates.

Architectural rationale is recorded in [ADR-0001](./docs/adr/0001-model-project-organizations-and-participation.md), [ADR-0002](./docs/adr/0002-integrate-participants-with-better-auth.md), and [ADR-0003](./docs/adr/0003-model-cost-submissions-and-travel-costs.md).
