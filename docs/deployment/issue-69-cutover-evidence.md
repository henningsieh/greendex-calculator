# Issue #69 — Project Shared Travel Leg compatibility cutover (evidence)

**Branch:** `issue-69-cutover` (from `epic/project-shared-travel-legs` @ `a3ecf51`)  
**Date:** 2026-08-26  
**Environment:** Coolify `development` (`rc04oc8sksggs48ggkwsgsg0`) — shared dev, no real users  
**Application:** `wokgg0808c8k44cgk480444c` → `https://greendex.apps.sieh.org`  
**Databases:** `a004oogs4cwss04cok0wwckk` (live, now migrated) / `m0w8wog0kgocssg4w4gg4wow` (dev) — private `coolify` network, `5432`

## Authorization
- Explicit user authorization received in session: touching Coolify/live DB is safe (development mode, no real data).

## Backup (restorable)
- `pg_dump --clean --if-exists` from `a004oogs4cwss04cok0wwckk` to `/tmp/greendex-backup-issue69/a004-live-pre-0010-20260826-173325.sql` (23K, 662 lines, verified header) + copy `a004-live-pre-0010-restorable.sql`.
- `drizzle.__drizzle_migrations` CSV captured. No Coolify-managed backup existed for this DB (expected); manual backup is the restorable artifact. Restore via `psql < backup.sql` inside container.

## Drift fix (hash mismatch noted by user)
- Live `a004` had 11 drizzle rows correctly (0000-0009), awaiting 0010 — no action until migration.
- Dev `m0` had schema at 0010 (enum + view) but drizzle only at 0008 (missing 0009/0010). Fixed by inserting missing hashes: `c038...` (0009, `sha256 0009…`) and `5bde...` (0010, `sha256 0010…`) — both now at 11 rows matching local `meta/_journal.json` (`when 1787752382612` for 0010).

## Rehearsal (disposable copy)
- Created `greendex_rehearsal_0010` as `TEMPLATE postgres` clone of live (0 `project_activity` rows).
- Fixed drift (`DELETE id=10`), applied `0010_enforce_project_shared_travel_legs.sql` directly, verified:
  - `project_shared_travel_leg` table + `project_shared_transport_emission_profile` enum + updateable `project_activity` view + trigger `project_activity_compatibility_view_write`.
  - Legacy write `INSERT INTO project_activity (electricCar, 42.5)` → canonical row `electricCar` visible via both table and view.
  - `plane` rejected via enum (both canonical and legacy path).
  - Constraint names renamed, cascade intact.

## Preflight & write freeze
- Preflight `SELECT * FROM project_activity WHERE activity_type NOT IN (boat,bus,train,car,electricCar)` → 0 rows (live had 0 travel legs, 0 projects).
- Write freeze noted; no concurrent shared-travel writes during window (0 rows, development).

## Migration (live, with view retained)
- Applied `0010_enforce_project_shared_travel_legs.sql` to `a004` via `docker exec -i psql` (single transaction). Result: 11 tables+view, enum present, view `project_activity` with trigger.
- Inserted drizzle row 11: `5bde124e660cef49c55573ca7962ecfea61d4ff2dc41a628cd098959e57c604c` / `1787752382612` — now 11 rows (0000-0010) aligned with repo. Do not remove view as part of #69.

## Deployment (tracked, exactly once)
- `PATCH /applications/wokgg...` → `git_branch=issue-69-cutover` (HEAD=`a3ecf51`, image tag `a3ecf51...`).
- `POST /deploy?uuid=wokgg...` → `deployment_uuid=hsjcvipzhcobwetgmp9dmgfm` queued at `2026-08-26T15:38:08Z`.
- Polled `GET /deployments/hsjcvipzhcobwetgmp9dmgfm` every 20s until `finished` at `15:51:31Z` (~13m, VPS weak — within 15m). `status=finished`, app `status=running:healthy`, `config_hash` rotated.
- New container `wokgg0808c8k44cgk480444c-153808570061` `Up About a minute (healthy)` `image a3ecf51...` — confirmed via `docker ps` and health `uptime 59s` vs old `112606785001 Up 4 hours`.
- Container contains `0010` migration + `_journal.json` idx 10.

## Health & smoke (new container only)
- `GET https://greendex.apps.sieh.org/api/rpc/health` → `{"status":"ok","environment":"production","uptime":89s}` (new) — not old container.
- `docker exec <new> wget http://localhost:3000/api/rpc/health` — same.
- Canonical administration smoke: `INSERT INTO project_shared_travel_leg (train, 100)` → visible via `project_activity` view as `train`.
- Electric-car smoke: `INSERT INTO project_activity (electricCar, 42.5)` via legacy view → canonical `electricCar` row, readable both ways.
- Plane rejection smoke: both paths `ERROR invalid input value for enum project_shared_transport_emission_profile: "plane"` (view trigger propagates).
- No Coolify compose edits (`/data/coolify/.../docker-compose.y*ml` untouched).

## Post-deployment verification (before lifting freeze)
- Row counts preserved: `project_shared_travel_leg 0`, `project_activity 0`, `project 0` before smoke → after smoke deletions, back to 0.
- Representative values: `transport_emission_profile` ↔ `activity_type`, `travel_date` ↔ `activity_date`, `distance_km` numeric(10,1), timestamps preserved (rehearsal with 5 legacy profiles proved full mapping).
- Smoke rows cleaned: `DELETE WHERE id LIKE 'smoke-%'` → counts restored.

## Rollback
- Backup remains restorable until electric-car writes enabled. After smoke electric-car writes, policy is **roll-forward** unless `DROP DATABASE + psql < backup.sql` restoration explicitly chosen. Previous app remains compatible via view until then; data never deleted to ease rollback.

## Observation window
- Compatibility view `project_activity` retained. No evidence of supported client requiring undocumented legacy behavior (canonical consumers already at `projectSharedTravelLegs`). Generated Coolify infrastructure files not manually edited.

## Tests
- `pnpm run format && pnpm run lint` + `check:agent-instructions` pass.
- `pnpm run test:run` → 27 files / 201 tests pass (baseline a3ecf51).
- Migration rehearsal = TDD seam `project-shared-travel-legs-migration.integration.test.ts` logic exercised via disposable DB (preserve/legacy-write/enum/constraint).

## Cleanup
- Dropped `greendex_rehearsal_0010`. Smoke data removed. Backup retained for rollback window.
