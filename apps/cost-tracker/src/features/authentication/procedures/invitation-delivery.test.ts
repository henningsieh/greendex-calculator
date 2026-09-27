// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@greendex/database", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/email", () => ({ sendParticipantInvitation: vi.fn() }));

import { deliverParticipantInvitation } from "@/features/authentication/procedures/invitation-delivery";

beforeEach(() => vi.clearAllMocks());

describe("deliverParticipantInvitation", () => {
  it("logs a hashed invitation identifier without error content", async () => {
    const invitationId = "12345678-secret-invitation-bearer";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.select.mockImplementation(() => {
      throw new TypeError("private SMTP details");
    });
    try {
      await expect(
        deliverParticipantInvitation("participant@example.com", invitationId),
      ).resolves.toEqual({ invitationId, delivery: "failed" });
      expect(errorLog).toHaveBeenCalledWith(
        "Participant Invitation email delivery failed.",
        { invitationIdHashPrefix: "782cd23d" },
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(invitationId);
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
        "participant@example.com",
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
        "private SMTP details",
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("TypeError");
    } finally {
      errorLog.mockRestore();
    }
  });

  it("never logs a short invitation bearer", async () => {
    const invitationId = "abc123";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.select.mockImplementation(() => {
      throw new Error("private SMTP details");
    });
    try {
      await expect(
        deliverParticipantInvitation("participant@example.com", invitationId),
      ).resolves.toEqual({ invitationId, delivery: "failed" });
      expect(errorLog).toHaveBeenCalledWith(
        "Participant Invitation email delivery failed.",
        { invitationIdHashPrefix: "6ca13d52" },
      );
      const loggedOutput = JSON.stringify(errorLog.mock.calls);
      expect(loggedOutput).not.toContain(invitationId);
      expect(loggedOutput).not.toContain("private SMTP details");
    } finally {
      errorLog.mockRestore();
    }
  });
});
