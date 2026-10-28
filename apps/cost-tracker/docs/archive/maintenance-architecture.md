# Cost Tracker maintenance architecture

Status: approved implementation plan; not a description of the fully migrated code.
Starting point: `release/v0.1.1` at `a6e9e0611b3b34f9667a952cf9f221c143660ada`, on `chore/maintainance`.

[Issue #329](https://github.com/henningsieh/greendex-calculator/issues/329) is the lint-cleanup entry point, not the specification for the larger ownership refactor. Its repository-wide scope remains open: this work addresses Cost Tracker only. The read-only baseline found 63 repository diagnostics, 28 within Cost Tracker, including all eight complexity diagnostics.

## Approved constraints

- Preserve existing functionality exactly: user-visible workflows, routes, procedure contracts, permissions, error semantics, validation, money calculations, transaction guarantees, and recovery behavior.
- Reduce navigational and implementation complexity; do not introduce a framework, dependencies, generic workflow engine, repository/service indirection, or speculative abstractions.
- Use a Cost Tracker-specific advisory complexity threshold of 20, as authorized during implementation. The repository-wide threshold remains 25. Extract cohesive responsibilities rather than splitting code mechanically to satisfy the metric.
- Product changes are limited to Cost Tracker. Necessary Cost Tracker-specific root tooling, tests, and documentation references may change. Shared schemas and other applications are not part of the refactor.
- Keep existing shared permission rules and Claim lifecycle/locking implementations single-sourced. Feature ownership does not imply independent lifecycles.
- Preserve the SSR initialization, request-scoped query, server/client, and persistence seams.

## Target ownership

| Feature                  | Responsibility                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `authentication`         | Login, session, general account onboarding                                                                        |
| `organizations`          | Organization settings, Memberships, colleague invitations, Organization switching                                 |
| `projects`               | Project listing, creation, details, completion, Project scope                                                     |
| `partnerships`           | Project Partnership assignments, setup links, coordinator administration, Partnership scope                       |
| `participations`         | Project Participation management, reports, duplicate review, Participant Journeys                                 |
| `participant-onboarding` | Participant Invitations, Registration Links, required information, Participant Agreement acceptance, joining      |
| `claims`                 | Claim draft, Travel Cost Entries, Cost Allocations, Proof Documents, submission, review, payout workflow, payment |
| `user-settings`          | Personal preferences                                                                                              |

Use flat features with local `components/` and `procedures/` directories rather than mandatory business-subfolder hierarchies. Participant Onboarding is a top-level feature and uses the same technical organization. Create directories only when used. Keep schemas, inferred types, hooks, and pure policies with their owner; pure calculations such as payable derivation are not procedures.

Project Participation still belongs to the Project. Participant Agreement acceptance still belongs to the User. Payout Accounts remain Organization-owned and selected by Project Partnership; retain the existing combined payout workflow within Claims rather than distributing it across three features. Folder placement does not change those relationships.

## Imports and composition

- Routes retain composition responsibilities and existing URL structure.
- Explicit `@/features/…` imports may cross feature ownership where existing behavior requires it. Do not copy rules to eliminate legitimate dependencies or introduce forwarding barrels.
- Claim screens may compose Participant Journey UI owned by Participations. Claim-affecting writes still use the same Claim lock coverage/order and lifecycle rules.
- Move genuinely shared UI to `src/components/`; move feature-specific loading UI with its owner. Infrastructure remains in `src/lib/`.
- Keep colocated tests with their implementation and retain end-to-end workflow coverage. Do not replace observable-behavior tests with tests of extracted private fragments.
- Adapt the Cost Tracker persistence checker for nested onboarding procedures without permitting database access from views or weakening import-chain checks.

## Implementation sequence

1. Record this plan, terminology, and baseline.
2. Pilot Claim ownership using mechanical moves and import updates; retain the existing router interface.
3. Address affected cleanup in separate reviewable changes. Extract cohesive behavior only when it reduces what callers must understand, not to satisfy a file-length target.
4. Move Partnership, Participation, and Participant Onboarding ownership with their tests.
5. Resolve the remaining Cost Tracker diagnostics from #329 without broad suppression or relaxed thresholds.
6. Update the current architecture and documentation navigation to match the implemented ownership; distinguish historical model documents from current behavior.
7. Complete final verification and independent Standards/Spec review before delivery. Keep implementation issues open until merged.

## Verification and acceptance

Follow the repository's [two-loop policy](../../../../docs/agents/instructions/conventions.md#two-verification-loops): focused checks for each changed seam, then centrally owned final suites and review. Include affected procedure integrations, UI behavior, SSR initialization, persistence-checker regressions, type checks, formatting and lint. Runtime checks borrow existing environments; the operator owns production build/start. Report missing services and any unrun gates explicitly.

Operator execution restriction: run only selected per-file/test-file checks during this refactor, with one test worker. Do not run full suites against the development server on this machine. The large suite and evidence runs are deferred until implementation is finished and will be performed together with the operator; they are not a passed delivery gate until then.

The `.audit/323` handover records historical evidence at `c1f30c578b68b8e04ca1c22351d8bc3b7e034ef1`, not verification of a changed candidate. Capture fresh evidence for this work.

Success means a maintainer can locate Claim approval, Partnership setup, and Participant Onboarding from their business names without searching a catch-all feature. A smaller complexity diagnostic count alone does not prove success.

## Documentation authority

Use the [glossary](../../GLOSSARY.md), [current domain behavior](../domain-behavior.md), [Claim workflow](../claim-workflow.md), and accepted ADRs. [Domain model sources](../domain-model.md) now routes to those current documents; the former Cost Submission blueprint is archived. Keep [current architecture](../architecture.md) aligned as slices land; this plan does not silently override current instructions before implementation.
