# Garage S3 infrastructure

Deployment-specific reference for the staging and development Garage services behind this project's S3 configuration. Follow the repository-wide [Coolify runbook](../../../../docs/agents/instructions/coolify.md) for persistent resource changes, deployment operations, and incident handling. Live container labels place these services in the `greendex` Coolify project as resources `greendex-staging-s3` and `greendex-development-s3`; the older `ambitia-cost-tracker` project name below is stale and retained only for history.

This document contains no credential values. Application configuration lives in `.env.example`; usable local secrets live only in the ignored `.env`.

Snapshot verified: 2026-10-13 (staging alias verification plus development service provisioning; replaces the stale 2026-09-04 snapshot).

## Coolify resources

| Resource            | Name                                                                                | UUID                       |
| ------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| Project             | `greendex` (live label; `ambitia-cost-tracker` `zvzfc1ubnr6qld27tgvkpev5` is stale) | —                          |
| Environment         | Greendex staging (container label reports `production`; see note)                   | —                          |
| Service             | `greendex-staging-s3`                                                               | `ckhy5vfyielgwo87ha4zaksd` |
| Service application | `garage`                                                                            | `r9igtcff3sdnrdyc5adfyv77` |

- Coolify host: `188.245.144.137`
- SSH alias: `coolify`
- Container: `garage-ckhy5vfyielgwo87ha4zaksd`
- Image: `dxflrs/garage:v2.1.0`
- Docker network: `ckhy5vfyielgwo87ha4zaksd`
- Observed state: running and healthy
- Note: the Coolify runbook staging inventory differs from these live labels; the live container labels and Traefik routes above are authoritative for this resource. Do not hand-edit generated compose output.

## Public endpoints

| Purpose                | URL                                  | Internal port |
| ---------------------- | ------------------------------------ | ------------- |
| S3 API                 | `https://s3.greendex.apps.sieh.org`  | `3900`        |
| Static bucket websites | `https://web-garage.apps.sieh.org`   | `3902`        |
| Admin API and metrics  | `https://admin-garage.apps.sieh.org` | `3903`        |

Live Traefik routes (container labels) send `s3.greendex.apps.sieh.org` to port `3900`. The older `s3-garage.apps.sieh.org` hostname is stale for this resource.

Traefik terminates TLS and routes each hostname to its corresponding container port. The wildcard DNS record `*.apps.sieh.org` resolves to the Coolify host.

Only the S3 API is used by the Next.js application. The website endpoint serves website-enabled buckets and has no landing page. The admin endpoint is an authenticated HTTP API, not a dashboard; Garage has no bundled admin web UI. Consequently:

- An unsigned request to the S3 endpoint may return `403 AccessDenied` while the service is healthy.
- Opening the admin API root may return `400 Unknown API endpoint` while the service is healthy.
- Opening the website hostname without a matching website-enabled bucket may return `404 NoSuchBucket` or `404 NoSuchKey`.

## Garage configuration

The host file `/data/coolify/services/ckhy5vfyielgwo87ha4zaksd/garage.toml` is mounted at `/etc/garage.toml`.

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "lmdb"

replication_factor = 1
consistency_mode = "consistent"
compression_level = 1
block_size = "1M"

rpc_bind_addr = "[::]:3901"
bootstrap_peers = []

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3-garage.apps.sieh.org"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".apps.sieh.org"

