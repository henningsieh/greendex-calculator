// @vitest-environment node

import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  addMember: vi.fn(),
  acceptInvitation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      addMember: mocks.addMember,
      acceptInvitation: mocks.acceptInvitation,
    },
  },
}));
vi.mock("@greendex/database", () => ({
  db: {
    insert: mocks.insert,
  },
}));

import { createParticipantOnboardingProcedures } from "@/features/authentication/participant-onboarding";

function client(version?: { id: string; contentHash: string }) {
  return createRouterClient(
    {
      participantOnboarding: createParticipantOnboardingProcedures(
        version ? () => version : undefined,
      ),
    },
    {
      context: async () => ({ headers: new Headers() }),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "user-1", email: "alice@example.com", emailVerified: true },
    session: { id: "session-1", activeOrganizationId: "host-1" },
  });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({
    onConflictDoNothing: mocks.onConflictDoNothing,
  });
  mocks.onConflictDoNothing.mockResolvedValue(undefined);
});

describe("participant onboarding agreement procedures", () => {
  it("refuses pending legal copy before writing any acceptance or membership", async () => {
    await expect(
      client().participantOnboarding.acceptAgreement({ accepted: true }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Participant agreement is not yet available.",
    });
    await expect(
      client().participantOnboarding.join({
        profile: { fullName: "Alice" },
        agreement: { accepted: true },
        source: { kind: "link", id: "link-1", secret: "secret" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.addMember).not.toHaveBeenCalled();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("preserves accepted versions as separate append-only records when the current version changes", async () => {
    await expect(
      client({
        id: "fixture-v1",
        contentHash: "hash-1",
      }).participantOnboarding.acceptAgreement({ accepted: true }),
    ).resolves.toEqual({ version: "fixture-v1" });
    await expect(
      client({
        id: "fixture-v2",
        contentHash: "hash-2",
      }).participantOnboarding.acceptAgreement({ accepted: true }),
    ).resolves.toEqual({ version: "fixture-v2" });
    expect(mocks.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        version: "fixture-v1",
        contentHash: "hash-1",
        userId: "user-1",
      }),
    );
    expect(mocks.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        version: "fixture-v2",
        contentHash: "hash-2",
        userId: "user-1",
      }),
    );
    expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(2);
  });
});
