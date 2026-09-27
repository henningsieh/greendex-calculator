# Cost Tracker Manual Test Journey

Pair walkthrough on the real dev server. Proves the implemented Claim workflow end to end through human eyes: onboarding, coordination, journeys, costs, claims, review, payment, readiness, completion — plus the security and abuse cases the automated suites assert blind.
Traceability: `[...] ` tags map each case to a ticket (`#164`–`#187`), ADR, or clickdummy use case (`CD-02`–`CD-11`). Normative behavior: [Claim workflow](claim-workflow.md), [use-case traceability](clickdummy/requirements-traceability.md).

## Personas and shorthand

- **H** — Hosting Organization Owner (staff side).
- **P** — Partner-side coordinator, shown in UI as Group Organizer (partner side).
- **T**, **U** — Participants (travelers).
- **F** — Foreign coordinator (second Partner Organization; isolation checks).
- **X** — plain member / stranger (denial checks).
  `→` means "expect". All Partner-side work happens in P's Partnership and Project unless stated otherwise.

## 0. Prerequisites and known blockers (read first)

- Dev database migrated through `0026`, dev server running, disposable accounts per persona (see [E2E test account](README.md#end-to-end-test-account) pattern; use fresh addresses per run).
- **BLOCKED until legal publishes (see #184):** anything requiring agreement acceptance (join completion, dashboard access, Participant-gated actions). The app must refuse with "not yet available" — verifying the refusal IS the test until then; full join flows unlock after publication.
- **Email:** invitation delivery needs a dev SMTP sink; without one, assert the invitation record plus bridge exist and the recipient link is redeemable — actual inbox arrival stays unverified (see #182).
- Cost Tracker and Calculator share auth data: do not reuse personas across apps in one run.

## 1. Project lifecycle (hosting side)

Prerequisite for §2 onward: at least one Project must exist. If any case
below has no UI surface, record it as a gap instead of working around it.

- T01 — H (Owner/Admin) creates a Project (name, dates, location, country);
  it appears in the projects list with derived readiness. [#166]
- T02 — Member/Participant attempts project creation → denied server-side.
  [#179]
- T03 — H designates the hosting-side coordinator (project responsible user);
  that coordinator gains host-scoped powers (review queue, issuance) while
  unrelated projects stay out of reach. [ADR-0004, #166]
- T04 — Archived project: creation-type actions (setup links, invitations)
  are denied; existing data stays readable. [#164]

## 2. Hosting setup

- T05 — H signs in, creates/selects the Hosting Organization. [#164]
- T06 — H invites a colleague as Organization Admin in the Calculator app team page (Cost Tracker has no staff-invite UI; membership is org-level and shared: http://localhost:3000/en/org/team); colleague accepts and sees the org. [CD-02, #164]
- T07 — X (no membership) opening any protected page → access-denied surface, no data. [#179]

## 3. Partner setup link (org-less recipient flow)

- T08 — H creates a recipient-bound Setup Link for Project + email (project must exist — see T01); copies it (`Kopieren`). [#164, #173]
- T09 — Recipient opens link signed out → guided to sign-in, link preserved for revisit after sign-in (no returnTo magic; manual revisit works). [#173]
- T10 — Wrong email signs in and redeems → distinct wrong-email error, no side effects. [#164]
- T11 — Disabled link → distinct disabled error. [#164]
- T12 — Recipient creates a NEW Organization → Partnership created exactly once; replaying the link reuses it (idempotent, no duplicate). [#164]
- T13 — Recipient picks an EXISTING Organization → Owner verification gate renders; non-Owner cannot complete. [#164, #173]
- T14 — Completed flow grants NO Hosting membership anywhere. [#164]
- T15 — `Neuer Link` adds an additional link; old links stay alive; closing one link leaves siblings working. [#181]

## 4. Participant onboarding (both paths, same result)

- T16 — Known email: P (or H) triggers invitation → T signs in → profile → agreement → Membership (`participant`) plus Participation. [#165]
- T17 — Unknown email: T opens reusable Registration Link → same onboarding → identical resulting state (role, Participation, dashboard). [#165]
- T18 — Same User joins the same Project via a second Partner Organization → blocked with clear error. [#165]
- T19 — Already a plain org member joining → gains `participant`, keeps `member`; owner/admin keep their roles untouched. [#165]
- T20 — Stale agreement version → Participant actions blocked until re-accepted; earlier acceptances preserved in history. [#165]
- T21 — Registration link close/reopen before submission works; closed link rejects. [#165]
- T22 — Invitation reissue retires the old identity; exactly one live invitation per email; revoked links reject. [#181]
- T23 — Invitation email arrives (needs SMTP sink); reissue re-sends the new identity only. [#182]

## 5. Participant coordination (Group Organizer surface)

- T24 — P sees ONLY their Partnership's Participations with per-person onboarding state (joined vs invitation-pending). [#166, #175, #185]
- T25 — P creates a Participation for an onboarded User; update and pre-Claim removal work. [#166]
- T26 — Duplicate identity (same User or normalized email, incl. case variants) → merge-review task, never a silent duplicate. [#166, #186]
- T27 — Review tasks: open → assigned (self) → resolved with survivor decision; cross-Partnership assignment denied. [#186]
- T28 — F (foreign partnership) reads/writes P's Participations → denied server-side; nothing renders. [#166, #179]
- T29 — T sees only their own Participation; Participants create/edit nothing financial. [#166, #179]

## 6. Participant Journeys (one per Participation)

- T30 — P records a journey (origin, destination, one-way/round-trip, Erasmus calculator distance); missing fields reported item by item. [#168]
- T31 — Second journey for the same Participation → rejected. [#168]
- T32 — First journey freezes the Project funding snapshot (verify: band values match current config at save time). [#168, ADR-0007]
- T33 — Saved journey renders read-only; no edit affordance (update lives only in correction flow, see T46). [#176, #187]

## 7. Travel costs, allocations, documents

- T34 — Cost entry: one transport choice, one exact EUR total; zero/negative/ missing rejected with field-mapped errors. [#169]
- T35 — Equal split across three people: server derives shares summing exactly to the total at read time (thirds check). [#169]
- T36 — Percentage shares must total exactly 100; amount shares exactly the entry total; mixed methods rejected. [#169]
- T37 — Upload receipt (progress visible) → stable reference → link to entry; Claim-scoped document picker lists only this Claim's documents. [#163, #169, #176]
- T38 — Cross-Partnership allocation attempt → server-side denial. [#169]
- T39 — Covered Participants derive from allocations (no copies); group cost keeps one real total. [#169, ADR-0006]
- T40 — Empty payout-account list shows contact-admin instruction (no bank detail creation in-app). [#176]

## 8. Claim draft and payout selection

- T41 — Opening the workspace persists NOTHING (zero Claim rows). [#167]
- T42 — First save creates exactly one editable Claim; double-save reuses it (no duplicates). [#167]
- T43 — Creation without selected Payout Account → clear rejection; select by reference, reusable across Partnerships. [#167]
- T44 — Payout selection changeable while editable. [#167]

## 9. Submission (seven-point checklist + derived payable)

- T45 — Checklist renders item by item (payout, entries, allocations, documents, coverage, journeys, rules); each gap links to its fix; submit disabled until all pass. [#170, #177]
- T46 — Payable displays as calculated (never editable); verify it equals min(approved costs, summed entitlements) on a mixed standard/green example. [#170]
- T47 — Submit confirms the lock consequence; post-submit workspace is read-only; history records submission with actor/time. [#170]
- T48 — Transport choice removed from live config after freeze still submits (snapshot governs); choice absent from snapshot fails itemized. [#170]

## 10. Host review loop

- T49 — H sees the submitted queue; single-request view shows costs, evidence, journeys, payable; reasons render on both sides. [#171, #178]
- T50 — Correction request (reason required) unlocks Partner editing; P sees reason plus required actions; P corrects and resubmits (relocks); journey correction works in this window. [#171, #187]
- T51 — Approval confirms payable, locks permanently; approval of incomplete Claims impossible. [#171]
- T52 — Rejection (reason required) locks and bars payment; stays readable with history. [#171]
- T53 — Reopen unpaid rejection (authorized roles only) returns to Hosting review WITHOUT unlocking Partner edits; reopen-while-paid and unauthorized reopen rejected. [#171]
- T54 — Role matrix spot-checks: Participant decides nothing; F decides nothing outside their Partnership; fallback member decides nothing. [#179]

## 11. Payment and correction

- T55 — Approved-unpaid vs paid states unmistakably distinct; mark paid only after one full transfer equal to the approved amount (partial/mismatch rejected). [#172, #178]
- T56 — Paid-flag correction (reason required) restores unpaid; BOTH events stay in history (record correction, not a bank reversal). [#172]
- T57 — Post-approval payout changes rejected. [#172]
- T58 — Second mark-paid on a paid Claim: single paid event, deterministic outcome, no duplication. [#172]

## 12. History, readiness, completion

- T59 — Claim history shows every transition with actor, time, reason where applicable, append-only. [#153 story 23-24]
- T60 — Project readiness derives per-Partnership states (active, correction, approved-unpaid, paid, rejected) without blocking unrelated Partnerships. [#180]
- T61 — Completion with any non-terminal Claim or claimless Partnership → rejected NAMING the blockers. [#180]
- T62 — All-paid-or-rejected Project completes; unauthorized completion denied. [#180]
- T63 — OPEN PRODUCT QUESTION: zero-Partnership project completes vacuously today — confirm intended or file to block. [#180]

## 13. Abuse and isolation sweep

- T64 — Participant attempts every write endpoint (draft, journey, cost, submit, review, payment) → all denied. [#179]
- T65 — Partner coordinator operates outside their Partnership → denied everywhere. [#179]
- T66 — Double-submit, double-decision, double-payment under retry → single rows, single history events. [#179]
- T67 — Stale/expired/revoked/forged links and invitations → clean denials, zero writes. [#165, #181]
- T68 — Payout change post-approval, edits post-submit/approval/rejection, payment on unapproved/rejected → all fail, state unchanged. [#179]

## 14. UI wording and states

- T69 — Link surfaces use exactly Kopieren / Neuer Link / Schließen; no secret/hash terminology anywhere. [#181]
- T70 — Hosting scope says Project Coordinator, Partner scope says Group Organizer. [Glossary 66393b5]
- T71 — Derived values marked computed; payable never editable; approved vs paid visually distinct. [#176-#178]
- T72 — PENDING agreement renders "not yet available" (join disabled with reason), never placeholder-as-consent. [#174]

## 15. Browser, session, and infrastructure edge cases

- T73 — Double-click Submit (and every decisive button): rapid double activation yields one Claim, one history event, no duplicate. [#179]
- T74 — Deep-link the claim workspace URL directly (no navigation): loads correctly scoped or denies; Reload mid-draft preserves server-saved slices. [#176]
- T75 — Back button after submit: no resubmission, no editable resurrection; Forward returns to the locked view. [#170]
- T76 — Second Hosting reviewer (different admin) sees the same queue and history; decisions by either are attributed correctly. [#171]
- T77 — Multi-Partnership project: progress one Partnership to paid while another sits editable; readiness shows both states without cross-blocking. [#180]
- T78 — Run the Garage smoke script (`test:garage-storage`) and confirm round-trip plus cleanup; note orphan policy if objects remain. [#163]
- T79 — Verify migration state on the dev database (journal through `0026`, no pending). [ops]
- T80 — Sign out mid-onboarding, sign back in: progress (profile, invitation, bridge) resumes where left; no duplicate Membership. [#165]
- T81 — Invitation expiry cannot be waited out (48h/7d) — document as untestable manually; expiry logic stays covered by automated tests. [#164]
- T82 — Two browsers (org-less recipient vs coordinator) side by side: no session bleed, no cross-visible data. [#179]

## Sign-off

Record date, tester, environment, and per-case pass/fail with issue links for failures. Failing cases become GitHub issues; this file gains their numbers. Coverage claim: T01–T82 span every ticket `#161`–`#183`, `#185`–`#187`, every ADR `0004`–`0011`, and clickdummy outcomes `CD-02`–`CD-11`.
