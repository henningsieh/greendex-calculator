# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hosting-side staff and partner-side coordinators are co-primary; participants are supporting actors.

- **Hosting Organization staff** — Organization Owners, Organization Admins, and explicitly assigned Hosting-side Project Coordinators. They run projects day to day, manage Project Partnerships, review/approve/reject Claims, record payment, and archive/reopen projects.
- **Partner-side Project Coordinators** — set up their Project Partnership, select the Payout Account, onboard participants via Participant Invitations or Registration Links, record Participant Journeys, and prepare, correct, and submit their partnership's Claim.
- **Participants** — Users holding the `participant` role in the Hosting Organization. They accept the Participant Agreement, join through an entry point, and supply the journey their funding is based on. They never create, edit, or submit Claim data.

Success means every Project Partnership ends in a paid or rejected Claim and the project archives with a complete, traceable record: correct, auditable payouts with minimal correction loops. No quantitative success metric is established (open).

## Product Purpose

Cost Tracker administers travel-cost reimbursement for EU Erasmus-style projects: from partnership setup and participant onboarding, through journey capture and claim preparation, to hosting-side review, single-transfer payment, and archive of settled projects.

## Positioning

Cost-Tracker-only scope: per-project partnership administration of travel-cost reimbursement. One Claim per Project Partnership, derived from Participant Journeys, Cost Allocations, Proof Documents, and the project's immutable copied funding rules — the payable is the lower of approved allocated costs and covered participants' combined funding entitlements, never hand-entered. Each Claim is reviewed, corrected, approved, and paid as a whole; approval and payment are separate acts; a project archives only when every partnership is settled.

Calculator compatibility is a constraint, not the differentiator: the shared Organization/Project/Participation/Journey identity must keep working exactly as is. Improving Calculator is out of scope.

## Operating Context

EU Erasmus-style mobility projects: each Organization is based in exactly one EU country; distances come from the Erasmus Distance Calculator; funding follows distance bands with green versus standard (plane) travel; National Agency grant rules and signed participant grant agreements govern eligibility; Proof Documents and audits provide evidence. Staff work happens in the browser across hosting and partner organizations; participant entry runs through email-bound invitations or shareable registration links under a single-Organization policy; all procedures are server-authoritative.

## Capabilities and Constraints

Confirmed functionality: hosted and partner project scopes with truthful filters, ordered multi-sort, and opaque cursor pagination; the relationship-derived project workspace (the partner projection exposes no financials, documents, allocations, participant identity, or other partners); partnership setup, assignment, and removal; email-bound Participant Invitations and shareable Participant Registration Links; versioned Participant Agreement acceptance stored with content hash; exactly one Participant Journey per Project Participation (MVP), shared with Calculator; Travel Cost Entries with Cost Allocations and Proof Documents; reusable Payout Accounts selected per partnership; the claim lifecycle (in preparation → submitted → correction requested → submitted; approved → paid; rejected → reopened for hosting review); duplicate-identity Review Tasks; personal user settings (appearance, account name); seven locales with en-GB default (de, es, fr, it, nl, sl).

Durable constraints: one Claim per Project Partnership; Participants never touch Claim data; approval and payment are separate — one full bank transfer, no partial or multiple payments; archive requires every partnership settled (paid or rejected; zero partnerships archivable) and changes no Claim statuses; reopening requires a reason and is limited to Hosting Owners and Admins; the Better Auth fallback `member` role is banned; the `eu-erasmus-dev-v1` agreement copy is a fictional development draft — production requires counsel-approved copy and a new version (open); there is no live system or business data, only seeds and fixtures; upload/listing quotas are technical abuse protection.

Copy robustness (user-confirmed): button labels and control copy use predictable fixed text and never interpolate payload data such as project, organization, or user names; entity names render only in dedicated surfaces that own truncation. Unpredictable content must never decide control width — including in archive/reopen dialogs.

## Brand Commitments

Cost Tracker, part of the Greendex application family (app title "Cost Tracker"; "Organize Project travel costs, Proof Documents, and Cost Allocations."). No confirmed voice, logo, or visual assets — the public asset directory is empty. Omitted until established.

## Evidence on Hand

Real material: clickdummy requirements and traceability (`apps/cost-tracker/docs/clickdummy`), manual-testing runs (`docs/manual-testing`), master spec #414, accepted ADRs (0001, 0002, 0004–0012, 0027, 0028), and issues #332, #414–#416, #418. Absences future work must not fabricate: no production users, testimonials, benchmarks, pricing, or deployment claims; development data is disposable seeds and fixtures.

## Product Principles

1. Partnership scope — every Claim, invitation, payout selection, and onboarding entry point belongs to exactly one Project Partnership, never to a global relationship between Organizations.
2. Derived money — payable amounts are computed from journeys, allocations, and copied funding rules, never entered by hand.
3. Review as one decision — a Claim is reviewed, corrected, approved, and paid as a whole; approval and payment remain separate acts performed by authorized hosting-side roles.
4. Least privilege across the hosting/partner line — partner authority never suffices for hosting decisions (archive, approval, payment, reopen); participant authority never touches Claim data.
5. Predictable controls — labels, buttons, and dialog copy stay fixed and compact; payload data lives in dedicated truncating surfaces, never inside controls.
6. Cost-Tracker-only scope — improve this app without changing Calculator behavior; the shared identity is a compatibility constraint to preserve.
