# Domain Docs

Use this route before changing domain language, relationships, business rules, or persistence models.

## Read in order

1. [Glossary map](../../GLOSSARY-MAP.md) to identify the owning context, relationships, and behavior routes.
2. [`GLOSSARY.md`](../../GLOSSARY.md) for language shared by every application.
3. The relevant app glossary:
   - [Calculator](../../apps/calculator/GLOSSARY.md)
   - [Cost Tracker](../../apps/cost-tracker/GLOSSARY.md)
   - [Documentation](../../apps/documentation/GLOSSARY.md)
4. Accepted records in [`docs/adr/`](../adr/) that concern the change.
5. The owning application's documentation index.

Proceed silently when a glossary or ADR directory does not yet exist. Create these lazily through `/domain-modeling` only when a term or qualifying decision is resolved.

## Ownership

```text
/
├── GLOSSARY-MAP.md                   ← context navigation and relationships
├── GLOSSARY.md                       ← shared canonical language
├── docs/adr/                         ← cross-context architectural decisions
├── docs/projects/                    ← shared Project model and permissions
├── apps/calculator/GLOSSARY.md       ← carbon-footprint language
├── apps/calculator/docs/             ← Calculator behavior
├── apps/cost-tracker/GLOSSARY.md      ← cost-tracking language
├── apps/cost-tracker/docs/           ← Cost Tracker behavior
├── apps/documentation/GLOSSARY.md    ← publishing language
└── apps/documentation/content/docs/  ← published user documentation
```

Root `docs/` contains repository-wide architecture, operations, decisions, and agent routes. App-specific flows belong under the owning application's `docs/` directory. Package-specific persistence or integration details belong with the owning package when introduced.

## Language rules

- Use the shared glossary for Organization, User, Membership, Project, Project Participation, and Participant.
- Use the app glossary for terms that another application does not expose. For example, Partner Organization and Cost Submission Window belong to Cost Tracker. Shared terms have one definition unless an app explicitly refines their meaning; Cost Tracker refines Project Participation for authenticated participation.
- Treat shared database identity and shared business behavior separately. Two applications referencing the same Project does not make every Project workflow shared.
- When a new term conflicts with existing language, resolve the conflict before changing code and update the owning glossary immediately.
- Use the canonical terms in issue titles, hypotheses, tests, and proposals; consult `_Avoid_` entries before substituting synonyms.
- Keep glossaries to project-specific terms: one or two sentences defining what a concept is, with `_Avoid_` alternatives where useful. Put workflow, schema fields, permission identifiers, and implementation details in behavior or instruction docs, not glossaries.
- Read the owning behavior docs when changing rules: [shared Projects](../projects/README.md), [Cost Tracker domain behavior](../../apps/cost-tracker/docs/domain-behavior.md), and the app documentation routes in the map.

## Decisions

Read every ADR that intersects the change. Surface conflicts explicitly rather than silently overriding an accepted decision. Changes to an accepted relationship, authentication model, or cost-allocation invariant require a superseding ADR.

Offer a new ADR only when a choice is hard to reverse, surprising without its context, and the result of a real trade-off. Record the decision and why briefly; retain the numbering and history of existing ADRs. This documentation migration changes neither domain rules nor accepted decisions.
