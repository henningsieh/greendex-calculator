import { describe, expect, it } from "vitest";

import { normalizeClaimQueueState } from "@/features/claims/queue-query-options";

const base = {
  cursor: "",
  pageSize: 25 as const,
  partnerOrganizationId: null,
  search: "",
  sort: "submitted-asc" as const,
};

describe("normalizeClaimQueueState", () => {
  it("keeps one- and two-character search terms", () => {
    expect(normalizeClaimQueueState({ ...base, search: " A " }).search).toBe("a");
    expect(normalizeClaimQueueState({ ...base, search: "ab" }).search).toBe("ab");
  });

  it("drops whitespace-only search so the filter resets", () => {
    expect(normalizeClaimQueueState({ ...base, search: "   " }).search).toBe(
      undefined,
    );
  });
});
