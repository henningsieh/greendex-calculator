---
status: accepted
---

# Centralized feature flags

Policy switches live in one place (`@greendex/config/feature-flags`). Every flag defaults to off. An app turns a flag on by passing it to the shared factory. First flag: `singleOrganization`.

## Considered Options

- Hard-code the one-organization rule for every app. Rejected: it kills Calculator multi-org, which sessions support.
- One flag per app in app code. Rejected: scatters policy, invites drift.
- Central flags with safe defaults. Chosen: shared code, per-app policy, no behavior break.

## Consequences

- Calculator passes no flags today, so its behavior is unchanged.
- Cost Tracker turns `singleOrganization` on during the reunion merge.
- New flags start default-off with tests, same pattern.
