---
status: accepted
---

# Derive Refusal Construction From the Error Catalog, So One Refusal Costs One Edit

## Decision

**Adding a canonical refusal must cost one edit, not several.** Construction and validation of
a situation are derived from the catalog that defines it. A situation is declared once; the
transport-specific forms are generated from that declaration rather than written out by hand.

The safe seam is preserved exactly as it is. A refusal still carries a validated
`reason`/`code`/`status` triple before it may be shown, vendor messages stay masked, and both
adapter forms — thrown exception and returned Response — remain supported, because both are
exercised in production. Only the encoding is generated.

## Why

A canonical situation is currently encoded twice: once in the catalog, then again as a
hand-written reason enumeration and a near-duplicate constructor body in each module that
needs it. The result is `apps/cost-tracker/src/lib/orpc/errors.ts` and `error-contract.ts`
sitting inside a genuinely deep safe seam, wrapped in a shallow encoding layer that nothing
depends on.

This was not worth acting on while it was only tidying. It is now, because **this refactor
adds refusals.** Every authorization gap we close adds one: the participant-entry procedures
must refuse the Hosting Organization, the claim review queue must refuse rows its reader cannot
open, a Project Partnership removal must refuse a creator acting without delete authority, and
the staff shell gate must refuse a Membership with no active Organization. Each of those is a
new canonical refusal. Under hand-written encoding, each costs synchronized edits across
several modules that must stay in step; under catalog-derived construction, it costs one.

That also makes the current state a correctness risk rather than a smell: duplicated
reason/code/status lists drift, and a refusal whose duplicate has drifted is one the safe seam
can no longer vouch for.

## Consequences

- Hand-written constructor bodies and duplicated reason enumerations go, together with the
  tests that only assert the duplicated encoding stays in sync. Those tests proved a copy
  matched a copy.
- Contract snapshots and malicious-metadata tests at the interface are retained and become the
  real guarantee. The interface is the test surface.
- Generic Better Auth failures and privileged Membership failures stay **deliberately
  distinct**. Combining them would flatten a distinction that carries meaning.
- Source-scanning guardrails already in the repo are useful constraints but are not a substitute
  for tests at the error interface, and are not treated as such.
- This is encoding locality, not a reversal of the recent error-centralization work. That work
  built the safe seam; this ADR makes its encoding generated rather than transcribed.

## Related

ADR-0014 (permissions declared once and evaluated on the server — the same principle applied
to refusals: declared once, consumed everywhere).