[admin]
api_bind_addr = "[::]:3903"
```

The checked-in excerpt still shows `root_domain = ".s3-garage.apps.sieh.org"`; the live host file matches that excerpt (verified 2026-10-13, non-secret lines only). Live Traefik routes `s3.greendex.apps.sieh.org` to the same S3 port, and the staging consumer uses path-style addressing (`S3_FORCE_PATH_STYLE=true`), so virtual-host root-domain mismatch does not break access. Do not hand-edit the host file or generated compose output; any `root_domain` change is a Coolify-managed operation requiring restart coordination.

Secret references omitted from that excerpt are supplied through these container environment variables:

- `GARAGE_RPC_SECRET`
- `GARAGE_ADMIN_TOKEN`
- `GARAGE_METRICS_TOKEN`

Coolify also manages their generated source variables and the three public URL variables. Credential values belong in Coolify or ignored local environment files, never in tracked Markdown.

## Persistent storage

| Purpose       | Docker volume                          | Container path         |
| ------------- | -------------------------------------- | ---------------------- |
| Object data   | `ckhy5vfyielgwo87ha4zaksd_garage-data` | `/var/lib/garage/data` |
| Metadata/LMDB | `ckhy5vfyielgwo87ha4zaksd_garage-meta` | `/var/lib/garage/meta` |

Deleting or replacing either volume is destructive. The current deployment has one Garage node, replication factor 1, and therefore no data redundancy.

## Cluster layout

The default Coolify deployment started Garage without assigning the node a role. That caused `500 InternalError: Layout not ready`. The node was assigned and layout version 1 was applied.

| Setting            | Current value      |
| ------------------ | ------------------ |
| Node ID prefix     | `4cb1c7663f070f34` |
| Zone               | `nbg1`             |
| Assigned capacity  | `1000 MB`          |
| Partitions         | `256`              |
| Replication factor | `1`                |
| Layout version     | `1`                |

At the snapshot time, Garage reported the node healthy and approximately 10.2 GB available on the underlying data filesystem. The host filesystem was 38 GB total, 27 GB used, 9.6 GB available (74% used). These disk figures are observational; inspect live state before capacity decisions.

## Staging application bucket and key (#272)

| Setting              | Current value                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bucket ID prefix     | `b42cef2e76ed4a0b`                                                                                                   |
| Global aliases       | `ambitia-cost-tracker-development` (retained through transition), `greendex-cost-tracker-staging` (added 2026-10-13) |
| Website hosting      | Disabled                                                                                                             |
| Current objects      | `0` at verification time                                                                                             |
| Application key name | `ambitia-cost-tracker-development`                                                                                   |
| Bucket permissions   | Read/write                                                                                                           |
| May create buckets   | No                                                                                                                   |
| Key expiration       | Never                                                                                                                |

Bucket identity, objects, and permissions were preserved: both aliases resolve to the same full bucket ID, and the key keeps read/write access. The new alias was added with the supported non-destructive operation (`garage bucket alias <existing-bucket> <new-name>`); the old alias was kept. No bucket, volume, or object deletion or purge was performed.

Staging consumer (Coolify-managed, verified read-only 2026-10-13): Cost Tracker staging (`vqud5nt2raw8yclhrypl4ipx`, `https://cost-tracker.apps.sieh.org`) uses `S3_ENDPOINT=https://s3.greendex.apps.sieh.org`, `S3_REGION=garage`, path-style addressing. On 2026-10-13 the staging (non-preview) `S3_BUCKET` record was patched through the Coolify API from the old alias to `greendex-cost-tracker-staging` (runtime-only flags preserved; preview record intentionally left on the retained old alias), and the staging application was redeployed (deployment `4lax82vuhgnzfmtlek7y7oqk`, commit `a8dd0212` = origin `main` HEAD, status `finished`). The running container is healthy, serves HTTP 200, and carries `S3_BUCKET=greendex-cost-tracker-staging`. Staging SMTP records were not altered (all `SMTP_*` still present, runtime-only).

The access-key ID and secret key are intentionally omitted. Their local values are in `.env`; `.env.example` is the authoritative non-secret application configuration contract. The application key cannot create or administratively reconfigure buckets.

A temporary object PUT/GET/delete was successfully verified against the public S3 endpoint, and the verification object was removed.

One-time staging alias verification (2026-10-13, NOT a routine root-test target): PUT 64 random bytes to a run-owned key under `staging-alias-check/` in `greendex-cost-tracker-staging` via `https://s3.greendex.apps.sieh.org`, byte-for-byte GET assert passed, DELETE completed, and `head_bucket` on the old alias still resolved. Cleanup removed only the run-owned key. Re-verified after the staging redeploy using the running container's own bucket value with the same result. No secrets are recorded here.

## Proof Document policy (interim, minimal for now)

- **Retention:** Keep Claim Proof Documents in the private application bucket while their Project is active. There is no shorter automatic expiry or lifecycle rule yet.
- **Malware scanning:** Treat uploaded files as untrusted. Scan on a best-effort basis when scanning is available and log the result or failure for operational follow-up; scanning is not a gate on upload or download. No automated scanning enforcement is currently implemented. Do not describe a file as clean solely because it was accepted.
- **Deletion:** Delete a Project's Claim Proof Document objects and associated references when the Project is archived. This is the intended operational policy, not an implemented automatic archive hook; arrange and verify deletion as part of archiving until that hook exists. Do not delete the whole bucket or unrelated keys.

