# E2E artifact privacy review for #338

This report records the bounded review for [issue #338](https://github.com/henningsieh/greendex-calculator/issues/338).
It is evidence, not current instructions. The [current privacy policy](../../../../docs/agents/instructions/conventions.md#e2e-artifact-privacy)
owns artifact handling. No application, routing, authorization, or data behavior changed.

## Version gate

The review began at release/v0.1.1 commit `1dc66363152df69bfa43ea9852da73e3909911a1`.
The first app-local package lookup failed because the app has no local `node_modules`.
The root lookup `node -p "require('@playwright/test/package.json').version"` returned
`1.63.0`. The root package link points into `.pnpm/@playwright+test@1.63.0`.
The catalog and lockfile instead select `1.64.1`. Both versions exist in the shared
installation. These observations do not establish a consistent version-specific runtime.

The retained `installExperimentalArtifactPrivacy` rejects versions other than
`1.63.0`. The review did not invoke it, change its version assertion, change
dependencies, or investigate replacement runner internals.

## Supported API evidence

The installed `playwright/types/testReporter.d.ts` files for both versions describe
`onTestEnd` as receiving a complete result after a test finishes. They describe
`onStdOut` and `onStdErr` as callbacks when worker output is produced. Those
callbacks do not establish a pre-serialization guarantee across worker output,
automatic DOM snapshots, and global-setup session storage.

No supported boundary covering all required channels was verified. This is a
bounded negative finding, not proof that no future Playwright API can provide one.
A custom reporter that cleans its own output would not establish that guarantee.

## Chosen result

The default installer and test export remain dormant. The pure redactor remains
available without a claim that it protects reports. The existing experimental
exports remain unused. No induced failure, secret capture, or internal-hook redesign
formed part of this review.

`playwright.config.ts` disables trace, video, and automatic screenshots. Git ignores
both the E2E `.playwright/` output and `.auth/` session state. No repository CI
artifact uploader was added. These controls reduce capture and accidental commits,
but do not sanitize automatic `error-context.md`, reporter errors or steps, stdout,
HTML report contents, or session storage. The existing N5 ownership assertions in
`claim-navigation.spec.ts` remain unchanged.

## Verification scope and limits

The focused `artifact-privacy.spec.ts` checks the default no-op, pure redactor, and
full-URL boolean matcher behavior. A temporary fixture-only config can run it with
one worker, no global setup, no storage state, and a synthetic loopback base URL.
No app server or database is needed because these tests do not navigate.

The focused run passed all three tests with one worker and zero retries. The Cost
Tracker `pnpm type-check` command also passed. Both used the existing installation
and emitted a pnpm dependency-verification warning about the symlinked root
`node_modules`. These passes do not resolve the catalog mismatch.

Version mismatch blocks experimental privacy attestation. No decoded HTML ZIP,
DOM-snapshot leak audit, or zero-secret-hit guarantee is claimed. Failure artifacts
remain private. External CI access, retention, and discard require a manual operator
review. Issue #340's architecture cleanup is outside this change.
