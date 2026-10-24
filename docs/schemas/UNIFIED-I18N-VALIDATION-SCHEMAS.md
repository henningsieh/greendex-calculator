# Project Shared Travel Leg Validation

Project Shared Travel Leg validation has one canonical home in
`apps/calculator/src/features/project-shared-travel-legs/`. Persisted fields
come from the database schema; application validation derives from that schema
rather than recreating row types by hand.

## Boundaries

- The management form and canonical oRPC procedures accept Project Shared
  Travel Leg fields and the Project Shared Travel Transport Emission Profile
  set. Plane is participant-only and is rejected for Project Shared Travel.
- Project creation and editing reuse the Project Shared Travel Leg form
  contract for their `sharedTravelLegs` values.
- Public participation exposes canonical `sharedTravelLegs` only. It no longer
  returns an `activities` response alias.
- Shared-project calculations add each Project Shared Travel Leg once.
  Participant Travel Leg round-trip and passenger adjustments remain exclusive
  to participant calculations.

## Localized distance errors

`distance-validation.ts` owns the reusable distance rules. Its schema factory
accepts a next-intl translator and resolves full message paths under
`project.shared-travel`. Callers must pass a translator without a namespace;
otherwise next-intl duplicates the full path.

The distance rule accepts the configured 0.1 km increment while tolerating
normal floating-point arithmetic such as `0.1 + 0.2`.

## Canonical persistence boundary

Migration `0013_remove_project_activity_compatibility_view` dropped the temporary
`project_activity` compatibility view, its `INSTEAD OF` trigger, and the
`project_activity_compatibility_view_write()` function created in `0010`. The
canonical `project_shared_travel_leg` table and its
`project_shared_transport_emission_profile` enum are the sole persistence
contract. Historical migration/cleanup suites that provisioned disposable
databases are removed. Existing-database procedure tests retain application
coverage. Application code must not reintroduce legacy `project_activity` aliases.
