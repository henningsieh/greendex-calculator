import { isCuid } from "@paralleldrive/cuid2";
import { expect, it } from "vitest";

import { SEED_CLAIM_REVIEW_IDS } from "../../../scripts/seed-claim-review-ids";

it("uses unique valid CUID2 identities for the canonical Claim review entities", () => {
  const ids = Object.values(SEED_CLAIM_REVIEW_IDS);
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every((id) => isCuid(id))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
});
