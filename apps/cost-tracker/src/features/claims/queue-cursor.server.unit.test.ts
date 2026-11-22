import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decodeClaimQueueCursor,
  encodeClaimQueueCursor,
  getClaimQueueFingerprint,
} from "@/features/claims/queue-cursor.server";

const input = {
  search: "partner",
  partnerOrganizationId: "partner-1",
  sort: "submitted-asc" as const,
  pageSize: 25 as const,
};

describe("Claim queue cursor", () => {
  it("seals the queue filters into a stable fingerprint", () => {
    const fingerprint = getClaimQueueFingerprint(input);

    expect(getClaimQueueFingerprint(input)).toBe(fingerprint);
    expect(
      getClaimQueueFingerprint({ ...input, partnerOrganizationId: "partner-2" }),
    ).not.toBe(fingerprint);
  });

  it("round-trips a cursor only for the same filter set", () => {
    const fingerprint = getClaimQueueFingerprint(input);
    const encoded = encodeClaimQueueCursor({
      version: 1,
      direction: "next",
      fingerprint,
      id: "partnership-1",
      value: "2026-11-20T00:00:00.000Z",
    });

    expect(decodeClaimQueueCursor(encoded, fingerprint)).toEqual({
      version: 1,
      direction: "next",
      fingerprint,
      id: "partnership-1",
      value: "2026-11-20T00:00:00.000Z",
    });
    expect(
      decodeClaimQueueCursor(
        encoded,
        getClaimQueueFingerprint({ ...input, sort: "submitted-desc" }),
      ),
    ).toBeNull();
  });

  it("rejects malformed cursors", () => {
    expect(decodeClaimQueueCursor("not-a-cursor", "x".repeat(64))).toBeNull();
  });
});
