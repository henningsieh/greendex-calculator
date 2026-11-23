---
status: accepted
---

# One Status facet for Cost Tracker Project lists

The Cost Tracker Project list spread one project-level status across an Archive filter (`active` / `archived` / `all`), a Settlement filter (`all` / `Settlement open` / `Ready to archive`) and a table column whose values were `Settlement open`, `Ready to archive` and `Archived`. The column could show a value the Settlement filter could not select, the Settlement filter silently constrained the archive axis, and combinations such as archived plus settlement open were representable but always empty. Sorting used the Status rank under the name “Settlement”, so ascending did not match the labels it ordered.

## Decision

- Collapse the two query axes into one facet named **Status** with three mutually exclusive values: `open`, `ready`, `archived`. One ordered tuple is the single source of truth for filter options, sort rank and badge labels.
- The table, multi-select filter and sort all describe that partition. The default selection is `open` plus `ready`, preserving the previous active-only view; selecting `archived` is the archive shortcut. Selecting every value behaves like no constraint, and an empty selection also means no constraint, so a cleared filter cannot produce an empty list.
- Status stays a derived, read-only projection over two facts the list does not own: the Project's archived flag and the Claim settled rule (paid or rejected, [ADR-0011](0011-complete-claim-submission-and-payment-workflow.md)). It is not a stored column, transition table, guard or fourth machine. The archive/reopen transitions and permissions remain those of [ADR-0027](0027-archive-settled-cost-tracker-projects.md) and [ADR-0028](0028-scope-project-lifecycle-permissions-by-application.md).
- The SQL status predicate and the TypeScript projection must express the same rule. A status value is added to the ordered tuple first and derived in both places; the integration suite compares the returned rows with the projection for the same machine facts.
- The URL carries one repeated `status` parameter. Cursors fingerprint the canonical status set, and changing the selection resets the cursor. The old `archive` and `settlement` parameters are removed outright; there is no compatibility alias.
- The column header and sort summary use the Status vocabulary. Because Status is ordinal, ascending announces “open first” and descending announces “archived first” rather than bare ascending/descending words; `aria-sort` keeps its standard values.
- The generated Project lifecycle document includes the derived Status projection so status-tuple or settled-rule drift fails the existing workflow check. Rationale stays in this ADR and the behaviour docs.

## Alternatives

- **Keep both filters and disable impossible combinations:** rejected. It preserves two names for one partition and leaves the column able to show values the filter cannot select.
- **Add a stored Status column or a third state machine:** rejected. The status adds no new fact; it is a projection of the archive flag and Claim settlement. A stored status would create a second place where the rules can drift.
- **Keep `archive`/`settlement` as legacy aliases:** rejected. No historical state needs preserving here, and two URL vocabularies would keep the split concept alive.
- **Sort by the translated Status label alphabetically:** rejected. The labels are prose whose alphabetical order is unrelated to the rank and differs per locale. The ordered tuple owns the rank, and the wording states the outcome.
- **Keep bare ascending/descending for the ordinal column:** rejected. For this column those words do not say what a reader will see next.

## Consequences

- Existing bookmarks containing `archive` or `settlement` lose those parameters and fall back to the default Hosted/Partner list view. This is intentional and is the only compatibility cost.
- The list procedure applies no status filter on its own: an absent or empty `status` means no constraint. The list UI is one caller; it passes its default selection (`open` plus `ready`) and shows that selection in the filter.
- The Archived selection is a query concern only. It cannot reach an archive or reopen action, and those lifecycle paths keep their existing authorization.
- A future status value requires an ordered-tuple entry, both derivations, the generated projection document and the tests to move together; the drift check and projection comparison make a one-sided change fail.
