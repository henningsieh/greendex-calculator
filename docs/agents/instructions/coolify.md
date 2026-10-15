---
name: "Coolify"
description: "Greendex deployments, pull-request previews, managed resources, and incident handling"
applyTo: "apps/*/Dockerfile,apps/*/Dockerfile.*,docker-compose*.yml,docker-compose*.yaml,docs/database/**/*.md,apps/*/.env.example,turbo.json"
---

# Coolify

Use this runbook for every Coolify resource change, deployment, PR preview, or deployment incident.

## Authorities

- [Preview deployments](https://coolify.io/docs/applications/ci-cd/github/preview-deploy)
- [Deploy API](https://coolify.io/docs/api-reference/api/deployments/deploy-by-tag-or-uuid), [deployment status](https://coolify.io/docs/api-reference/api/deployments/get-deployment-by-uuid), and [cancellation](https://coolify.io/docs/api-reference/api/deployments/cancel-deployment-by-uuid)
- [Environment variables](https://coolify.io/docs/knowledge-base/environment-variables)
- [Health checks](https://coolify.io/docs/knowledge-base/health-checks)
- [Build servers](https://coolify.io/docs/knowledge-base/server/build-server) and [automated cleanup](https://coolify.io/docs/knowledge-base/server/automated-cleanup)
- API schema: [`openapi.json`](https://github.com/coollabsio/coolify/blob/v4.x/openapi.json)

Start at the [Coolify `llms.txt`](https://coolify.io/docs/llms.txt) only when these focused pages do not cover the operation; use [`llms-full.txt`](https://coolify.io/docs/llms-full.txt) only when the focused index has no route. The live API state is authoritative for mutable IDs, status, and configuration.

## Greendex resources

Project: `t40wk84o88wkgcocs80k0wws` (Greendex). Server: `sswswkg88448cw8sksowgc4k` (`localhost`, `188.245.144.137`). Resource inventory is API-verified; recheck live state before mutations.

### Staging

Environment: `ot4zwaowvypudrxjpmjpemos`.

| Resource | UUID | Purpose | Public domain |
| --- | --- | --- | --- |
| Calculator | `4ioaqslgamchlltplms74nbr` | Calculator and Socket.IO deployment | `greendex.apps.sieh.org` |
| Cost-Tracker | `vqud5nt2raw8yclhrypl4ipx` | Cost Tracker staging deployment | `cost-tracker.apps.sieh.org` |
| greendex-staging-postgres | `a004oogs4cwss04cok0wwckk` | Shared staging database for both apps | — |

Both apps auto-deploy `main` at `HEAD` via webhook and use the staging database's private hostname on `5432`, logical database `postgres`. PostgreSQL image: `postgres:17-alpine`; public endpoint: `188.245.144.137:5488`.

### Development

Environment: `rc04oc8sksggs48ggkwsgsg0`.

| Resource | UUID | Purpose |
| --- | --- | --- |
| greendex-development-postgres | `akbcevdeuhawuljnatnexrxj` | Local Calculator and Cost Tracker development; isolated volume and credentials |
| greendex-preview-postgres | `gcmwapuqoz45mjvtdwl3vgg4` | Preview database server; private `5432`, no public port |
| greendex-documentation | `nz8kya4kzwatnmbrnxktjkog` | Database-free Next.js/Fumadocs application |
| carbon-cycle-animation | `zg4ssg84cg48w48ko00sowc8` | Animation application |
| garage-s3 | `ckhy5vfyielgwo87ha4zaksd` | Garage object storage |

The local development database uses `postgres:17-alpine`, logical database `greendex_development`, endpoint `188.245.144.137:5489`.

Configure local `DATABASE_URL` in the ignored `packages/database/.env`. Both apps load this shared file before their app-local `.env`; injected environment variables take precedence. Root `pnpm run dev` runs migrations before starting servers: verify the target first. Restart local processes after changing the file; they retain their previous environment.

Production environment `u8scwcgo0w88sogc4g844c8s` has no resources. Read the [Garage runbook](../../../apps/cost-tracker/docs/infrastructure/garage.md) before S3 operations; resolve placement from the live API if its inventory differs from this map.

## Application contract

| App | Build command | Start command | Domains | Health check |
| --- | --- | --- | --- | --- |
| Calculator | `pnpm turbo run build --filter=@greendex/calculator` | `pnpm turbo run start --filter=@greendex/calculator` | `https://greendex.apps.sieh.org` → `3000`, `https://socket.greendex.apps.sieh.org` → `4000`; both also have `www` aliases | `/api/rpc/health` on `3000` |
| Cost Tracker | `pnpm turbo run build --filter=@greendex/cost-tracker` | `pnpm turbo run start --filter=@greendex/cost-tracker` | `https://cost-tracker.apps.sieh.org` → `3002` | `/` on `3002` |
| Documentation | `pnpm turbo run build --filter=@greendex/documentation` | `pnpm turbo run start --filter=@greendex/documentation` | `https://docs.greendex.apps.sieh.org` → `3001` | `/en` on `3001` |

These three applications use repository root `/`, Railpack, repository `henningsieh/greendex-calculator`, branch `main` at `HEAD`, and preview template `{{pr_id}}.{{domain}}`. Wildcard DNS must cover the resulting preview hosts.

| Application | Auto-deploy | Previews enabled | Preview database on the shared preview server |
| --- | --- | --- | --- |
| Calculator | Yes | No | `postgres` |
| Cost Tracker | Yes | Yes | `cost_tracker_pr261` |
| Documentation | No | No | None |

Calculator and Cost Tracker must follow `main` with `git_commit_sha=HEAD` and push auto-deployment enabled outside controlled rollouts. Changing only `git_branch` does not clear an old commit pin: verify the queued deployment's SHA against the pushed commit. Manual redeployment must also resolve the branch head rather than rebuild a historical commit.

### Release migration gate

Database-consuming apps migrate **before application startup**, not during image builds, through `prestart` → `start:prepare`. Migration failure must prevent startup; never suppress its exit status. Managed start commands must invoke the package's `start` script (through pnpm/Turbo), not bypass it with `next start`.

Documentation has no migration or database credentials. Updating repository scripts does not update managed Coolify settings.

### Secret-free images

- For both normal and preview environments, credentials must be **buildtime OFF, runtime ON**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, OAuth client secrets, `SMTP_PASSWORD`, `IMAP_PASSWORD`, usernames and S3 access keys. Other server configuration can also be runtime-only. Keep public `NEXT_PUBLIC_*` URLs available at build time; they must never contain credentials.
- Do not pass credentials via generated Docker `ARG`/`ENV` or copy `.env*` files into build stages. Verify the actual Railpack source context and generated build plan; `.dockerignore` alone is not proof that Railpack excludes files. Exclude existing `.next`, Turbo caches, logs and auth artifacts too.
- Both apps invoke `next build` without loading the shared database `.env`. t3-env skips validation only for Next's `phase-production-build`; runtime schemas remain active. Do not inject `NEXT_PHASE` or a validation-bypass flag into running containers.
- Before release, build without real credentials, pull the immutable image digest, and inspect image config/history and every unpacked layer for synthetic canaries, including deleted lower-layer files. Check build logs/caches/attestations separately. A grep of source or only the final container filesystem is insufficient.
- Start that same digest with runtime credentials and verify health/auth/mail/storage plus rejection of missing credentials. Rotate exposed credentials first; remove contaminated images and caches only with explicit authorization.

Manual recovery remains root `pnpm run db:migrate`, with an explicit `DATABASE_URL` override when needed. Root builds run sequentially using `--concurrency=1`; root migration has one database-package task. The deployment mutex continues to serialize separate Coolify releases. There is no custom migration runner, migration lock, or automatic database repair. Coordinate separate invocations against the same database. Startup migrations must remain compatible with the previously running release until traffic switches; multiple replicas must not migrate concurrently without coordination.

Preserve `"env": ["*"]` on Turbo `build` and `start`. Keep Coolify `NODE_ENV=production` runtime-only; do not expose or override `NODE_ENV` at build time. `next build` selects production mode itself, while a build-time `NODE_ENV` can change dependency installation and a `development` value causes invalid Next.js builds. `NEXT_PUBLIC_*` preview values are build-time values and must name the PR hosts. Authentication and mail settings may mirror development unless the task says otherwise.

### Set the preview origin before a build

Before any webhook-producing push or explicit preview trigger, complete this gate under the deployment mutex below. Preview environment records are shared by an application's PR previews, not scoped to one PR. Serialize origin updates with builds through deployment verification.

1. Read the target application's domain and preview template from the live API. Substitute the target PR number into the template to resolve the HTTPS preview origin. Never reuse another PR's stored origin.
2. Capture `GET /applications/{uuid}/envs`. Using the installed API schema's supported environment-update operation, update only the `NEXT_PUBLIC_BASE_URL` record with `is_preview=true`. Set its value to the resolved origin, with `is_buildtime=true` and `is_runtime=true`. Preserve all non-preview records and unrelated values.
3. Repeat `GET /applications/{uuid}/envs`. Proceed only when the preview record has the exact resolved origin and all three flags are true, and non-preview values remain unchanged. A successful mutation response alone does not pass this gate.

After an origin change, build a new image. A runtime restart cannot replace `NEXT_PUBLIC_*` values embedded in an existing image. After deployment, verify the running application's origin and the host of the OAuth authorization URL's decoded `redirect_uri` against the resolved preview host. Google's authorized redirect URI allowlist is a separate requirement. Report OAuth login as untested unless the login flow was completed.

## Sequential preview deployment runbook

**Mutex:** at most one Greendex deployment may be `queued` or `in_progress` across Calculator, Cost Tracker, and Documentation. This is a controller-enforced rule, not a platform lock. One agent/session owns every trigger path: preview enablement, webhook-producing pushes, API deploy calls, cancellation, and handoff. A push can trigger preview-enabled apps even when ordinary auto-deploy is disabled. Use this procedure only for an authorized rollout; capture settings first and restore ordinary auto-deployment afterward.

1. **Quiesce.** Disable `is_preview_deployments_enabled` and `is_auto_deploy_enabled` on all three apps before pushing a PR commit. Inspect complete `GET /deployments` results and cancel their `queued` or `in_progress` records. Completion: the global active set is empty.
2. **Publish.** The same controller runs local format, lint, type-check, tests, and production builds; commits and pushes. Completion: the PR head SHA is the tested SHA and no Coolify deployment was created.
3. **Select one app.** Enable previews only for the target app. Validate its commands, ports, and health check. Complete the [preview-origin gate](#set-the-preview-origin-before-a-build) through API readback before triggering. Reinspect complete `GET /deployments` results. Completion: only the target enabled, origin readback passes, active set empty.
4. **Trigger.** The same controller requests only that application UUID with the PR number. Record the returned `deployment_uuid`; no webhook, UI, or second API caller may trigger another deployment. Completion: the global active set contains only that UUID.
5. **Observe.** Poll the exact deployment record every 10 seconds and inspect log advancement at least every minute. One API timeout gets one retry; two consecutive timeouts or two minutes without new logs triggers host/log diagnosis. Completion: the record reaches a terminal state.
6. **Verify.** A `finished` record is necessary but insufficient: request the preview URL and health endpoint, verify the expected commit, and check migrations for database-consuming apps. Completion: every app-specific check below passes.
7. **Hand off.** Disable previews for the completed app, confirm the active set is empty, then repeat steps 3–6 for each remaining target. Restore captured ordinary auto-deploy settings. Re-enable automatic previews only after deciding concurrent builds are safe.

## API recipes

Set `COOLIFY_API_URL` to the Coolify API base including `/api/v1` (for this instance, `http://188.245.144.137:8000/api/v1`), and set `COOLIFY_TOKEN`, `PR_NUMBER`, and `APPLICATION_UUID` outside the repository. Never use the token reserved for another host.

```bash
# Trigger one PR preview. POST is supported by the installed Coolify API.
curl -fsS -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_API_URL/deploy?uuid=$APPLICATION_UUID&pr=$PR_NUMBER&force=true"

# Poll the returned deployment UUID, not application health or an older record.
curl -fsS \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_API_URL/deployments/$DEPLOYMENT_UUID"

# Inspect every active Coolify deployment before acquiring or using the mutex.
curl -fsS \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_API_URL/deployments"

# Cancel one queued or running record.
curl -fsS -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_API_URL/deployments/$DEPLOYMENT_UUID/cancel"
```

Use `PATCH /applications/{uuid}` for persistent application settings and `/applications/{uuid}/envs` for environment records. Read the installed OpenAPI schema before constructing a mutation; do not infer methods or fields. Open PRs created before previews were enabled may require **Load Pull Requests** in Coolify before `pr=<id>` is recognized.

## Verification gates

### Calculator

- Deployment commit equals the current PR head.
- `GET https://<pr>.greendex.apps.sieh.org/api/rpc/health` succeeds.
- `https://<pr>.socket.greendex.apps.sieh.org` routes to the same preview deployment; verify a Socket.IO handshake when practical.
- The running preview container uses the preview database listed above, not staging or the local development database.
- Drizzle migrations completed and the `verification` table exists. Pass `DATABASE_URL` explicitly when invoking migration inside a container.

### Documentation

- Deployment commit equals the current PR head.
- `GET https://<pr>.docs.greendex.apps.sieh.org/en` succeeds and returns Documentation content.
- Calculator secrets are absent from Documentation environment records.

### Cost Tracker

- Deployment commit equals the current PR head; `https://<pr>.cost-tracker.apps.sieh.org/` responds successfully.
- The running preview container targets its configured logical database on the preview server, and startup migrations completed.

## Incident response

Treat logs and host metrics as evidence; never repeatedly redeploy an unchanged failure.

- **Non-standard `NODE_ENV`:** remove the build-time override; keep runtime `NODE_ENV=production`. Verify the stored record and owning script, then retry once.
- **OOM or frozen Next build:** inspect `free -h`, load, container stats, and kernel OOM messages. Preserve the mutex; use a build server only after its registry, source access, Docker, and matching architecture prerequisites are verified.
- **Disk pressure:** inspect `df -h /` and `docker system df`. Cancel before the filesystem fills. Coolify cleanup removes stopped managed containers, unused images, and build cache, and skips cleanup during active deployments. Treat volume cleanup as data-destructive and require explicit authorization.
- **Image export/import failure:** a successful Next build can still fail deployment. Diagnose the final Railpack/BuildKit phase separately; confirm adequate space for temporary layers plus the final image.
- **Health-check 404 or “No available server”:** inspect the exact deployment/container and configured port/path. With health checks enabled, Traefik routes only to healthy containers; an older healthy container proves nothing.
- **Secrets in logs:** do not reproduce the log. Report exposed key names only and rotate affected credentials.

## Operational boundaries

Development environment allowance applies only to resources verified to be in `development`. Direct database access via public IP/port, `DATABASE_URL` overrides, and applying Drizzle migrations (`db:migrate`/`db:generate` targets) are pre-approved there, including for worker agents, not in staging. No drops, volume deletion, or credential leaks. Retrieve credentials from Coolify; keep secrets out of Git, terminal output, PR text, and chat. Temporary downtime requires user authorization.

Coolify owns persistent deployment configuration. Use its UI/API; generated `/data/coolify/.../docker-compose.y*ml` files are outputs. Application-to-database traffic prefers the private `coolify` network, but direct access is permitted in development. Keep databases and volumes when replacing an application unless deletion is explicitly authorized. Follow [Drizzle](drizzle.md) for schema changes and migrations.
