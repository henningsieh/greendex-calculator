# Project Partnership invariant migration rollout

Migration `0017_project-partnership-invariants` repairs databases that recorded the historical version of `0015_project_partnership_foundation` before its backfill, functions, and constraint triggers were added. It is append-only: do not edit or rerun `0015`.

## Preconditions

- Obtain developer authorization for the intended database and deployment window.
- Use Coolify-managed configuration and the private database network; never edit generated Compose files.
- Do not use the shared development database for migration testing. The regression test creates and removes its own disposable PostgreSQL database.

## Rollout

1. Before deployment, record the migration ledger from the intended database:

   ```sql
   SELECT id, hash, created_at
   FROM __drizzle_migrations
   ORDER BY created_at;
   ```

2. Deploy the reviewed application revision through Coolify. The normal Calculator build path runs the database migration; do not hand-apply SQL to a managed database.
3. Confirm the ledger has one additional migration entry and verify the repair artifacts:

   ```sql
   SELECT tgname
   FROM pg_trigger
   WHERE tgname IN (
     'project_host_organization_invariants',
     'project_partnership_organization_invariants',
     'project_participation_organization_invariants'
   )
   ORDER BY tgname;

   SELECT proname
   FROM pg_proc
   WHERE proname IN (
     'assert_project_organization_invariants',
     'check_project_organization_invariants'
   )
   ORDER BY proname;
   ```

4. Confirm no existing row violates the repaired invariant:

   ```sql
   SELECT project.id
   FROM project
   LEFT JOIN project_partner_organization AS partnership
     ON partnership.project_id = project.id
     AND partnership.organization_id = project.organization_id
   WHERE partnership.id IS NOT NULL

   UNION ALL

   SELECT participation.project_id
   FROM project_participant AS participation
   INNER JOIN project
     ON project.id = participation.project_id
   LEFT JOIN project_partner_organization AS partnership
     ON partnership.project_id = participation.project_id
     AND partnership.organization_id = participation.represented_organization_id
   WHERE participation.represented_organization_id <> project.organization_id
     AND partnership.id IS NULL;
   ```

   The query must return no rows. A migration failure or non-empty result requires investigation; do not retry a deployment or alter database resources without developer authorization.
