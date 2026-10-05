---
status: accepted
supersedes:
  - 0012, in part
  - 0004, stored role spelling only
---

# Require Organization Country and Synchronize Role Values

## Decision

[Issue #220](https://github.com/henningsieh/greendex-calculator/issues/220) requires every Organization to have exactly one EU-code `country`, configured through Better Auth `additionalFields` in both applications. The shared fixed EU list is authoritative. Country is required on creation and editable through supported Organization update APIs; it is neither a Project nor a Project Partnership attribute. The Hosting Participant view displays the represented Partner Organization's country, independently of each Participant's Project Participation country.

Both applications use the shared role constants: `OrganizationOwner: owner`, `OrganizationAdmin: admin`, `Participant: participant`, and `ProjectCoordinator: coordinator`. The former Owner definition key and Calculator lowest-role entry are removed, not aliased. Cost Tracker's coordinator grants and assignment scopes are unchanged. Calculator retains its existing admin Project-management behavior and recognizes coordinator with no grants; further Calculator coordination behavior is outside this decision.

This supersedes ADR-0012's Calculator compatibility allowance and ADR-0004's stored coordinator spelling, not their authorization scopes. Library Membership table names are unaffected. Applied migration files and their historical regression coverage remain immutable records, not live role definitions.

## Clean development state

All existing data is mock-only. Wipe and reseed authorized development databases before applying the required-country migration. Do not invent countries for old Organizations or transform old role values in a compatibility migration. Each seeded Organization gets a fixed real EU country and every Membership uses final role constants. The implementation lane is isolated; it must never wipe a shared development database without separate operator authorization.

## Rejected

- Nullable country or a permanent unrecorded-country state: every legal Organization is based in exactly one country.
- Country on Project Partnership or per-Project allowed-country lists: these duplicate an Organization attribute or overcomplicate the fixed EU list.
- Aliases, role-value backfills, or retained lowest-role compatibility: there is no production data to preserve.
