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

Resolve the Greendex project, environment, resource IDs, and current deployment settings through the live API. Resource names below provide discovery hints, not a substitute for checking the target.

### Staging

Calculator and Cost Tracker share `greendex-staging-postgres`. Its public endpoint is `188.245.144.137:5488`; inspect the live resource for private connection and deployment settings.

### Development

- `greendex-development-postgres` serves local Calculator and Cost Tracker development.
- `greendex-preview-postgres` serves pull-request previews. Inspect its live connection settings and each application's configured logical database.
- `greendex-documentation` is database-free.
- `greendex-development-s3` provides isolated development object storage.

The approved local development database is `greendex_development` at `188.245.144.137:5489`.

Configure local `DATABASE_URL` in the ignored `packages/database/.env`. Inspect current package scripts for environment loading and migration hooks. Verify the database target before operations and restart affected processes after changing their environment.

Read the [Garage runbook](../../../apps/cost-tracker/docs/infrastructure/garage.md) before S3 operations. Verify resource placement through the live API rather than assuming an environment's contents.

## Application contract

| App | Build command | Start command | Domains | Health check |
| --- | --- | --- | --- | --- |
| Calculator | `pnpm turbo run build --filter=@greendex/calculator` | `pnpm turbo run start --filter=@greendex/calculator` | `https://greendex.apps.sieh.org` → `3000`, `https://socket.greendex.apps.sieh.org` → `4000`; both also have `www` aliases | `/api/rpc/health` on `3000` |
| Cost Tracker | `pnpm turbo run build --filter=@greendex/cost-tracker` | `pnpm turbo run start --filter=@greendex/cost-tracker` | `https://cost-tracker.apps.sieh.org` → `3002` | `/` on `3002` |
| Documentation | `pnpm turbo run build --filter=@greendex/documentation` | `pnpm turbo run start --filter=@greendex/documentation` | `https://docs.greendex.apps.sieh.org` → `3001` | `/en` on `3001` |

Read the configured branch, commit pin, deployment flags, preview template, and database from the live application. Preserve settings outside the requested rollout. Verify that the queued deployment uses the intended commit; changing a branch alone may leave a historical commit pin in place. Wildcard DNS must cover the resolved preview hosts.

### Release migration gate

Database-consuming apps migrate **before application startup**, not during image builds. Migration failure must prevent startup; never suppress its exit status. Managed start commands must use repository scripts rather than bypassing their startup checks.

Documentation has no migration or database credentials. Updating repository scripts does not update managed Coolify settings.

### Secret-free images

- For both normal and preview environments, credentials must be **buildtime OFF, runtime ON**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, OAuth client secrets, `SMTP_PASSWORD`, `IMAP_PASSWORD`, usernames and S3 access keys. Other server configuration can also be runtime-only. Keep public `NEXT_PUBLIC_*` URLs available at build time; they must never contain credentials.
- Do not pass credentials via generated Docker `ARG`/`ENV` or copy `.env*` files into build stages. Verify the actual Railpack source context and generated build plan; `.dockerignore` alone is not proof that Railpack excludes files. Exclude existing `.next`, Turbo caches, logs and auth artifacts too.
- Image builds must not require runtime credentials. Keep runtime environment validation active; do not inject validation-bypass flags into running containers.
- Before release, build without real credentials, pull the immutable image digest, and inspect image config/history and every unpacked layer for synthetic canaries, including deleted lower-layer files. Check build logs/caches/attestations separately. A grep of source or only the final container filesystem is insufficient.
- Start that same digest with runtime credentials and verify health/auth/mail/storage plus rejection of missing credentials. Rotate exposed credentials first; remove contaminated images and caches only with explicit authorization.

Use the repository migration command for manual recovery after verifying the target. Coordinate migrations against the same database. Startup migrations must remain compatible with the previously running release until traffic switches; multiple replicas must not migrate concurrently without coordination.

Preserve required environment forwarding through Turbo. Keep Coolify `NODE_ENV=production` runtime-only; do not expose or override `NODE_ENV` at build time. `next build` selects production mode itself, while a build-time `NODE_ENV` can change dependency installation and a `development` value causes invalid Next.js builds. `NEXT_PUBLIC_*` preview values are build-time values and must name the PR hosts. Authentication and mail settings may mirror development unless the task says otherwise.

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
5. **Observe.** Follow the exact deployment record and its logs. Diagnose stalled progress or repeated API failures before retrying. Completion: the record reaches a terminal state.
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
- The running preview container uses its configured preview database, not staging or the local development database.
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
