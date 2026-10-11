# Archive — Cost Tracker architecture review

These documents are **finished work**. Do not use them as instructions, and do not take new decisions from them.

The Phase 0–8 architecture migration is complete. The [final review](architecture-migration-final-review.md) accepts all six Phase 6–8 delivery areas, and it does not reopen accepted work.

## Why these files are archived

Every file here is a point-in-time review artifact. Its repository baseline describes the codebase as it stood in September 2026, not the current branch. For example, the plan states that `/projects/[id]`, the Claim and Cost procedures, `nuqs`, and `@tanstack/react-table` do not exist. They all shipped since.

Keeping them beside the live documentation made them look authoritative. A reader could follow a stale instruction and lose time. They are moved here so that the live documentation folder contains only current guidance.

## Contents

| Document                                                                                  | What it is                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Architecture review and migration plan](architecture-review-and-migration-plan.md)       | The Phase 0–8 plan. Its 42-entry **Binding decision log is a closed record**: every entry already states its answer.                                                                 |
| [Architecture review after the migration fix](architecture-review-after-migration-fix.md) | Standards review, 13 findings, for `1257069..4903da2`.                                                                                                                               |
| [Architecture migration fix plan](architecture-migration-fix-plan.md)                     | Which of those 13 findings were fixed now, and which moved to follow-up issues.                                                                                                      |
| [Final Cost Tracker migration review](architecture-migration-final-review.md)             | The verdict on issue #121. Accepts the six delivery areas.                                                                                                                           |
| [Phase 0 – kurze Erklärung](phase-0-erklaerung.md)                                        | German-language note on the missing Phase 0 coordination record. States that no product-code change is missing, and that the record cannot honestly be reconstructed after the fact. |

## Where the live material went

- **Decisions** → [ADRs](../../../../docs/adr/). These are the durable record of _why_ the design has its current shape.
- **Open questions** → [the backlog](../backlog/). The six questions retained by the plan are now tracked in [architecture-review-open-questions.md](../backlog/architecture-review-open-questions.md). They are no longer open inside an archived file.
- **Current rules** → [Cost Tracker architecture](../architecture.md), [the cost model](../domain-model.md), and the scoped instructions in [`docs/agents/instructions/`](../../../../docs/agents/instructions/).
