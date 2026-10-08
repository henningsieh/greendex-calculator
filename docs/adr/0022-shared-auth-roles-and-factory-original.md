---
status: accepted
---

# Shared auth roles and factory

Calculator and Cost Tracker share one role map and one Better Auth factory. Project Coordinator mirrors Organization Administrator for now. Organization Administrator can archive. Both apps build auth through `createServerAuth` in `@greendex/auth`.

## Considered Options

- Coordinator empty and assignment-only (Cost Tracker model). Rejected for now: it breaks Calculator gates and tests. Assignment checks can layer on top later.
- Administrator without archive (old main). Rejected: handler checks already let administrators archive own projects. The role map now matches reality.
- App-local auth config (old main). Rejected: duplicated logic, merge conflicts on every shared seam.

## Consequences

- `archiveProject` still uses handler checks, not role middleware. Administrator archive in the role map changes UI checks and `hasPermission`, not the archive endpoint.
- New guards (one-organization rule, duplicate-name check, invite-role validation) stay on the cost-tracker branch. The reunion merge adopts them with tests.
- Migration journal collision (both branches own a 0015) is untouched. It still needs renumbering in the reunion merge.
