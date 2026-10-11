---
status: accepted
supersedes:
  - 0002-integrate-participants-with-better-auth.md
---

# Require Authenticated Participant Onboarding and an App-Wide Agreement

Every Participant creates or signs in to a Better Auth User account, completes a centralized profile, and accepts the current app-wide EU–Erasmus agreement before their Participant access becomes valid.

## Context

ADR-0002 introduced a mixed model: a person could create a Project Participation without an account, and a later email-specific Better Auth Invitation could link that Participation to a User. It also allowed an email-less unlogged person to persist data once.

That model was intended to mirror the clickdummy's secret personal links. It is no longer acceptable. Secret personal links are bearer credentials with unclear expiry, revocation, recovery, and recipient verification. They also make it difficult for one person to see all of their Projects through one account.

The clickdummy's required user outcomes remain authoritative: Participants provide their personal details, accept an agreement, and see their Projects. Its secret links, Project-specific agreement, and unauthenticated persistence are implementation choices to replace.

A Participant may join through one of two delivery paths:

1. When the Partner Organization knows the recipient email, it uses a Better Auth Invitation to the Project's Hosting Organization.
2. When email is unknown, the Partner Organization shares a reusable Participant Registration Link for one Project Partnership through WhatsApp or another channel.

A Better Auth Invitation has one precise meaning: an invitation into a role of the inviting Organization. A Participant Registration Link is an app-owned registration entry point, not a Better Auth Invitation.

Participant profile data and agreement answers must be one centralized User-owned source of truth. The agreement applies across the Cost Tracker's EU–Erasmus scope rather than separately to each Project.

## Decision

### Account-based participant onboarding

- Every new Participant signs in or creates one Better Auth User account.
- No new Participant may persist Project data or gain Participant access without an account.
- Every valid Participant access combines:
  - a Better Auth Membership in the Project's Hosting Organization with the custom `participant` role; and
  - one Project Participation linked to that User and representing one Organization in that Project.
- A User may retain at most one Project Participation per Project. A second attempt to join that Project through another Partner Organization is blocked.
- A Participant dashboard lists only the User's Project Participations. A Hosting-Organization Membership alone never exposes unrelated Projects.

### Delivery paths

- A known-email path uses a Better Auth Invitation to the Hosting Organization with the `participant` role.
- An unknown-email path uses a reusable Participant Registration Link that identifies exactly one Project Partnership. Anyone holding the link may start onboarding, but must create or sign in to their own account.
- Both paths use the same onboarding and authorization result. Neither path creates a Membership in the represented Partner Organization.
- The onboarding flow records profile and agreement acceptance before it completes the Better Auth invitation acceptance or grants valid Participant access.

### Profile and agreement

- Participant profile data and agreement answers belong to one centralized User-owned profile, not to Project Participation.
- The EU–Erasmus agreement is app-wide, versioned, and its accepted content and answers are preserved as historical evidence.
- A Participant must accept the current agreement version before any Participant action is available.
- Acceptance of a newer agreement version is required before any further Participant action. Earlier acceptances remain historical evidence.

### Participant onboarding closure

- A Partner Organization may close its reusable Participant Registration Link at any time through an explicit “everyone has registered” action.
- Closure does not require a minimum Participant count or a separate agreement-completion check: successful Participant onboarding already includes current agreement acceptance.
- The Partner Organization may reopen its link before its Claim is submitted.
- A configured automatic deadline is deferred as an optional future extension.

### Authorization

- A Participant's personal access requires both the `participant` Better Auth role in the Hosting Organization and that User's own Project Participation.
- Partner Organization staff may access centralized profiles only through their assigned Project Partnerships.
- Hosting Organization Owners and Organization Admins may access profiles across their hosted Projects; Project Coordinators are limited to their explicitly assigned Projects.
- Centralized storage never creates cross-Project or cross-Organization disclosure without an authorized Project relationship.

## Considered options

### Secret personal links without accounts

Rejected because bearer links do not provide normal account security, recovery, revocation, or one-account cross-Project visibility.

### Better Auth Invitation only

Rejected because a Partner Organization may not know a prospective Participant's email address. A reusable Registration Link supports WhatsApp and similar delivery while still requiring account-based onboarding.

### Unauthenticated one-time data persistence

Rejected because every Participant now uses a Better Auth account and must have accepted the agreement before Participant access is valid.

### Project-specific agreements and profiles

Rejected because normal personal data and agreement answers need one user-owned source of truth. The app-wide versioned agreement preserves the legal history of each acceptance without copying the profile into every Project Participation.

### Multiple Project Participations for one User in one Project

Rejected because one person represents exactly one Organization in one Project. A second join attempt must be corrected through an explicit staff process, not silently create a conflicting relationship.

## Consequences

- ADR-0002's email-optional, unauthenticated-participation flow is superseded. Its Hosting-Organization Membership, multi-role, and Project-Participation authorization principles remain in force where they do not conflict with this ADR.
- The shared Project model and authorization documentation must be revised before their schema blueprints are implemented.
- The system needs an app-owned Participant Registration Link record with a hashed secret, Project-Partnership binding, enabled state, and auditable creation/closure state.
- The system needs a centralized User-owned Participant profile and versioned agreement-acceptance persistence model.
- Better Auth account, Membership, `participant` role, Project Participation, profile completion, and agreement acceptance require transactional or compensating-failure handling.
- Participant Registration Links remain reusable. Partner-Organization Setup Links are a separate app-owned, email-specific Project-bound registration flow and are not Better Auth Invitations.
