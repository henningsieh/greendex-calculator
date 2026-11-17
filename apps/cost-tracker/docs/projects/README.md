# Cost Tracker Projects

Cost Tracker extends the shared [Project model](../../../../docs/projects/model.md) with Project Partnerships and Claim workflows. Project identity, Project Participation identity, and shared permissions remain repository-level concerns.

**Status:** [Master spec #414](https://github.com/henningsieh/greendex-calculator/issues/414) owns the delivery package. Archive/reopen acceptance remains under [#416](https://github.com/henningsieh/greendex-calculator/issues/416). Settlement filters and table controls are owned by [#332](https://github.com/henningsieh/greendex-calculator/issues/332), Claim naming by [#418](https://github.com/henningsieh/greendex-calculator/issues/418), and UI cookies by [#415](https://github.com/henningsieh/greendex-calculator/issues/415). The interim list order is start date ascending, not the approved settlement order described below.

## Project Partnerships

A Project has one Hosting Organization, derived from the Project's owning Organization, and zero or more Partner Organizations.

```text
Project
├── one Hosting Organization
└── zero or more Partner Organizations
```

Each Partner Organization assignment belongs only to that Project. The same Organization may host a different Project. A Project Participation's represented Organization must be the host or one assigned partner.

Each Project Partnership has at most one Claim. The Project therefore may have several Claims, not just one. This preserves ADR-0001 and the Clickdummy's explicit one-to-many model; see the [cardinality evidence review](../archive/project-partner-cardinality-review.md).

## Project application surfaces

- `/projects` is the bounded, server-authoritative list. It has explicit Hosted and Partner scopes, truthful Project-backed filters and sorts, opaque cursor pagination, whole-scope/current-filter metrics, and links to the canonical workspace.
- `/projects/[id]` is the relationship-derived workspace. Hosted staff see Project context and assigned Partner Organizations. Partner staff see Project context, Hosting Organization identity and their assignment metadata. Under the approved target, archived workspaces remain readable and display archive as the reason for unavailable actions.
- `/partner-organizations` manages Project Partnerships for Projects hosted by the active Organization. Assign/remove procedures remain authoritative and refuse foreign Projects, self-Partnerships, duplicates, and removal that would invalidate represented Project Participations.

The Project detail's Partner projection does not expose financial data, Proof Documents, allocations, Participant identity, or other Partner Organizations. Dedicated Claim and Participant procedures authorize their own reads and writes; these workflows and their persistence are implemented.

## Approved list behavior

- Archive filter: **active / archived / all**, default **active**, in both authorized Hosted and Partner scopes.
- Derived settlement filters: **Abrechnung offen** (settlement open) means an active Project has at least one Partnership without a paid or rejected Claim, including a missing Claim. **Bereit zum Archivieren** (ready to archive) means an active Project has no such blocker. Zero Partnerships also qualifies.
- An archived Project has archive state, not ready-to-archive state. Filters combine by intersection; contradictory choices return an empty result, not a silently adjusted filter.
- No hidden age threshold, automatic archive or “recently closed” rule. Project date-overlap filters remain explicit and separate from sorting.
- Individual Claim-status filters/sorts are not part of this Project-list package. A Project may have several Claims; this list uses their derived settlement state rather than pretending it has one Claim status.
- Default multi-sort: **settlement open → ready to archive → archived**, then **Project start date ascending** within each state. The archive filter still determines which states are included. A stable Project-ID tie-break makes cursor traversal deterministic.
- Start date and end date are separate data columns with ascending/descending header sorting. Other appropriate data columns, including name and settlement state, support sorting; action-only columns do not pretend to be data.
- Multiple ordered sort criteria are supported, with visible priority/direction and discoverable add/remove/reorder controls usable by keyboard and touch. A reset restores the default sort; Shift-click is not the only access path.
- Users may show/hide columns and restore defaults. Column visibility is personal to the authenticated User on the current browser/device. The central UI-cookie factory owns persistence together with Sidebar preferences, using separate cookies for the two settings. Cookie names/defaults/validation are not hidden in components. Authentication cookies are out of scope.

## Table state and performance

Use current TanStack Table v9 feature/state APIs for the result table; baseline and registry-latest at clarification are both 9.3.1. The baseline already uses `useTable`, but does not yet expose the full visibility and multi-sort behavior. TanStack supplies headless table logic, not a ready-made visual control set.

The shared nuqs URL contract owns scope, normalized name search, archive/settlement filters, overlap dates, Partner filters, ordered allowlisted sorts, cursor and page size. Shared links carry filters/sorts, not another User's column preferences. The procedures own filtering, sorting, exact metrics and cursor pagination across the entire authorized filtered result. TanStack renders the returned page with controlled state, not client row stages that reorder/filter just one page. Query keys/cursor fingerprints include the complete ordered state; changing filters/sorts resets the cursor.

The former Cost Submission Window was a read-only legacy flag, not a Claim gate.

## Other work

Existing-Organization discovery requires a directory disclosure policy; the management surface currently accepts an exact known Organization ID. Cost-derived financial Project-list metrics and latest operational activity are not introduced by the archive/filter changes. Open work remains on GitHub.

## Related documentation

- [Current Cost Tracker domain model sources](../domain-model.md)
- [Shared Project permissions](../../../../docs/projects/permissions.md)
- [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0003](../../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
