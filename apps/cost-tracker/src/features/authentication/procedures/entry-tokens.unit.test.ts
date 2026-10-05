// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locked: { status: "pending", expiresAt: new Date(0) },
}));
vi.mock("server-only", () => ({}));
vi.mock("@greendex/database", () => ({ db: {} }));
vi.mock("@/lib/orpc/middleware", () => ({ authorized: {} }));

import { ORPCError } from "@orpc/server";

import {
  recheckEntryToken,
  type EntryToken,
  type EntryTokenTransaction,
} from "@/features/authentication/procedures/entry-tokens";

const errors = {
  BAD_REQUEST: (options: object) => new ORPCError("BAD_REQUEST", options),
  NOT_FOUND: (options: object) => new ORPCError("NOT_FOUND", options),
} as Parameters<typeof recheckEntryToken>[1];
const token = {
  id: "token",
  partnershipId: "partnership",
  email: "person@example.org",
  status: "pending",
  expiresAt: new Date(Date.now() + 60_000),
} as EntryToken;
function transaction() {
  const query = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => [mocks.locked]),
  };
  return query as unknown as EntryTokenTransaction;
}

beforeEach(() => {
  mocks.locked = { status: "pending", expiresAt: new Date(0) };
});
describe("locked Entry Token recheck", () => {
  it("rejects an invitation that expires after initial resolution", async () => {
    await expect(
      recheckEntryToken(transaction(), errors, token),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPANT_INVITATION_EXPIRED" },
    });
  });
  it("preserves accepted invitation retries after expiry", async () => {
    mocks.locked.status = "accepted";
    await expect(
      recheckEntryToken(transaction(), errors, token),
    ).resolves.toBeUndefined();
  });
  it("leaves reusable links without an expiry gate", async () => {
    await expect(
      recheckEntryToken(transaction(), errors, { ...token, email: null }),
    ).resolves.toBeUndefined();
  });
});
