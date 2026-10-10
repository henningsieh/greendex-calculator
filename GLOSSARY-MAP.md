# Greendex Glossary Map

## Contexts

- [Shared language](GLOSSARY.md): Organizations, Projects, Users, participation, and journeys used across applications. Read this before the relevant app glossary.
- [Calculator](apps/calculator/GLOSSARY.md): carbon-footprint calculation from Participant journeys and questionnaire data. Behavior: [Calculator docs](apps/calculator/docs/README.md).
- [Cost Tracker](apps/cost-tracker/GLOSSARY.md): journey-ticket costs per Partner Organization, Project Partnerships, and Claims. Behavior: [Cost Tracker docs](apps/cost-tracker/docs/README.md).
- [Documentation](apps/documentation/GLOSSARY.md): published user documentation, not engineering documentation. Behavior: [documentation application](docs/agents/instructions/documentation-app.md).

## Relationships

- **Calculator ↔ Cost Tracker**: share Organization, Project, User, Project Participation, Participant Journey, and transport configuration identities. Carbon-footprint and cost records remain independent; shared identity does not make every workflow shared.
- **Cost Tracker → Calculator**: Cost Tracker owns Project Partnerships and the Hosting/Partner distinction; Calculator does not expose that distinction. Cost Tracker's authenticated participation rules refine the broader shared participation vocabulary without changing Calculator compatibility.
- **Documentation → product contexts**: publishes user-facing explanations; repository and app engineering documentation remain separate from published content.

## Engineering routes

- [Domain documentation rules](docs/agents/domain.md): terminology changes, behavior ownership, and ADR conflicts.
- [Shared Projects](docs/projects/README.md): relationships and permissions.
- [ADRs](docs/adr/README.md): consequential decisions; existing accepted records retain their history.
