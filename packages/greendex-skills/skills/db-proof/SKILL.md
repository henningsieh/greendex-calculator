---
name: db-proof
description: Verify the shared-database merge proof for Calculator and Cost Tracker (wipe, migrate, seed, both apps show same Project).
---

# DB merge proof

Use this when checking the Calculator + Cost Tracker shared-database merge.

1. Read `docs/database/merge-proof.md` as source of truth (mock dev data only, never prod).
2. Verify the canonical chain: `pnpm run db:migrate` is a clean no-op after seeding, 36 migrations applied.
3. Verify both apps boot against the same `DATABASE_URL` and show the same Hosting Organization + Project ID (Calculator Project Participants tab shows the Paris → Berlin Journey, Cost Tracker Claim workspace shows same Journey + EUR 120 train entry).

Keep it thin: this skill routes, `merge-proof.md` carries the detail.
