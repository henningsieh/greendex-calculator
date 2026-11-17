# Project–Partner Cardinality Source Review

**Completed evidence review.** This file records the sources inspected during the v0.1.1 specification clarification. It is not an implementation plan or current instruction. Live terminology is in the [glossary](../../GLOSSARY.md); current behavior is in [domain behavior](../domain-behavior.md). The accepted zero-to-many relationship remains defined by ADR-0001.

## Pinned sources

- Greendex baseline: `3863c601accae15ea07f5a2a82bac33b5c3afff3`.
- Clickdummy: `nilsleichsenring/KarmensLittleHelper` at `114ff266398dbd7589ba2729a25e64ac98f5951d`.
- Contrary historical work: GitHub [#337](https://github.com/henningsieh/greendex-calculator/issues/337), local commits `a368e1fe`, `003e7e2c`, and unfinished branch `feat/337-at-most-one-partner-broken` at `ffd4f7fa`.

## Findings

1. The Clickdummy [Domain Model §3.2, lines 337–341](https://github.com/nilsleichsenring/KarmensLittleHelper/blob/114ff266398dbd7589ba2729a25e64ac98f5951d/docs/domain-model.md#L337-L341) describes “one Host Organisation in cooperation with one or more Partner Organisations”.
2. Its [§8.11, lines 2812–2828](https://github.com/nilsleichsenring/KarmensLittleHelper/blob/114ff266398dbd7589ba2729a25e64ac98f5951d/docs/domain-model.md#L2812-L2828) explicitly states **Project → Partner Organisation: One to many**, **Project → Claim: One to many**, and **Partner Organisation → Claim: Zero or one (Version 1.1)**. These are business cardinalities, not merely plural variable names. The one-Claim limit belongs to one Partner's participation in a Project, not to the entire Project.
3. [ProjectPartnersPage.tsx, lines 89–110 and 250–281](https://github.com/nilsleichsenring/KarmensLittleHelper/blob/114ff266398dbd7589ba2729a25e64ac98f5951d/src/pages/admin/project/ProjectPartnersPage.tsx#L89-L110) queries all Partners for one Project and renders their individual entries. Its targeted removal and invitation flow are consistent with several Partners. [ProjectDashboardPage.tsx](https://github.com/nilsleichsenring/KarmensLittleHelper/blob/114ff266398dbd7589ba2729a25e64ac98f5951d/src/pages/admin/project/ProjectDashboardPage.tsx#L145-L199) loads all Partners/Claims and evaluates aggregate readiness across them.
4. Greendex [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md) explicitly accepts zero or more Partner Organizations. The baseline schema in `packages/database/src/schemas/project-schema.ts` makes `(projectId, organizationId)` unique, not `projectId` alone, while `claims.partnershipId` is unique. The implementation therefore distinguishes many Partnerships from at most one Claim per Partnership.
5. Historical commit `003e7e2c` moved the question into a backlog document asserting that the Clickdummy used only singular language and did not demonstrate two Partners. The singular-language assertion does not match the inspected Clickdummy source. #337 subsequently recorded a separate Maintainer decision for at most one Partner, but provides no primary Clickdummy rule establishing that restriction or evidence of the Maintainer's reasoning.
6. #337's comment identifies unfinished, unmerged implementation on `feat/337-at-most-one-partner-broken`. Its added unique-Project constraint is not part of the release baseline. The specification decision retains zero-to-many and withdraws #337; that branch was not modified or merged by this review.

## Evidence limits

The Clickdummy clone is shallow. Its inspected commit is dated 26 August 2026, before the 3 October 2026 backlog commits, but boundary blame does not establish when each individual line originated or which source the earlier authors actually consulted. No claim is made about their motivation. No live demonstration database with two Partner rows or real programme dataset was inspected, and no Clickdummy schema/migration file was found. The business specification and concrete multi-Partner interface nevertheless establish the intended upper cardinality clearly. Allowing zero during initial setup is independently confirmed by Greendex ADR-0001 and the operator's decision; the Clickdummy's “one or more” wording is not used to require a Partner at Project creation.
