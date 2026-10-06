---
status: accepted
supersedes:
  - 0019, Calculator coordinator Project grants only
---

# Shared auth roles and factory

Calculator and Cost Tracker share one Better Auth factory with separate app role maps. Calculator Project Coordinator mirrors Organization Admin for Project create, read, and update. It cannot archive or delete. Cost Tracker keeps assignment-scoped coordination. Organization Administrator can archive. Both apps build auth through `createServerAuth` in `@greendex/auth`.

This partially supersedes [ADR-0019](0019-require-organization-country-and-synchronize-role-values.md): Calculator Coordinator now has Project create, read, and update grants instead of no grants. All other ADR-0019 decisions remain in force.

## Considered Options

- Coordinator empty and assignment-only (Cost Tracker model). Rejected for now: it breaks Calculator gates and tests. Assignment checks can layer on top later.
- Administrator without archive (old main). Rejected: handler checks already let administrators archive own projects. The role map now matches reality.
- App-local auth config (old main). Rejected: duplicated logic, merge conflicts on every shared seam.

## Consequences

- Calculator `archiveProject` checks both the declared archive permission and its Host assignment rules. The permission middleware reads Better Auth's `success` result.
- The shared factory validates roles, country, and unique Organization names. Cost Tracker enables the single-Organization flag. Calculator leaves it off.
- The reunion merge keeps the Cost Tracker migration journal. Its snapshots already cover the member role default and Organization country. Both development databases pass full-chain migration from zero.
