# Calculator Engineering Documentation

These documents describe behavior owned only by the Calculator application. Repository-wide architecture, domain language, integrations, and operations remain indexed from [`docs/README.md`](../../../docs/README.md).

## Domain context

- [Calculator glossary](../GLOSSARY.md)
- [Shared Greendex language](../../../GLOSSARY.md)
- Other contexts: [Cost Tracker](../../../apps/cost-tracker/GLOSSARY.md) · [Documentation](../../../apps/documentation/GLOSSARY.md) — overview in [Glossary map](../../../GLOSSARY-MAP.md)

## Features

- Transport profiles: Cost Tracker reuses Calculator's Participant profile set (`PARTICIPANT_TRANSPORT_EMISSION_PROFILES`); Calculator's Project Shared Travel profile set remains narrower.

- [Participant questionnaire](participate/README.md)
- [Project behavior and permissions](projects/README.md)

## Related repository documentation

- [Shared Projects documentation](../../../docs/projects/README.md)
- [Architecture instructions](../../../docs/agents/instructions/architecture.md)
- [Better Auth integration](../../../docs/agents/instructions/better-auth.md)
- [oRPC integration](../../../docs/agents/instructions/orpc.md)
- [Database documentation](../../../docs/database/README.md)
