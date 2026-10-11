# Shared-database merge proof

Issue [#255](https://github.com/henningsieh/greendex-calculator/issues/255) is the merge-done gate for Calculator and Cost Tracker. Run against mocked development data only; production is outside this workflow.

## Prepare once

1. Stop local app servers. Inspect only the URL host of the effective `DATABASE_URL` (including any injected override), and confirm it is the intended shared development resource described in [development databases](development-databases.md). Never print credentials or the connection string.
2. Obtain explicit owner authorization before wiping mock data. Wipe both the development `public` schema and its `drizzle` migration journal together; do not delete journal entries while retaining tables. No automatic reset command is provided.
3. Run the existing commands from the repository root:

   ```sh
   pnpm run db:migrate
   pnpm run db:seed
   pnpm run dev
   ```

The canonical migration chain recreates all shared and Cost Tracker tables. The one shared seeder includes distinct `Seed Organization` (DE, Hosting) and `Seed Partner Organization` (FR, Partner), the Hosting Project `Carbon Footprint Workshop`, one linked Participant with a Paris → Berlin round-trip Participant Journey (878 km), and an editable Claim containing a EUR 120 train Travel Cost Entry allocated to that Participant. It freezes the complete configured Project funding rules with the Journey. No invitation, email, Proof Document upload or payout information is required to inspect this draft.

Sign in with the mock development User defined in `@greendex/auth/seed-user`; the seeder does not print the password.

## Repeat the browser gate

With both apps running against that same connection:

```sh
pnpm --filter @greendex/calculator exec dotenv -e ../../packages/database/.env -e .env -- playwright test --config playwright.merge.config.ts
```

This dedicated Playwright configuration is separate from the ordinary single-app and Vitest suites. Calculator's local origin comes from its environment; Cost Tracker's comes from `COST_TRACKER_E2E_BASE_URL` or its own local `.env`. Remote app origins are refused. The two apps use separate browser contexts so localhost session cookies do not overlap.

The proof opens the same Hosting Organization and Project ID in both apps, displays the canonical Participant Journey on Calculator's Project **Project Participants** tab, then opens Cost Tracker's Hosting Project with its assigned Partner Organization. It switches the acting Organization to the Partner through the UI, opens the same Project as a Partner Project, clicks **Open Claim workspace**, and verifies the saved editable Claim, same Journey, and train cost. It does not submit or mutate the Claim.

Calculator only reads and displays the shared Journey; its questionnaire-derived carbon calculation is unchanged. Calculator does not expose Cost Tracker's Hosting/Partner distinction.

Mock-data screenshots are saved locally (not committed) under `apps/calculator/src/__tests__/e2e/.playwright/`: `merge-calculator.png`, `merge-hosting.png`, and `merge-partner-claim.png`. No authentication storage, login screenshots, trace or video is captured by this proof.

## Checks

Run `pnpm run format && pnpm run lint`, `pnpm run type-check`, the focused development-seed and Participant-Journey Vitest regressions, and the full unit/integration suite once at the end. Keep Cost Tracker running for its real-HTTP OpenAPI regression; stop app servers only for the wipe/seed operations. The development-seed regression verifies the normal migration and seed commands on a disposable database on the selected development server; it never wipes the shared app database. Check that another `pnpm run db:migrate` is a clean no-op.
