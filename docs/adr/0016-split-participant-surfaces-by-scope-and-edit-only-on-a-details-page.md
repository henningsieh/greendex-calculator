---
status: accepted
---

# Split the Participant surfaces by scope, and edit only on a details page

> Recording correction: capability wording now reflects the original shared client/server
> requirement, as corrected in ADR-0014; the surface and editing decisions are unchanged.

## Decision

Three distinct surfaces replace the single page that today serves every actor at every scope.

**1. A Hosting Organization Participants page, per Project, read-only.** It lists that
Project's Partner Organizations in alphabetical order. Each shows its country, how many
Participants it has, and how many have completed the Participant Agreement. Expanding a
Partner Organization reveals one card per Participant: name, country, gender, email, and
agreement completed or pending. **It has no controls at all.** It answers "is onboarding
moving?" and nothing else.

**2. The Partner Organization's Partnership Participants page keeps every control** it has
today, gated by shared client/server permission and business rules, with authoritative
server enforcement. Hosting staff may open it and read it; they are
shown no controls. No Partner-side capability is removed.

**3. A Participant details page is new.** It is where editing happens. An actor edits the
fields they may edit and reads the rest; the page is read-only for everyone else. **Only the
Partner Organization may correct a Participant's `country` here**, because the Participant
fills it in themselves when joining.

Two placement rules follow and are stated as rules, not as preferences:

- **Never edit in a list row.** Editing belongs on a details page, where a single subject is
  the whole point of the screen.
- **`Remove Project Participation` stays a row action**, with confirmation. Removing someone
  is a bulk-cleanup act over a list, not a detail edit.

**4. The Projects list gains two links per Project row:** to that Project's details page, and
to that Project's Participants page. Today the Participants route exists but nothing links to
it — it is reachable by URL only.

## Why

The current page is a Partnership-scoped Partner workspace, and Hosting staff open it. It
guards on `hasOrganizationMembership()`, which checks _any_ Membership — not role, not side
— so a Hosting admin lands on every control and the server then refuses most of them. Three
different questions are being answered on one screen:

- _How is onboarding going across my whole Project?_ — needs Project scope, no controls
- _How do I run onboarding for my own Partnership?_ — needs Partnership scope, all controls
- _What are this one Participant's details?_ — needs a subject, and editing

A Hosting Organization owns the Project, so its Participants are its own people and it is
entitled to see progress. It has no Participant-facing work — the Partner Organization issues
every participant entry point (ADR-0013) — so it is entitled to no controls. The clickdummy
already draws exactly this split: `admin/project/ProjectParticipantsPage.tsx` is read-only and
grouped by Partner Organization, while `partner/PartnerParticipantsAdminPage.tsx` holds every
action.

`country` moves because the clickdummy sets it once, in the Participant's own registration
form, and shows it to the Partner as read-only text. Cost Tracker keeps the Partner's ability
to correct it, because that correction has to live somewhere — and a list row is the wrong
place for it, sitting between the Participant's own details and the control that deletes them.

## Consequences

- Requires a **staff-facing read of agreement acceptance**, which exists in
  `procedures/onboarding-progress.ts` but is not exposed to staff today, plus a **Project-level
  aggregate** grouping Participants by Partner Organization. Both are new reads; neither
  replaces an existing one.
- The Hosting Participants page needs Participants who have not yet completed onboarding to be
  _visible_, so the aggregate must read Project Participations rather than only joined Users.
- `Participant Registration Link` and `Participant Invitation` sections move with the rest of
  the Partner workspace; they are entry issuance, not Participant detail, and stay on the
  Partnership page.
- Resolves the earlier finding that a country control sat between a Participant's data and
  their removal, and that the Participants page asserted authority it did not have.

## Related

ADR-0013 (the Partner Organization issues every participant entry point), ADR-0014
(shared client/server rules, fail-closed), ADR-0015 (a Project Participation belongs to a
Project, so it is never scoped by the active Organization).
