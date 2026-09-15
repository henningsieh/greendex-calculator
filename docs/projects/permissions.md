# Shared Project Permissions and Participant Authentication

Status: approved target model. The current Calculator and Cost Tracker implementations do not yet implement this model completely.

This document owns the cross-application permission model. Read [ADR-0002](../adr/0002-integrate-participants-with-better-auth.md), [ADR-0004](../adr/0004-scope-project-coordination-through-assignments.md), and [ADR-0005](../adr/0005-require-authenticated-participant-onboarding.md).

## Two authorization questions

```text
Better Auth role                         → what type of action may a User perform?
Project relationship or assignment        → for which exact Project or Project Partnership?
```

Neither answer replaces the other. A role never grants access to every Project, and a Project relationship never grants Organization-wide authority.

## Organization Membership roles

| Greendex name | Better Auth role | Meaning |
| --- | --- | --- |
| Organization Owner | `owner` | Full authority over one Organization, including Organization-level users and settings. |
| Organization Admin | `admin` | Organization-wide administrative authority below the Owner. |
| Project Coordinator | `project-coordinator` | Coordination capability narrowed by an explicit hosted-Project or Project-Partnership assignment. |
| Participant | `participant` | Participant-facing capability narrowed by the User's own Project Participation. |

Better Auth's default `member` role is a technical fallback. It is not a named Greendex actor and grants no Cost Tracker authority unless a future use case explicitly defines one.

One Membership may hold several roles. Assigning `participant` or `project-coordinator` never removes an existing role.

## Project Coordinator scope

ADR-0004 defines one `project-coordinator` role with two possible scopes:

- A Project Coordinator assigned to a Project hosted by their Organization performs Host-side coordination for that Project only.
- A Project Coordinator assigned to their Organization's Project Partnership performs Partner-side coordination for that Partnership only.

Organization Owners and Organization Admins retain Organization-wide authority. Project Coordinator assignments never grant Organization management authority.

## Participant onboarding

Every new Participant uses a Better Auth User account. There is no unauthenticated participant workflow and no secret personal dashboard link.

A Participant may join one Project Partnership in either of two ways:

1. **Known email:** a Better Auth Invitation to the Project's Hosting Organization grants the `participant` role after the recipient signs in and completes onboarding.
2. **Email unknown:** a reusable, app-owned Participant Registration Link identifies one Project Partnership and may be shared through WhatsApp or another channel. A recipient signs in or creates an account and completes the same onboarding.

A Better Auth Invitation is always an invitation into the inviting Organization. A Participant Registration Link is not a Better Auth Invitation.

Both routes end identically:

- the User has a Membership in the Project's Hosting Organization with the `participant` role;
- the User has one Project Participation for that Project;
- that Project Participation identifies the represented Partner Organization through its Project Partnership.

A User may have several Hosting-Organization Memberships and several Project Participations. A User may retain only one Project Participation per Project; attempting to join the same Project through a second Partner Organization is blocked.

A Participant dashboard lists only the User's Project Participations. A Hosting-Organization Membership alone never exposes unrelated Projects.

## App-wide participant profile and agreement

Participant profile data and agreement answers are centralized for the User rather than duplicated per Project Participation. The EU–Erasmus agreement is app-wide, versioned, and preserved when accepted.

A recipient completes their profile and accepts the current agreement version before their Participant access becomes valid. A newer agreement version blocks further participant actions until accepted. Previous accepted versions remain historical evidence.

## Authorization

- Organization Owners and Organization Admins of a Hosting Organization may access Participant profiles across its hosted Projects.
- Project Coordinators may access profiles and perform staff actions only within their explicit hosted-Project or Project-Partnership assignments.
- Partner Organization staff access Participants only through their assigned Project Partnerships.
- Participant personal access requires both the `participant` role in the Hosting Organization and the User's own Project Participation.
- Client-side checks control presentation only; server-side authorization is authoritative.

## Current-to-target migration

The target implementation must:

- introduce distinct custom Better Auth roles for `project-coordinator` and `participant`;
- migrate the current meaning of stored `admin` roles deliberately: `admin` becomes Organization Admin, while existing Project Coordinators move to `project-coordinator` as appropriate;
- create hosted-Project and Project-Partnership responsibility assignments and enforce them in every server-side write and read;
- replace unauthenticated participant persistence and secret personal links with account-based onboarding;
- centralize participant profile and app-wide agreement acceptance without exposing profiles outside their authorized Project relationships;
- preserve existing roles when adding `participant` or `project-coordinator`.
