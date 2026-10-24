# Live email verification

From the repository root, run `pnpm run test:integration`.

The integration runner reads both applications' ignored `.env` files and shared
`packages/database/.env`. It uses only existing loopback apps connected to
`greendex_development` at `188.245.144.137:5489`. It never builds, starts servers,
provisions, migrates or seeds. Missing seed Organizations, servers, mailbox
configuration or credentials fail verification rather than skip.

All outbound workflow messages target `greendex-testing@apps.sieh.org` only.
The recipient must have no pre-existing User or invitation rows. The workflow
checks that authenticated app sessions are visible in the same shared database
before creating mail fixtures.

Signup verification, Organization Invitation acceptance and password reset run
in both apps. Calculator also exercises magic-link sign-in; Cost Tracker
exercises Participant Invitation redemption. Each case checks a new IMAP UID
boundary, recipient/sender, subject and current-run account marker or API-issued
invitation identity. Parsed delivered links drive actual HTTP requests and
supported APIs. Invalid-password SMTP checks use in-memory copies and never
alter real credentials.

Messages are retained. Cleanup signs out run sessions and removes only rows
created for the run's dedicated recipient, preserving pre-existing verification
rows. The existing database and servers are never disposed of. Cleanup failures
fail verification. Abrupt termination is not proof of cleanup; inspect ownership
before manual recovery.

Console output reports workflow outcomes and timings without bodies, cookies,
delivered links, tokens, credential values or raw errors. Mocked mail tests are
unit coverage, not live-service acceptance. Calculator's legacy direct-template
preview is not a workflow check.
