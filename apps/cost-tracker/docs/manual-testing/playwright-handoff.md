# Handoff: coordinator discovery + desk fixes (for the Playwright journey agent)

Branch `fix/add-missing-features` fixes the blockers behind your case-20
"No matches" report and the coordinator blindness around it. Manual
repro by the human: search found the user, Add Participation succeeded,
entry listed. The product path is unblocked — details and required
spec updates below.

## What was actually broken (and fixed)

1. **Assigned coordinators were invisible.** A pure `project-coordinator`
   saw an empty `/projects` with no click path (list/detail procedures only
   understood owner/admin roles), while assignment-scoped workspace
   procedures worked via direct URL. Front door and back door disagreed.
   Fixed: `availableScopes`, `listPartner`, `getProject` (partner branch),
   and `projectPartnerships.list` now honor explicit coordinator
   assignments — assigned partnerships only, never Organization-wide.
   New isolation tests: sees own, denied foreign, stranger sees nothing.
2. **Partner Organizations page crashed for coordinators** (prefetch
   denial + error wall + dead setup-link form). Fixed: the page gates with
   the same checks as its data (friendly note otherwise), the nav tab hides
   when unusable, setup-link creation and Remove render only with the
   create grant.
3. **Desk naming.** "Partnership Participants" → "Project Participations";
   "Participant entry points" → "Participant Invitations and Registration
   Links"; pre-participation people are "Registered User", never
   "Participant"; joined list carries a "N Participants in {Project}"
   subtitle; login 401s now read "Invalid email or password".
4. **Your "No matches" is not reproduced manually.** Server procedure
   verified live (returns the user), human browser run found/added/listed
   the same fixture. Suspect your run's session/fixture/timing, not the
   selector. Discriminators that still apply: capture the
   `participations/searchOnboarded` request/response; try
   `pressSequentially` vs `fill`; compare acceptance hash and profile bytes.

## Spec updates required on your side

- "Add an onboarded Participant" → "Add this registered User";
  "Onboarded Participant" (button + search box) → "Registered User".
- New subtitle text under Joined Participants ("1 Participant in {Project}").
- Coordinators can now navigate via `/projects` instead of direct URLs.
- `partnership-setup.spec.ts` fails typecheck: missing
  `./fixtures/hosting-journey` module.

## Validation state

Full `pnpm --filter @greendex/cost-tracker test` re-running at handoff
time; unit/integration suites for all touched areas green on this branch.
Dev-only agreement `eu-erasmus-dev-v1` active; no real bank transfers in
any flow. Repro fixture (`repro-*`, `repro-coord@sieh.org`) still in the
dev DB for manual retests — coordinate before wiping.
