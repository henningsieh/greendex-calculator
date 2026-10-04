---
status: accepted
---

# Grant Participant Membership Through a Server-Authorized Add Member Call

## Decision

A Participant's Better Auth Membership in the Hosting Organization is granted by the Cost
Tracker **server** calling `auth.api.addMember({ userId, organizationId, role })`, after the
server has authorized the issuer against the Project Partnership.

Cost Tracker **never writes a Better Auth table directly** — not `invitation`, not
`organization`, not `member`. Where Cost Tracker needs an authorization Better Auth does not
offer to its callers, the server calls a **server-only Better Auth API** and performs the
authorization itself in the domain layer it owns.

Entry points are app-owned tokens with **one mechanism and two flavours**: a
**Participant Invitation** is bound to one email address and only that address may redeem
it; a **Participant Registration Link** is open to anyone holding it. Both redeem through the
same procedure and produce the same result — Hosting Organization `participant` Membership
plus one Project Participation, and never a Membership in the Partner Organization.

The **Partner Organization initiates all participant contact.** The Hosting Organization
sends no participant an invitation, link or mail; it creates a Project, assigns a Partner
Organization, and that Partner Organization does the participant-facing work.

## Why

Better Auth `1.7.7` authorizes `createInvitation` by requiring the caller to already be a
member of the **target** Organization with `invitation:["create"]`
(`dist/plugins/organization/routes/crud-invites.mjs`). There is no server or admin
exemption. A Partner Organization member is not a member of the Hosting Organization, so it
cannot invite into it.

The implemented workaround wrote a row into Better Auth's own `invitation` table by hand,
then a bridge row, in one transaction (`issue-invitation.ts`, branch marked
`hostCanInvite === false`). That is not an authorization boundary. It also placed
foreign-issued rows **inside the Hosting Organization's own pending-invitation list**, which
`listPendingInvitations` reads with no role filter (`staff-invites.ts`), and where
`cancelInvitation` authorizes on active-Organization plus pending state alone. A Hosting
Organization admin could therefore see — and **Cancel** — participant invitations that a
Partner Organization had issued.

`auth.api.addMember` is the supported alternative for exactly this case: it is server-only,
has no HTTP route, performs no session or permission check, and delegates authorization to
the caller. That is the correct allocation for a domain rule Cost Tracker already owns.

## Also forbidden: hand-written Organizations and Memberships

`procedures/setup-links.ts` performed the same class of violation for the Partner-Organization
setup path, inserting into Better Auth's `organization` and `member` tables to make a
setup-link recipient the Owner of a newly created Partner Organization.

The supported path already exists. Cost Tracker forces a User with no Membership to create
their first Organization through the normal flow —
`NoOrganizationAccess` (`features/authentication/components/no-organization-access.tsx`)
renders a create-Organization form, rendered automatically for a newly registered User by
`(protected)/layout.tsx`. That flow calls `auth.api.createOrganization`, so Better Auth grants
creator Ownership itself.

The setup link therefore has **one** remaining job: bind the person who redeems it to a
Project Partnership. Its "new Organization" branch — the hand-written inserts — is **deleted**,
and a recipient without an Organization creates one through the existing flow and then redeems
the link against it, exactly as the "existing Organization" option already does. The Hosting
Organization creates the Project and invites the Partner side; **the Partner Organization owner
is created by the person who will own it**, never written on their behalf.

The principle is therefore not "don't hand-write `invitation`". It is: **Better Auth's tables
are never a writable extension point for Cost Tracker.** Every Organization, Membership and
invitation is created through a Better Auth API.

## Considered options

- **Keep the hand-written row.** Rejected: it forges a row that Better Auth later honours,
  leaks foreign rows into the Hosting Organization's admin surface, and depends on an
  undocumented internal table shape.
- **Let the Hosting Organization issue invitations.** Rejected. No ADR, issue, test, or
  manual-testing step ever required it; it entered through `partnershipForIssuer`, a scope
  helper that accepts either side of a Partnership, plus the mechanical need to know which
  Organization the Better Auth invitation should target. It contradicts the business model:
  moving the host's participant workload onto the Partner Organization is the point of this
  app.
- **Passwordless bearer links**, as in the KarmensLittleHelper clickdummy's ADR-003
  "Centralised Secure Access Links". Rejected. A token authorizes only _which Project_ may
  be joined, never _who the person is_. Participants authenticate normally; Better Auth owns
  sign-up, sign-in and email verification.

## Consequences

- `bridges` and the hand-written `invitation` rows are obsolete; ADR-0015 replaces both with a
  single app-owned token record. `bridges` has no reference outside Cost Tracker. The app is in
  a pure development phase with **no real data anywhere** and nothing public, so this is a
  **drop, not a migration**: the `bridges` table and its columns go, and the hand-written rows
  go with them. Nothing needs to be carried forward.
- Issuance scope narrows from "either side of the Partnership" to the **Partner side**, which
  removes the Hosting capability above.
- Inside the Partner Organization, `admin` and `project-coordinator` (displayed as Group
  Organizer on the Partner side, Project Coordinator on the Hosting side) invite
  participants. `owner` inherits lower-role permissions and loses nothing.
- A Participant sets their own `country` when joining — **EU countries only** — and an
  administrator may correct it afterwards. `country` is a Project Participation attribute,
  not a User profile attribute.

## Related

ADR-0002 (Participants integrate with Better Auth), ADR-0004 (coordination scoped through
assignments), ADR-0012 (ban the fallback `member` role),
ADR-0014 (declare permissions once, evaluate them on the server).