Revisit this interim policy before introducing automated archive workflows or stronger security/retention requirements.

To repeat the staging check using the application's local `.env`, run `pnpm --filter @greendex/cost-tracker test:garage-storage` from the repository root. This opt-in live test always executes against the network (never a cached result) and is not part of the default test suite. It writes a random object under a run-owned `smoke-tests/<run-id>/` key in the configured app bucket, compares downloaded bytes, deletes the owned key even if verification fails (cleanup failure is an explicit error naming the orphaned key), and then proves rejection of bogus credentials with a process-local invalid client that never touches app or staging credentials. It does not create a bucket. If the process is interrupted before cleanup, inspect and remove only the orphaned `smoke-tests/<run-id>/` key after confirming it belongs to this run; do not clear the entire prefix or bucket.

## Development application bucket and key (#271)

| Setting              | Current value                                                  |
| -------------------- | -------------------------------------------------------------- |
| Service              | `greendex-development-s3`                                      |
| Service UUID         | `qvnaqod5vknlufojogo13l1j`                                     |
| Container            | `garage-qvnaqod5vknlufojogo13l1j`                              |
| Image                | `dxflrs/garage:v2.3.0`                                         |
| S3 API endpoint      | `https://s3-eouwm5qfwrku92jfqdgxfubf.188.245.144.137.sslip.io` |
| Bucket global alias  | `greendex-cost-tracker-development`                            |
| Application key name | `greendex-cost-tracker-development`                            |
| Bucket permissions   | Read/write                                                     |
| May create buckets   | No                                                             |
| Key expiration       | Never                                                          |
| Current objects      | `0` at verification time                                       |

The service lives in the Greendex Coolify project, development environment, with isolated persistent volumes `qvnaqod5vknlufojogo13l1j_garage-data` (`/var/lib/garage/data`) and `qvnaqod5vknlufojogo13l1j_garage-meta` (`/var/lib/garage/meta`) — separate from the staging volumes. Single node, replication factor 1, layout version 1 applied. Local Cost Tracker `.env` (ignored, never committed) points `S3_ENDPOINT`/`S3_BUCKET` at this service; `.env.example` carries the same non-secret endpoint and bucket with empty key placeholders.

Adoption note (2026-10-13): the service was created through the Coolify API, but the start request queued during the host-disk outage (coolify-db down at 100% disk) and vanished without effect. The container was therefore started manually from Coolify's generated compose output (`cd /data/coolify/services/qvnaqod5vknlufojogo13l1j && docker compose up -d`) after approved disk recovery (`journalctl` vacuum, dangling then unused image prune; no volume/container/data destructive ops). No compose file was hand-edited. The Coolify API has since reconciled the service (`running:healthy`, matching container state), so the manual start is adopted as the service's initial start, not a fork.

Owner follow-up: the Coolify application record declares custom FQDNs (`s3-dev-garage.apps.sieh.org`, `web-dev-garage.apps.sieh.org`, `admin-dev-garage.apps.sieh.org`), but live Traefik routes still serve the auto `sslip.io` endpoints above. Switching endpoints is a Coolify-managed restart/redeploy plus local `.env` update and re-verification; bucket, key, and permissions are unaffected. Verification for #271 used the auto endpoints.

## Health check

Coolify runs:

```text
/garage stats -a
```

- Interval: 10 seconds
- Timeout: 5 seconds
- Retries: 5

This confirms process and cluster-statistics access. It does not prove authenticated object PUT/GET behavior.

## Operational inspection

Run read-only checks through the container:

```bash
ssh coolify 'docker exec garage-ckhy5vfyielgwo87ha4zaksd /garage status'
ssh coolify 'docker exec garage-ckhy5vfyielgwo87ha4zaksd /garage layout show'
ssh coolify 'docker exec garage-ckhy5vfyielgwo87ha4zaksd /garage bucket list'
ssh coolify 'docker exec garage-ckhy5vfyielgwo87ha4zaksd /garage key list'
ssh coolify 'df -h /data'
```

Treat layout changes, bucket administration, credential changes, public website access, volume changes, and data deletion as infrastructure operations requiring explicit authorization.
