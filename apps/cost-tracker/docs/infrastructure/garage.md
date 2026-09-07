# Garage S3 infrastructure

Deployment-specific reference for the Garage service behind this project's S3 configuration. Follow the repository-wide [Coolify runbook](../../../../docs/agents/instructions/coolify.md) for persistent resource changes, deployment operations, and incident handling. This Garage service remains in the separate `ambitia-cost-tracker` Coolify project while the consuming application lives in this repository.

This document contains no credential values. Application configuration lives in `.env.example`; usable local secrets live only in the ignored `.env`.

Snapshot verified: 2026-09-04 08:23 CEST.

## Coolify resources

| Resource            | Name                   | UUID                       |
| ------------------- | ---------------------- | -------------------------- |
| Project             | `ambitia-cost-tracker` | `zvzfc1ubnr6qld27tgvkpev5` |
| Environment         | `development`          | `wiryuzmtpja3crydzqg1hkwb` |
| Service             | `garage-s3`            | `ckhy5vfyielgwo87ha4zaksd` |
| Service application | `garage`               | `r9igtcff3sdnrdyc5adfyv77` |

- Coolify host: `188.245.144.137`
- SSH alias: `coolify`
- Container: `garage-ckhy5vfyielgwo87ha4zaksd`
- Image: `dxflrs/garage:v2.1.0`
- Docker network: `ckhy5vfyielgwo87ha4zaksd`
- Observed state: running and healthy

## Public endpoints

| Purpose                | URL                                  | Internal port |
| ---------------------- | ------------------------------------ | ------------- |
| S3 API                 | `https://s3-garage.apps.sieh.org`    | `3900`        |
| Static bucket websites | `https://web-garage.apps.sieh.org`   | `3902`        |
| Admin API and metrics  | `https://admin-garage.apps.sieh.org` | `3903`        |

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

## Application bucket and key

| Setting              | Current value                      |
| -------------------- | ---------------------------------- |
| Bucket alias         | `ambitia-cost-tracker-development` |
| Bucket ID prefix     | `b42cef2e76ed4a0b`                 |
| Website hosting      | Disabled                           |
| Current objects      | `0` at snapshot time               |
| Application key name | `ambitia-cost-tracker-development` |
| Bucket permissions   | Read/write                         |
| May create buckets   | No                                 |
| Key expiration       | Never                              |

The access-key ID and secret key are intentionally omitted. Their local values are in `.env`; `.env.example` is the authoritative non-secret application configuration contract. The application key cannot create or administratively reconfigure buckets.

A temporary object PUT/GET/delete was successfully verified against the public S3 endpoint, and the verification object was removed.

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
