# Domain Docs

Use this route before changing domain language, relationships, business rules, or persistence models.

## Read in order

1. [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md) to identify the owning context and its relationships.
2. [`DOMAIN-GLOSSARY.md`](../../DOMAIN-GLOSSARY.md) for language shared by every application.
3. The owning context:
   - [Calculator](../../apps/calculator/CONTEXT.md)
   - [Cost Tracker](../../apps/cost-tracker/CONTEXT.md)
4. Accepted records in [`docs/adr/`](../adr/) that concern the change.
5. The owning application's documentation index.

Proceed silently when a lazily created context or ADR directory does not yet exist.

## Ownership

```text
/
├── CONTEXT-MAP.md                    ← context navigation and relationships
├── DOMAIN-GLOSSARY.md                ← shared canonical language
├── docs/adr/                         ← cross-context architectural decisions
├── docs/projects/                    ← shared Project model and permissions
├── apps/calculator/CONTEXT.md        ← carbon-footprint language
├── apps/calculator/docs/             ← Calculator behavior
├── apps/cost-tracker/CONTEXT.md      ← cost-tracking language
└── apps/cost-tracker/docs/           ← Cost Tracker behavior
```

Root `docs/` contains repository-wide architecture, operations, decisions, and agent routes. App-specific flows belong under the owning application's `docs/` directory. Package-specific persistence or integration details belong with the owning package when introduced.

## Language rules

- Use the shared glossary for Organization, User, Membership, Project, Project Participation, and Participant.
- Use the app context for terms that another application does not expose. For example, Partner Organization and Cost Submission Window belong to Cost Tracker.
- Treat shared database identity and shared business behavior separately. Two applications referencing the same Project does not make every Project workflow shared.
- When a new term conflicts with existing language, resolve the conflict before changing code and update the owning glossary immediately.

## Decisions

Read every ADR that intersects the change. Surface conflicts explicitly rather than silently overriding an accepted decision. Changes to an accepted relationship, authentication model, or cost-allocation invariant require a superseding ADR.
