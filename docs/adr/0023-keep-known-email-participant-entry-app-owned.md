---
status: accepted
supersedes:
  - 0005-require-authenticated-participant-onboarding.md (known-email delivery path only)
---

# Keep Known-Email Participant Entry App-Owned

## Context

ADR-0005 described the known-email Participant path as a Better Auth Invitation
into the Hosting Organization. ADR-0013 subsequently established app-owned,
Partner-initiated Participant entry tokens because Better Auth Organization
Invitations cannot authorize Partner staff to invite into the Hosting Organization.
The old delivery wording remained an apparent competing instruction.

## Decision

Supersede only ADR-0005's known-email delivery mechanism: a **Participant
Invitation** is an app-owned, email-bound token, initiated by authorized Partner
Organization staff. It redeems through the same onboarding procedure as a
Participant Registration Link, as decided in ADR-0013. Better Auth Organization
Invitations remain exclusively the colleague Membership workflow.

ADR-0005's account, profile, agreement, Membership, Project Participation, and
access requirements remain unchanged. No product permission or schema change is
authorized by this clarification.

## Consequences

Under #263's canonical-seed and test governance, ordinary onboarding preconditions
belong to named canonical scenarios; entry issuance and redemption use the owning
app's supported behavior. Tests must not substitute Organization Invitations or
hand-written Better Auth rows for Participant entry. Historical migration fixtures
remain the explicit exception, not an ordinary setup alternative.

Retaining the contradictory known-email mechanism was rejected: it would revive
the cross-Organization authorization and invitation-list leakage already rejected
by ADR-0013. This record affirms that decision rather than adding a third mechanism.
