# Cost Tracker HTTP API

Cost Tracker exposes the same procedure router over two transports:

- `/api/rpc`: the existing oRPC wire protocol used by the application.
- `/api/openapi/<router group>/<procedure>`: plain HTTP, using oRPC v2's default **POST** routes (for example `/api/openapi/projects/create`, `/api/openapi/projects/listHosted`, and `/api/openapi/organizations/getSettings`). Send the procedure input as a JSON body with `Content-Type: application/json`; responses contain the procedure output directly, without an RPC envelope. Procedures without input can omit the body.
- `GET /api/docs`: Scalar reference, with its script pinned to 1.73.0.
- `GET /api/openapi-spec`: generated OpenAPI JSON, using the generator's newest emitted version (currently 3.2.0).

Both reference paths are served by the OpenAPI reference plugin on the same handler. Its `allow` condition requires a valid Better Auth session **in every environment**, including production. Missing, expired, or invalid sessions fall through as unmatched (404), not as a login redirect. The viewer embeds the generated spec. Its try-it behavior is owned by Scalar, not the backend transport.

## Authentication and deployment

Sign in through `POST /api/openapi/authentication/signIn` with `{ "email": "…", "password": "…" }` and retain the returned session cookies. The OpenAPI handler forwards Better Auth cookies, including sign-out cookies. Browser mutations must send a trusted `Origin`; session checks, active Organization selection, permissions, tenant-scoped persistence, and domain refusals are the existing procedures' responsibility. There is no new API-key or bearer-token scheme, and the REST interface does not grant any additional access.

Configure `NEXT_PUBLIC_BASE_URL` as the **absolute production application URL** at build/deploy time (for example `https://<your-cost-tracker-host>`), not a relative path or localhost. The spec's `servers` URL is that configured URL plus `/api/openapi`, so try-it targets the deployed backend rather than a guessed host. Local builds use their local absolute URL. Deploy server and app clients together. No database schema or migration is added.

## JSON values and errors

REST uses schema-driven `SmartCoercionHandlerPlugin` consistently for every procedure, with the same Zod converter as the specification generator. ISO 8601 date strings become native Dates **before** the existing Zod validation; date outputs serialize as ISO strings. This deliberately differs from Calculator's non-coercing REST seam: without coercion, ordinary JSON cannot create a Cost Tracker Project or use date filters whose shared schemas require native Dates. The plugin also performs its vendor-defined schema-driven conversions (such as numeric/boolean strings); it does not replace validation or authorization. Invalid date strings and reversed date ranges return 400.

HTTP statuses use the existing `ERROR_STATUS_MAP`. Error bodies retain `code`, safe `message`, and `data` (including established domain `reason` values), not a body-level `status` or internal stack. Malformed JSON returns 400; unmatched REST routes return 404. External consumers should use HTTP status plus code/reason, not remote message text.

## Real-HTTP integration tests

`src/__tests__/openapi-http.test.ts` runs under root `pnpm run test:integration`.
It requires the existing loopback Cost Tracker app configured in its `.env` and
the same shared `greendex_development` database at `188.245.144.137:5489` as Vitest.
The runner loads configuration automatically and never starts or builds servers,
migrates or seeds. Missing prerequisites fail explicitly.

Fixtures use existing seed actors, sign in over real HTTP and verify that the
returned sessions are visible in the shared database. They create UUID-isolated
Projects and clean up their own Projects and sessions. No `TEST_RUN_ID` ownership
marker is required. These HTTP tests do not send verification mail.

Checks cover reference gating/spec/asset pinning, reads and Project creation,
session and permission failures, cross-tenant isolation, malformed JSON,
schema/date validation and continued RPC behavior. Logged request paths omit
query strings, bodies and cookies.
