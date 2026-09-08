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

All resources are in project `t40wk84o88wkgcocs80k0wws`, environment `rc04oc8sksggs48ggkwsgsg0` (`development`). Greendex has no production environment; temporary downtime is acceptable only when the user authorizes it.

| Resource | UUID | Deployment role |
| --- | --- | --- |
| Calculator | `4ioaqslgamchlltplms74nbr` | Next.js on `3000`; Socket.IO on `4000` |
| Documentation | `nz8kya4kzwatnmbrnxktjkog` | Next.js/Fumadocs on `3001` |
| Preview PostgreSQL | `gcmwapuqoz45mjvtdwl3vgg4` | Isolated PR-preview data on private port `5432` |
| Live PostgreSQL | `a004oogs4cwss04cok0wwckk` | Shared development data on private port `5432` |

The deleted combined application `wokgg0808c8k44cgk480444c` is not a deployment target. Retrieve credentials from Coolify; keep tokens and environment values out of Git, terminal output, PR text, and chat.

## Application contract

| App | Build command | Start command | Domains | Health check |
| --- | --- | --- | --- | --- |
| Calculator | `pnpm turbo run build --filter=@greendex/calculator` | `pnpm turbo run start --filter=@greendex/calculator` | `https://greendex.apps.sieh.org:3000`, `https://socket.greendex.apps.sieh.org:4000` | `/api/rpc/health` on `3000` |
| Documentation | `pnpm turbo run build --filter=@greendex/documentation` | `pnpm turbo run start --filter=@greendex/documentation` | `https://docs.greendex.apps.sieh.org:3001` | `/en` on `3001` |

Both applications use repository root `/`, Railpack, GitHub App source `henningsieh/greendex-calculator`, branch `main`, and preview template `{{pr_id}}.{{domain}}`. Wildcard DNS must cover the resulting preview hosts.

Preserve `"env": ["*"]` on Turbo `build` and `start`. Keep Coolify `NODE_ENV=production` runtime-only; do not expose or override `NODE_ENV` at build time. `next build` selects production mode itself, while a build-time `NODE_ENV` can change dependency installation and a `development` value causes invalid Next.js builds. `NEXT_PUBLIC_*` preview values are build-time values and must name the PR hosts. Calculator preview `DATABASE_URL` must use the preview database UUID hostname, never the host IP or public port. Authentication and mail settings may mirror development unless the task says otherwise.

## Sequential preview deployment runbook

**Mutex:** exactly one Greendex deployment may be `queued` or `in_progress` across both applications. One agent/session is the deployment controller and owns every trigger path: preview enablement, pushes that can emit webhooks, API deploy calls, cancellation, and handoff. Other controllers remain idle until ownership is released. A code push can trigger every preview-enabled app concurrently even when ordinary auto-deploy is disabled.

1. **Quiesce.** The controller disables `is_preview_deployments_enabled` and `is_auto_deploy_enabled` on both apps before pushing a PR commit. Inspect complete `GET /deployments` results and cancel every Calculator or Documentation record whose status is `queued` or `in_progress`. Completion: the global active set is empty.
2. **Publish.** The same controller runs local format, lint, type-check, tests, and production builds; commits and pushes. Completion: the PR head SHA is the tested SHA and no Coolify deployment was created.
3. **Select one app.** The same controller enables preview deployments only for the app being deployed; leave the other app disabled. Validate its command, ports, health check, preview URL template, and preview environment. Reinspect complete `GET /deployments` results immediately before triggering. Completion: one app enabled, one disabled, active set empty.
4. **Trigger.** The same controller requests only that application UUID with the PR number. Record the returned `deployment_uuid`; no webhook, UI, or second API caller may trigger another deployment. Completion: the global active set contains only that UUID.
5. **Observe.** Poll the exact deployment record every 10 seconds and inspect log advancement at least every minute. One API timeout gets one retry; two consecutive timeouts or two minutes without new logs triggers host/log diagnosis. Completion: the record reaches a terminal state.
6. **Verify.** A `finished` record is necessary but insufficient: request the preview URL and health endpoint, verify the expected commit, and verify database migration state for Calculator. Completion: every app-specific check below passes.
7. **Hand off.** Disable previews for the completed app, confirm the active set is empty, then repeat steps 3–6 for the other app. Re-enable automatic preview behavior only after deciding that concurrent builds are safe.

Recommended order for this repository: Calculator first, Documentation second.

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
- The running container uses preview `DATABASE_URL` and the private hostname `gcmwapuqoz45mjvtdwl3vgg4:5432`.
- Drizzle migrations completed and the `verification` table exists. Pass `DATABASE_URL` explicitly when invoking migration inside a container.

### Documentation

- Deployment commit equals the current PR head.
- `GET https://<pr>.docs.greendex.apps.sieh.org/en` succeeds and returns Documentation content.
- Calculator secrets are absent from Documentation environment records.

## Incident response

Treat logs and host metrics as evidence; never repeatedly redeploy an unchanged failure.

- **Non-standard `NODE_ENV`:** stop; set Calculator preview/build `NODE_ENV=production`, verify the stored record, publish the owning script fix if needed, then retry once.
- **OOM or frozen Next build:** inspect `free -h`, load, container stats, and kernel OOM messages. The runtime host has demonstrated that concurrent Next builds can trigger OOM. Preserve the mutex; use the configured build server only after its registry, source access, Docker, and matching architecture prerequisites are verified.
- **Disk pressure:** inspect `df -h /` and `docker system df`. Cancel before the filesystem fills. Coolify cleanup removes stopped managed containers, unused images, and build cache, and skips cleanup during active deployments. Treat volume cleanup as data-destructive and require explicit authorization.
- **Image export/import failure:** a successful Next build can still fail deployment. Diagnose the final Railpack/BuildKit phase separately; confirm adequate space for temporary layers plus the final image.
- **Health-check 404 or “No available server”:** inspect the exact deployment/container and configured port/path. With health checks enabled, Traefik routes only to healthy containers; an older healthy container proves nothing.
- **Secrets in logs:** do not reproduce the log. Report exposed key names only and rotate affected credentials.

## Operational boundaries

Coolify owns persistent deployment configuration. Use its UI/API; generated `/data/coolify/.../docker-compose.y*ml` files are outputs. Application-to-database traffic stays on the private `coolify` network. Keep databases and volumes when replacing an application unless deletion is explicitly authorized. Follow [Drizzle](drizzle.md) for schema changes and migrations.
