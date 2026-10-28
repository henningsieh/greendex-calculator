# HANDOVER — feat/337: partnership-setup.spec.ts E2E failure (TEMPORARY FILE — delete on resolve)

Branch: `feat/337-at-most-one-partner-broken` (was `feat/337-at-most-one-partner`).
Issue: #337 (at most one Partner Organization per Project). App + integration changes are done and verified; THIS FILE IS ONLY ABOUT the E2E failure below.

## Problem

`apps/cost-tracker/src/__tests__/e2e/partnership-setup.spec.ts`, test 06
("P reopens after signed-out sign-in, creates Partner A once, replay is idempotent"):
clicking the claim link (`a[href^="/partnerships/"][href$="/claim"]` on the partner
project page) does NOT land on `/partnerships/*/claim`. The browser stays on
`/projects/<main>` (heading "Welcome back”-style project page, "Claim readiness:
No Claim", "Open Claim workspace" link visible). With the added `waitForURL`
guard the failure is now honest: `waiting for navigation to "**/partnerships/*/claim"`,
only navigation observed is to the project page itself, then 60s test timeout.

## Key facts (verified, not guessed)

- Tests 05+06 in ISOLATION pass (`-g "05 H creates|06 P reopens"`, 59.9s). Full-file
  run fails at 06 every time; serial describe then skips the remaining 15.
- The claim page (`app/(protected)/partnerships/[id]/claim/page.tsx`) has NO redirect;
  `lib/session.ts` only redirects to `/login`. No app code redirects claim → project.
- The link is a plain Next `<Link>`, no `target=_blank` (`project-workspace.tsx:279`).
- The `waitForURL("**/partnerships/*/claim")` guard in `selectAndOpenPartnerProject`
  was added deliberately: the old bare h1 assertion is vacuous (both pages share the
  h1 pattern) and let the suite race ahead on the wrong page. Do NOT remove it;
  fix the navigation instead.
- DB is clean: fresh `greendex_development`, all migrations incl. 0036 applied,
  new seed, `violating-rows` query returns 0. Failure is NOT stale data.
- Evidence: `apps/cost-tracker/src/__tests__/e2e/.playwright/results/partnership-setup-Partner--b7596-A-once-replay-is-idempotent-chromium/error-context.md`
  (representative snapshots; exact folder suffix varies per run).

## What was already adapted for at-most-one (do NOT redo)

- Extra per-test projects (`extraProjectNames` Second…Seventh) created in test 05;
  tests 06-dup (D), 06a (R), 06b (U), 08 (F), 09a (target) each redeem on their own
  project; test 13's second sibling link on Seventh; 13a asserts per-actor project;
  checkpoint 17 rewritten for one-partnership-per-project. P stays on Main.
- `error-contract.ts` + snapshot: new `PROJECT_ALREADY_HAS_PARTNER` outcome.

## Instructions for the follow-up agent

1. Reproduce: `pnpm run dev` (needs DB `DATABASE_URL` from `packages/database/.env`;
   dev servers calculator :3000 / cost-tracker :3002), then
   `pnpm run test:e2e partnership-setup`. To iterate on 05+06 only, from
   `apps/cost-tracker` with `NEXT_PUBLIC_BASE_URL` + `DATABASE_URL` exported:
   `pnpm exec playwright test --config=playwright.config.ts --workers=1 --retries=0 src/__tests__/e2e/partnership-setup.spec.ts -g "05 H creates|06 P reopens"`.
2. Prime suspects, in order: (a) Turbopack cold-compile of the claim route on first
   visit — warm it (`curl` the claim URL first) and re-run; if green, add a
   warm-up visit instead of longer timeouts. (b) Layout-shift misclick (toast
   overlay at click coordinates) — inspect screenshots/DOM, not timeouts.
   (c) Only if (a)+(b) are excluded: genuine product regression from #337 —
   then fix the APP, never weaken the test (no longer timeouts, no dropped
   assertions; a same-project second partnership MUST stay rejected).
3. Do NOT "make the tests pass" by re-homing P off Main or deleting the claim
   assertions. The app behavior is the spec; the test proves it.
4. When green: run the FULL file (serial; ~10-20 min), then commit on this branch.
   Delete this file when the E2E is green and merged. Never push / open PR /
   close #337 without the operator.
