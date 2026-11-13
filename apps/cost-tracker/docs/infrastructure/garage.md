# Garage S3 infrastructure

Current operating reference for Cost Tracker storage. Follow the [Coolify runbook](../../../../docs/agents/instructions/coolify.md) for managed changes. Resolve mutable details through the live API before operations.

## Environments

Both services belong to Greendex on the Coolify host (`ssh coolify`). Production has no Garage service.

| Setting            | Development                                | Staging                                |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| Service            | `greendex-development-s3`                  | `greendex-staging-s3`                  |
| S3 API             | `https://s3-dev.greendex.apps.sieh.org`    | `https://s3.greendex.apps.sieh.org`    |
| Bucket websites    | `https://web-dev.greendex.apps.sieh.org`   | `https://web.greendex.apps.sieh.org`   |
| Admin API          | `https://admin-dev.greendex.apps.sieh.org` | `https://admin.greendex.apps.sieh.org` |
| Application bucket | `greendex-cost-tracker-development`        | `greendex-cost-tracker-staging`        |

## Configuration

Coolify manages `GARAGE_S3_API_URL`, `GARAGE_WEB_URL`, and `GARAGE_ADMIN_URL`. Change these through Coolify and restart the owning service to regenerate routes. Never edit generated Compose output.

Traefik terminates TLS. Container ports are `3900` for S3, `3902` for bucket websites, and `3903` for the admin API. Garage has no bundled admin dashboard. Unsigned S3 requests can return `403`, an admin-root request can return `400`, and a website without a matching bucket can return `404`. These responses do not prove authenticated storage access.

Application clients use region `garage` and path-style addressing (`S3_FORCE_PATH_STYLE=true`). `.env.example` defines the non-secret contract. Credentials belong in ignored local `.env` files or Coolify, never documentation. Application keys have bucket read/write access, not bucket-administration permissions.

## Persistence

Each service has isolated `garage-data` and `garage-meta` named volumes prefixed with its UUID. They mount at `/var/lib/garage/data` and `/var/lib/garage/meta`. Coolify mounts the service's `garage.toml` at `/etc/garage.toml`.

Each cluster has one node and replication factor 1, without data redundancy. Preserve bucket identities, aliases, keys, permissions, and volumes when changing domains. Volume deletion or replacement requires explicit authorization.

## Verification

Run `pnpm run test:integration` from the repository root using the local development `.env`. The live test verifies PUT, byte-for-byte GET, DELETE, and invalid-credential rejection. It rejects non-development targets and writes unique run-owned keys under `smoke-tests/`. If interrupted, remove only the confirmed run-owned orphan, never a shared prefix or bucket.

For staging, use its application key and configured bucket with a unique temporary object. Verify downloaded bytes and delete only that object. Confirm existing aliases and permissions remain intact.

Garage process health does not prove authenticated storage access. Resolve the target service and container through Coolify before inspecting cluster status, layout, or buckets.

## Proof Document policy

- Keep Claim Proof Documents in the private bucket while their Project is active. No automatic expiry is implemented.
- Treat uploads as untrusted. Malware scanning is best effort, not an enforced upload or download gate. Acceptance does not mean a file is clean.
- Project archival should delete its Proof Document objects and references. No automatic archive hook implements this policy yet. Arrange and verify scoped deletion operationally, without deleting unrelated objects or the bucket.

## Application upload and listing limits

Application procedures enforce these source-defined limits independently of the gateway.

| Control                               | Limit                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Multipart transport                   | 11 MiB per upload request                                                |
| Proof Document                        | 10 MiB per file                                                          |
| Claim                                 | 25 Proof Documents and 100 MiB                                           |
| Partner Organization uploads          | `DAILY_UPLOAD_BYTES`, 500 MiB per UTC calendar day                       |
| User and active Organization listings | `LISTING_CALLS_PER_MINUTE`, 120 calls per epoch-aligned 60-second window |

The daily upload allowance counts successfully persisted bytes across all Claims
of the Partner Organization. Deletion does not refund consumption. The listing
allowance is shared by `projects.listHosted`, `projects.listPartner`,
`projects.searchHosted`, and `projectPartnerships.list`, including direct server
calls. Calls that fail existing input or access checks do not consume allowance.
Exhausted allowances return safe HTTP 429 errors. Fixed-window boundary bursts
are permitted.

[Quota procedures](../../src/features/quotas/procedures/counters.ts) own the named
constants and PostgreSQL counters. Bounded best-effort expiry cleanup runs after
quota decisions, outside their transactions, with `QUOTA_CLEANUP_BATCH_SIZE` set
to 500 rows per call.
