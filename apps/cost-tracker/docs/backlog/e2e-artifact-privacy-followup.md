# E2E artifact privacy follow-up

Status: **non-blocking backlog, not an MVP acceptance gate**. The human explicitly ended the absolute-guarantee pursuit in FIX-B. Do not enable the retained runner-internals experiment as part of routine journey testing.

## Safe MVP improvements

- `access-and-links`, `hosting-setup`, `partnership-setup`, `participant-onboarding`, `claim-draft-and-costs`, `claim-review`, and `project-readiness` retain file-level `trace: "off"`; `sign-in-navigation` also disables tracing. This excludes auth API request bodies in hand-built contexts from trace archives. Video and automatic screenshots are explicitly off.
- Full-URL assertions now poll the **same complete URL equality or regex predicate**, handing only a boolean to matcher diagnostics. The setup-link input-value regex and replacement-path inequality likewise keep their exact checks without printing private values. Comments identify the preserved checks.
- `artifact-privacy.spec.ts` checks that wrong regex and exact-URL predicates still fail, the pure redactor works, and the default guard leaves the snapshot environment unchanged. Its synthetic URL probes do not navigate to a private link.
- `fixtures/artifact-privacy.ts` is retained and type-safe. The default `test` export installs **no** runner hooks; `installArtifactPrivacy` is deliberately a no-op. `experimentalTest`, `installExperimentalArtifactPrivacy`, and the named experimental probes are dormant, not used by journey specs or registered as tests.

## Residual vectors (not solved)

1. Playwright automatic failure aria snapshots (`error-context.md`) may include a private setup/registration link rendered in an input. `screenshot: "off"` and `trace: "off"` do not prevent these snapshots.
2. Reporter step titles/parameters and navigation/API errors are serialized before a surrounding catch or fixture teardown. They may include a secret-bearing URL even when the URL assertion itself reports only a boolean. The pure redactor is not a reporting boundary in the MVP default.
3. `claim-navigation.spec.ts` is separately owned and was never changed by FIX-B. Its N5 evidence/auth tracing must be reviewed independently; retaining evidence is not permission to capture credentials or secret-bearing request bodies.
4. Global setup intentionally stores session credentials in ignored `.auth/storage-state.json`. That setup storage is not a sanitized publication artifact.
5. Root and app `.gitignore` exclude `.playwright/` and `.auth/`; no CI artifact uploader is configured here. Ignore rules do not establish an external CI retention/discard policy or make HTML reports safe to share.

## Historical experimental verification

Before downscoping, Playwright 1.63.0 probes verified pre-serialization redaction of step titles, parameters and errors, including an aborted `page.goto`, plus restoration of hook identities and `PLAYWRIGHT_NO_COPY_PROMPT`. An intentionally uncaught full-URL mismatch used a generated private value in both the URL and a rendered input: it exited nonzero, retained the failing assertion/location, and exposed neither that exact value nor a DOM snapshot in stdout, results, or the decompressed HTML report. Trace-archive and credential/token/private-URL pattern audits returned zero hits. The inducement was reverted and the probe spec re-greened.

**That proof applies only to the experiment while enabled, not to the final default harness.** Final MVP verification checks file-scoped green journeys, zero trace archives, boolean matcher diagnostics, format/lint/type-check, and instruction synchronization. Reports remain local/private because reporter URL values are a known residual.

Wrap-up audit with the experiment dormant: Hosting (5), Partnership setup (11), Participant onboarding (7), Claim draft/costs (5), Claim review (2), Project readiness (2), and Access/links (8) tests passed, with zero trace archives on every file-scoped run. Decoded reports nevertheless contained private-link/token-pattern matches: Hosting 1, Partnership setup 10, Participant onboarding 10, Access/links 9 (match counts, not unique secrets). No values were published. Two earlier sign-in-navigation runs failed the unchanged 10-second URL predicate during server contention (111 and 109 seconds overall). A fresh human-run server subsequently passed the unchanged spec in 7.6 seconds; the final-close confirmation passed in 7.1 seconds (8 seconds overall). The accepted diagnosis is server contention, not an auth regression or FIX-A failure. No timeout increase, assertion weakening, or agent server restart was performed. This resolved validation episode is not a privacy follow-up blocker. An additional exact seed-password audit found zero stdout hits, but one failure-result entry and one decoded-report entry containing that credential: the automatic snapshot residual is confirmed, not merely hypothetical. Values were withheld; failed artifacts must remain private. Static type-check, format-check, lint, and instruction synchronization passed.

## Future acceptance work

- Choose a supported pre-serialization privacy boundary if possible. If reviving the internals experiment, review `_addStep`, `_failWithError`, `_combinedContextOptions`, and artifact-recorder teardown ordering against the installed version. Its version assertion must reject unreviewed upgrades; do not quietly bypass it.
- Register and redact every credential/token/private-link source, including nested/encoded login redirects, session values, auth/API request bodies, locator values, matcher-attached snapshots, errors and step parameters. Verify hook/environment restoration and `beforeAll`/`afterAll` coverage, including hand-built contexts.
- Decide how to retain useful **sanitized** N5 screenshots/evidence without tracing auth requests. Never weaken routing, authorization or data assertions to achieve redaction.
- Re-register and run the retained experimental probes; privately induce assertion and navigation/API failures with generated secrets rendered in the DOM. Audit stdout, result files, any archives, and the decoded HTML-report ZIP for exact values and token patterns. Revert inducements and re-green every touched spec fully.
- Confirm external CI discard/upload policy and artifact access controls. Keep raw artifacts private until the boundary is independently reviewed; do not hide leaks by deleting artifacts after capture.
