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

## 1. Hosting setup

- T01 — H signs in, creates/selects the Hosting Organization. [#164]
- T02 — H invites a colleague as Organization Admin; colleague accepts and sees the org. [CD-02, #164]
- T03 — X (no membership) opening any protected page → access-denied surface, no data. [#179]

## 2. Partner setup link (org-less recipient flow)

- T04 — H creates a recipient-bound Setup Link for Project + email; copies it (`Kopieren`). [#164, #173]
- T05 — Recipient opens link signed out → guided to sign-in, link preserved for revisit after sign-in (no returnTo magic; manual revisit works). [#173]
- T06 — Wrong email signs in and redeems → distinct wrong-email error, no side effects. [#164]
- T07 — Disabled link → distinct disabled error. [#164]
- T08 — Recipient creates a NEW Organization → Partnership created exactly once; replaying the link reuses it (idempotent, no duplicate). [#164]
- T09 — Recipient picks an EXISTING Organization → Owner verification gate renders; non-Owner cannot complete. [#164, #173]
- T10 — Completed flow grants NO Hosting membership anywhere. [#164]
- T11 — `Neuer Link` adds an additional link; old links stay alive; closing one link leaves siblings working. [#181]

## 3. Participant onboarding (both paths, same result)

- T12 — Known email: P (or H) triggers invitation → T signs in → profile → agreement → Membership (`participant`) plus Participation. [#165]
- T13 — Unknown email: T opens reusable Registration Link → same onboarding → identical resulting state (role, Participation, dashboard). [#165]
- T14 — Same User joins the same Project via a second Partner Organization → blocked with clear error. [#165]
- T15 — Already a plain org member joining → gains `participant`, keeps `member`; owner/admin keep their roles untouched. [#165]
- T16 — Stale agreement version → Participant actions blocked until re-accepted; earlier acceptances preserved in history. [#165]
- T17 — Registration link close/reopen before submission works; closed link rejects. [#165]
- T18 — Invitation reissue retires the old identity; exactly one live invitation per email; revoked links reject. [#181]
- T19 — Invitation email arrives (needs SMTP sink); reissue re-sends the new identity only. [#182]

## 4. Participant coordination (Group Organizer surface)

- T20 — P sees ONLY their Partnership's Participations with per-person onboarding state (joined vs invitation-pending). [#166, #175, #185]
- T21 — P creates a Participation for an onboarded User; update and pre-Claim removal work. [#166]
- T22 — Duplicate identity (same User or normalized email, incl. case variants) → merge-review task, never a silent duplicate. [#166, #186]
- T23 — Review tasks: open → assigned (self) → resolved with survivor decision; cross-Partnership assignment denied. [#186]
- T24 — F (foreign partnership) reads/writes P's Participations → denied server-side; nothing renders. [#166, #179]
- T25 — T sees only their own Participation; Participants create/edit nothing financial. [#166, #179]

## 5. Participant Journeys (one per Participation)

- T26 — P records a journey (origin, destination, one-way/round-trip, Erasmus calculator distance); missing fields reported item by item. [#168]
- T27 — Second journey for the same Participation → rejected. [#168]
- T28 — First journey freezes the Project funding snapshot (verify: band values match current config at save time). [#168, ADR-0007]
- T29 — Saved journey renders read-only; no edit affordance (update lives only in correction flow, see T46). [#176, #187]

## 6. Travel costs, allocations, documents

- T30 — Cost entry: one transport choice, one exact EUR total; zero/negative/ missing rejected with field-mapped errors. [#169]
- T31 — Equal split across three people: server derives shares summing exactly to the total at read time (thirds check). [#169]
- T32 — Percentage shares must total exactly 100; amount shares exactly the entry total; mixed methods rejected. [#169]
- T33 — Upload receipt (progress visible) → stable reference → link to entry; Claim-scoped document picker lists only this Claim's documents. [#163, #169, #176]
- T34 — Cross-Partnership allocation attempt → server-side denial. [#169]
- T35 — Covered Participants derive from allocations (no copies); group cost keeps one real total. [#169, ADR-0006]
- T36 — Empty payout-account list shows contact-admin instruction (no bank detail creation in-app). [#176]

## 7. Claim draft and payout selection

- T37 — Opening the workspace persists NOTHING (zero Claim rows). [#167]
- T38 — First save creates exactly one editable Claim; double-save reuses it (no duplicates). [#167]
- T39 — Creation without selected Payout Account → clear rejection; select by reference, reusable across Partnerships. [#167]
- T40 — Payout selection changeable while editable. [#167]

## 8. Submission (seven-point checklist + derived payable)

- T41 — Checklist renders item by item (payout, entries, allocations, documents, coverage, journeys, rules); each gap links to its fix; submit disabled until all pass. [#170, #177]
- T42 — Payable displays as calculated (never editable); verify it equals min(approved costs, summed entitlements) on a mixed standard/green example. [#170]
- T43 — Submit confirms the lock consequence; post-submit workspace is read-only; history records submission with actor/time. [#170]
- T44 — Transport choice removed from live config after freeze still submits (snapshot governs); choice absent from snapshot fails itemized. [#170]

## 9. Host review loop

- T45 — H sees the submitted queue; single-request view shows costs, evidence, journeys, payable; reasons render on both sides. [#171, #178]
- T46 — Correction request (reason required) unlocks Partner editing; P sees reason plus required actions; P corrects and resubmits (relocks); journey correction works in this window. [#171, #187]
- T47 — Approval confirms payable, locks permanently; approval of incomplete Claims impossible. [#171]
- T48 — Rejection (reason required) locks and bars payment; stays readable with history. [#171]
- T49 — Reopen unpaid rejection (authorized roles only) returns to Hosting review WITHOUT unlocking Partner edits; reopen-while-paid and unauthorized reopen rejected. [#171]
- T50 — Role matrix spot-checks: Participant decides nothing; F decides nothing outside their Partnership; fallback member decides nothing. [#179]

## 10. Payment and correction

- T51 — Approved-unpaid vs paid states unmistakably distinct; mark paid only after one full transfer equal to the approved amount (partial/mismatch rejected). [#172, #178]
- T52 — Paid-flag correction (reason required) restores unpaid; BOTH events stay in history (record correction, not a bank reversal). [#172]
- T53 — Post-approval payout changes rejected. [#172]
- T54 — Second mark-paid on a paid Claim: single paid event, deterministic outcome, no duplication. [#172]

## 11. History, readiness, completion

- T55 — Claim history shows every transition with actor, time, reason where applicable, append-only. [#153 story 23-24]
- T56 — Project readiness derives per-Partnership states (active, correction, approved-unpaid, paid, rejected) without blocking unrelated Partnerships. [#180]
- T57 — Completion with any non-terminal Claim or claimless Partnership → rejected NAMING the blockers. [#180]
- T58 — All-paid-or-rejected Project completes; unauthorized completion denied. [#180]
- T59 — OPEN PRODUCT QUESTION: zero-Partnership project completes vacuously today — confirm intended or file to block. [#180]

## 12. Abuse and isolation sweep

- T60 — Participant attempts every write endpoint (draft, journey, cost, submit, review, payment) → all denied. [#179]
- T61 — Partner coordinator operates outside their Partnership → denied everywhere. [#179]
- T62 — Double-submit, double-decision, double-payment under retry → single rows, single history events. [#179]
- T63 — Stale/expired/revoked/forged links and invitations → clean denials, zero writes. [#165, #181]
- T64 — Payout change post-approval, edits post-submit/approval/rejection, payment on unapproved/rejected → all fail, state unchanged. [#179]

## 13. UI wording and states

- T65 — Link surfaces use exactly Kopieren / Neuer Link / Schließen; no secret/hash terminology anywhere. [#181]
- T66 — Hosting scope says Project Coordinator, Partner scope says Group Organizer. [Glossary 66393b5]
- T67 — Derived values marked computed; payable never editable; approved vs paid visually distinct. [#176-#178]
- T68 — PENDING agreement renders "not yet available" (join disabled with reason), never placeholder-as-consent. [#174]

## 14. Browser, session, and infrastructure edge cases

- T69 — Double-click Submit (and every decisive button): rapid double activation yields one Claim, one history event, no duplicate. [#179]
- T70 — Deep-link the claim workspace URL directly (no navigation): loads correctly scoped or denies; Reload mid-draft preserves server-saved slices. [#176]
- T71 — Back button after submit: no resubmission, no editable resurrection; Forward returns to the locked view. [#170]
- T72 — Second Hosting reviewer (different admin) sees the same queue and history; decisions by either are attributed correctly. [#171]
- T73 — Multi-Partnership project: progress one Partnership to paid while another sits editable; readiness shows both states without cross-blocking. [#180]
- T74 — Run the Garage smoke script (`test:garage-storage`) and confirm round-trip plus cleanup; note orphan policy if objects remain. [#163]
- T75 — Verify migration state on the dev database (journal through `0026`, no pending). [ops]
- T76 — Sign out mid-onboarding, sign back in: progress (profile, invitation, bridge) resumes where left; no duplicate Membership. [#165]
- T77 — Invitation expiry cannot be waited out (48h/7d) — document as untestable manually; expiry logic stays covered by automated tests. [#164]
- T78 — Two browsers (org-less recipient vs coordinator) side by side: no session bleed, no cross-visible data. [#179]

## Sign-off

Record date, tester, environment, and per-case pass/fail with issue links for failures. Failing cases become GitHub issues; this file gains their numbers. Coverage claim: T01–T78 span every ticket `#161`–`#183`, `#185`–`#187`, every ADR `0004`–`0011`, and clickdummy outcomes `CD-02`–`CD-11`.
