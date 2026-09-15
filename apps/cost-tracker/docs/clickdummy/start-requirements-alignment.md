# Start the Clickdummy Requirements Alignment

Use `/grill-with-docs` to guide this work step by step. This is a discovery and planning phase, not an implementation task.

## Primary sources

- Original request: [`align-with-requirements.md`](align-with-requirements.md)
- Clickdummy repository: <https://github.com/nilsleichsenring/KarmensLittleHelper.git>
- Live clickdummy: <https://karmens-little-helper.vercel.app>
- Cost Tracker context: [`../../CONTEXT.md`](../../CONTEXT.md)
- Cost Tracker documentation index: [`../README.md`](../README.md)
- Repository domain route: [`../../../../docs/agents/domain.md`](../../../../docs/agents/domain.md)
- Shared context map: [`../../../../CONTEXT-MAP.md`](../../../../CONTEXT-MAP.md)
- Shared glossary: [`../../../../DOMAIN-GLOSSARY.md`](../../../../DOMAIN-GLOSSARY.md)

The clickdummy is authoritative evidence for intended actors, domain requirements, business rules, and use cases. Its terminology, information architecture, interaction patterns, visual design, source structure, and implementation choices are hypotheses to evaluate—not specifications to copy. Preserve traceability between every extracted requirement and its clickdummy evidence.

## Process

1. Read the original request and all applicable repository instructions and Cost Tracker domain documentation.
2. Inspect both clickdummy sources:
   - Examine its repository, including its own domain and process documents, routes, state, and implemented behavior.
   - Walk through the live deployment to observe reachable workflows, labels, states, navigation, validation, and dead ends.
   - Record differences between documentation, source behavior, and deployed behavior rather than silently reconciling them.
3. Interview me with `/grill-with-docs` to resolve product and domain decisions. Treat facts discoverable from the repositories or live app as agent legwork; ask me only for judgments or unavailable knowledge. Update Cost Tracker context or propose ADRs when the interview changes domain language or makes a hard-to-reverse decision.
4. Create a traceable use-case inventory. For every use case, capture:
   - actor and goal;
   - preconditions and trigger;
   - happy path, alternatives, and failure cases;
   - business rules and state transitions;
   - evidence links to clickdummy files, routes, or live screens;
   - confidence and unresolved questions.
5. Compare that inventory with the current Cost Tracker. Classify each capability as:
   - already supported;
   - partially supported;
   - missing;
   - intentionally rejected;
   - unresolved.
6. Separately evaluate each clickdummy design choice as:
   - domain invariant to preserve;
   - product behavior to reinterpret;
   - accidental UI or implementation decision to replace.

   In particular, infer the user goal behind card-based interactions instead of carrying the card interaction forward by default.

7. Recommend the smallest coherent vertical slice that exercises real domain behavior end to end. State its dependencies, acceptance boundaries, unresolved decisions, and why it is the best first slice.
8. Stop before implementation. Present the findings and proposed documentation changes for approval. Once the requirements are sufficiently resolved, recommend whether to continue with `/to-spec`, detour through `/prototype` for a runnable interaction question, or use `/wayfinder` if the product surface remains too large to map in one session.

## Discovery output

- [Use-case traceability](requirements-traceability.md)
- [Claim workflow target](../claim-workflow.md)

## Completion criteria

Discovery is complete only when:

- every reachable clickdummy workflow is represented in the inventory or explicitly marked inaccessible;
- every inventory item has evidence and a comparison classification;
- domain requirements are clearly separated from inherited UI and implementation choices;
- terminology conflicts with the Greendex glossary are listed and resolved or marked open;
- the proposed first vertical slice is bounded and traceable to the inventory;
- unresolved decisions are presented to me rather than guessed;
- no production implementation has begun.
