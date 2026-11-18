---
status: accepted
supersedes:
  - "0020, generic lifecycle grants and archive middleware only"
  - "0027, generic Project reopening permission only"
---

# Scope Project lifecycle permissions by application

## Decision

Calculator and Cost Tracker use separate Better Auth resources, `calculatorProjectLifecycle` and `costTrackerProjectLifecycle`. Both declare `archive` and `reopen`. Generic `project` retains only CRUD actions. Stored Membership roles and unrelated grants remain unchanged.

The central `permissions.ts` owns Better Auth statements and scoped lifecycle metadata alongside all other permissions. Canonical resource and action types derive from the Better Auth statements; stored role types derive from shared role constants. One readonly declaration maps each lifecycle resource, recognized Membership role, and action to Organization or assigned scope. It generates native Better Auth role grants and runtime scope requirements. There is no parallel application/action vocabulary or manually duplicated lifecycle grant matrix. Missing entries deny. Recognized roles combine for the same resource and action only; Organization scope subsumes assigned scope.

| Application | Role | Archive | Reopen |
| --- | --- | --- | --- |
| Calculator | owner | organization | organization |
| Calculator | admin | assigned | assigned |
| Calculator | coordinator | denied | denied |
| Calculator | participant | denied | denied |
| Cost Tracker | owner | organization | organization |
| Cost Tracker | admin | organization | organization |
| Cost Tracker | coordinator | assigned | denied |
| Cost Tracker | participant | denied | denied |

One executor-aware authorization decision reloads the active Organization Membership, evaluates generated native grants, constrains the Project to its owning Organization, and requires a hosted-Project assignment for assigned scope. Neither archive flag filters these queries. A Project Partnership assignment grants no hosted lifecycle authority. Trusted server wiring binds the application; request input cannot select it.

Both mutation commands and existing server-backed availability use this full decision. Availability is a snapshot, never authority for a later command. App adapters retain safe refusal contracts. Cost Tracker passes its existing transaction and retains its Project lock. Static policy and permission imports perform no database initialization.

Both apps expose explicit archive and reopen commands. Calculator no longer accepts an archive boolean toggle. Its reopening needs no reason, and repeated commands still succeed. Cost Tracker retains its settled-Claim prerequisite, required reopening reason, actor/time history, setup-link closure, repeat conflicts, and archived write restrictions. The two archive flags remain independent.

## Alternatives

Separate action middleware and role-name resource branches preserve the drift this decision removes. A common role matrix would change business authority and is rejected. Injected Membership, Project, and assignment readers add security-sensitive contracts for the same shared schema. A schema-backed checker with a required executor keeps the queries and transaction selection together. Native request-level permission callbacks can read outside the caller's transaction and are not sufficient resource authorization.

ADR-0019's role values and assignment boundaries remain in force. ADR-0027's independent lifecycle and financial rules remain in force. Unrelated coordination checks remain unchanged.
