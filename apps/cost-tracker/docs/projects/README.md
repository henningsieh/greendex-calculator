# Cost Tracker Projects

Cost Tracker extends the shared [Project model](../../../../docs/projects/model.md) with Project Partnerships and Claim workflows. Project identity, Project Participation identity, and shared permissions remain repository-level concerns.

**Status:** [Master spec #414](https://github.com/henningsieh/greendex-calculator/issues/414) tracks the implemented delivery package and its final release acceptance. Archive/reopen belongs to [#416](https://github.com/henningsieh/greendex-calculator/issues/416), list status and table controls to [#332](https://github.com/henningsieh/greendex-calculator/issues/332) and [#437](https://github.com/henningsieh/greendex-calculator/issues/437), Claim naming to [#418](https://github.com/henningsieh/greendex-calculator/issues/418), and UI cookies to [#415](https://github.com/henningsieh/greendex-calculator/issues/415). The list uses the Status-first order described below.

## Lifecycle authorization

`costTrackerProjectLifecycle.archive` permits active Hosting Organization Owners and Admins, and explicitly assigned Hosting-side Project Coordinators. `costTrackerProjectLifecycle.reopen` permits only Hosting Organization Owners and Admins. Participant-only and Partner-side authority never suffice. Generic Project CRUD grants contain no lifecycle actions.

Participant-only archive requests receive the generic `ACCESS_DENIED` refusal. The former `HOST_COORDINATION_REQUIRED` refusal is not the lifecycle contract; it remains applicable to other coordination checks and assignment-scoped lifecycle refusals.

The [shared lifecycle policy](../../../../docs/projects/permissions.md#application-specific-project-lifecycle-permissions) generates native grants and scopes. Commands and Hosted detail availability use the same full executor-backed authorization decision. Each command reloads current Membership and assignment records inside its existing locked transaction. Availability is only a snapshot.

Archive retains the settled-Claim or zero-Partnership requirement and closes setup links. Reopen requires a reason. Both retain actor/time history, leave Claim statuses unchanged, and affect only Cost Tracker's archive flag. Calculator reopening has independent authority and no reason requirement. [ADR-0028](../../../../docs/adr/0028-scope-project-lifecycle-permissions-by-application.md) records this authorization replacement without changing ADR-0027's business rules.

## Project Partnership ownership

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

- One Status facet in both authorized Hosted and Partner scopes, with three mutually exclusive values: **Settlement open**, **Ready to archive** and **Archived**. The table column, filter options and sort use the same ordered definition (`open` → `ready` → `archived`).
- Status is a derived, read-only projection, not a fourth machine. An archived Project is **Archived**. An active Project is **Ready to archive** when every Project Partnership has a settled Claim (paid or rejected); zero Partnerships qualifies. An active Project with any missing or unsettled Claim is **Settlement open**. Archivedness masks the readiness labels.
- The Status filter is multi-select. Its default selection is **Settlement open + Ready to archive**, which is the previous active-only view; the procedure itself applies no status filter unless one is sent. Selecting **Archived** is the archive shortcut. Selecting every value behaves like no constraint, and an empty selection means no status constraint, so a cleared filter never dead-ends on an empty list.
- “Clear filters” restores the default Status selection, not the unfiltered register.
- Contradictory filter combinations are unrepresentable because archivedness is now a Status value rather than an adjacent axis.
- No hidden age threshold, automatic archive or “recently closed” rule. Project date-overlap filters remain explicit and separate from sorting.
- Individual Claim-status filters/sorts are not part of this Project-list package. A Project may have several Claims; this list uses their derived Status rather than pretending it has one Claim status.
- Default multi-sort: **Status ascending (Settlement open → Ready to archive → Archived)**, then **Project start date ascending** within each Status. Ascending Status therefore means “open first”; the header and sort summary announce that outcome instead of bare ascending/descending words, while `aria-sort` keeps its standard values. A stable Project-ID tie-break makes cursor traversal deterministic.
- Start date and end date are separate data columns with ascending/descending header sorting. Other appropriate data columns, including name and Status, support sorting; action-only columns do not pretend to be data.
- Multiple ordered sort criteria are supported, with visible priority/direction and discoverable add/remove/reorder controls usable by keyboard and touch. A reset restores the default sort; Shift-click is not the only access path.
- Users may show/hide columns and restore defaults. Column visibility is personal to the authenticated User on the current browser/device. The central UI-cookie factory owns persistence together with Sidebar preferences, using separate cookies for the two settings. Cookie names/defaults/validation are not hidden in components. Authentication cookies are out of scope.

## Table state and performance

The result table uses TanStack Table v9 controlled sorting and visibility state. Sortable headers show direction and priority; the sorting menu supports adding, reordering, removing and resetting criteria. A column menu restores personal visibility preferences. TanStack supplies headless table logic; the visual controls use the shared UI components.

The shared nuqs URL contract owns scope, normalized name search, the repeated `status` selection, overlap dates, Partner filters, ordered allowlisted sorts, cursor and page size. The old `archive` and `settlement` parameters are removed without compatibility handling. Shared links carry filters/sorts, not another User's column preferences. The procedures own filtering, sorting, exact metrics and cursor pagination across the entire authorized filtered result. TanStack renders the returned page with controlled state, not client row stages that reorder/filter just one page. Query keys/cursor fingerprints include the complete ordered state; changing filters/sorts resets the cursor.

The former Cost Submission Window was a read-only legacy flag, not a Claim gate.

## Other work

Existing-Organization discovery requires a directory disclosure policy; the management surface currently accepts an exact known Organization ID. Cost-derived financial Project-list metrics and latest operational activity are not introduced by the archive/filter changes. Open work remains on GitHub.

## Related documentation

- [Current Cost Tracker domain model sources](../domain-model.md)
- [Shared Project permissions](../../../../docs/projects/permissions.md)
- [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0003](../../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
- [ADR-0029](../../../../docs/adr/0029-one-status-facet-for-cost-tracker-project-lists.md)
