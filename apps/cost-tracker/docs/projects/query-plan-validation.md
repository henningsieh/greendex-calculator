# Project overview query-plan validation

Phase 8 overview query shapes were profiled on PostgreSQL with `EXPLAIN (ANALYZE, BUFFERS)` after migration 0016. The non-production fixture was created inside a rolled-back transaction and contained 20,000 Projects across two Hosting Organizations, 2,000 Projects in the measured Hosted scope, and 666 Project Partnerships.

| Path                            | Principal plan                                                            | Observed execution |
| ------------------------------- | ------------------------------------------------------------------------- | -----------------: |
| Default Hosted, first 26 rows   | `project_hosted_overview_operational_idx` index scan                      |           0.173 ms |
| Hosted open-window filter       | `project_hosted_overview_operational_idx` index scan                      |           0.238 ms |
| Default Partner, first 26 rows  | hash join and top-N sort                                                  |          14.112 ms |
| Literal substring name search   | sequential scan and sort                                                  |           8.238 ms |
| Hosted overlapping date range   | `project_hosted_overview_operational_idx` index scan with end-date filter |           0.413 ms |
| Hosted Partner match-any filter | hash semi-join and top-N sort                                             |           7.284 ms |

The planner selected the new operational index for the primary Hosted path and the date predicate. Migration 0016 also installs `pg_trgm` and a partial GIN index over `lower(project.name)` so larger/selective substring searches have an indexed path; PostgreSQL preferred a sequential scan for the measured 20,000-row fixture. Existing Project Partnership indexes supported the join inputs, but the measured Partner and multi-Partner paths remained hash/scan plans.

These measurements validate the initial index additions, not an unlimited production-volume claim. Re-profile with agreed production cardinalities and a latency budget before changing aggregate strategy or adding further indexes. Exact whole-scope and filtered metrics remain separate server queries and are never inferred from a cursor page.
