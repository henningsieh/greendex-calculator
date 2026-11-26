# Realtime notifications service

Standalone, single-instance Socket.IO service for Cost Tracker notifications.
It validates the Better Auth session on every handshake, joins each socket only
to its personal `user:<id>` room, and broadcasts validated
`notification-created` payloads. It contains no domain or authorization logic:
recipient resolution happens in Cost Tracker where the Claim change is made.

## Local development (dual process)

Cost Tracker emits after commit to this service; the browser connects here for
live delivery. Both processes must run and share the emit secret.

1. Copy `.env.example` to `.env` and set a random `REALTIME_EMIT_SECRET`
   (at least 16 characters).
2. Set the same `REALTIME_EMIT_SECRET`,
   `REALTIME_INTERNAL_URL=http://127.0.0.1:4001`, and
   `NEXT_PUBLIC_REALTIME_URL=http://localhost:4001` in `apps/cost-tracker/.env`.
   `NEXT_PUBLIC_REALTIME_URL` is the browser-facing Cost Tracker setting; it is
   not the same value as the Realtime service's own `REALTIME_PUBLIC_URL`.
3. Run `pnpm dev` at the repository root. Turbo starts Cost Tracker on
   `COST_TRACKER_PORT` (3002) and Realtime on `REALTIME_PORT` (4001).

`REALTIME_PUBLIC_URL` is the deployed Realtime service origin; the browser
receives its connection target from Cost Tracker's `NEXT_PUBLIC_REALTIME_URL`.
`COST_TRACKER_PUBLIC_URL` is the only allowed CORS and WebSocket-handshake
origin, and `COST_TRACKER_INTERNAL_URL` is used to validate session cookies
against `/api/auth/get-session`. `REALTIME_BIND_HOST` is the bind address; use
`127.0.0.1` locally and `0.0.0.0` in a container deployment record.

## Deployment contract

- One instance only for v1. There is no Redis adapter, sticky-session
  fan-out, or organization room. Scaling horizontally would split personal
  rooms across instances and must not be done without replacing this design.
- Keep the public Realtime origin reachable with the Cost Tracker session
  cookie. The Better Auth cookie is host-only by default, so a sibling
  subdomain alone is not enough: configure the cookie `Domain` to cover both
  hosts, or serve Realtime from the Cost Tracker origin. Otherwise the
  handshake is rejected as `unauthorized` and only the persisted inbox works.
- Expose `/health` for the platform health check.
- The internal `POST /emit` endpoint requires
  `Authorization: Bearer $REALTIME_EMIT_SECRET`; do not expose it publicly
  without that secret.
- Payloads are validated against the shared `@greendex/notifications` catalog.
  The service logs failures and counts, never raw cookies or client objects.
