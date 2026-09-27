// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendParticipantInvitation: vi.fn().mockResolvedValue(undefined),
  sendOrganizationInvitation: vi.fn().mockResolvedValue(undefined),
  createServerAuth: vi.fn((config: unknown) => config),
}));
vi.mock("@greendex/auth", () => ({ createServerAuth: mocks.createServerAuth }));
vi.mock("@greendex/email", () => ({
  createTransporter: vi.fn(() => ({})),
  createEmailSender: vi.fn(() => ({
    sendParticipantInvitation: mocks.sendParticipantInvitation,
    sendOrganizationInvitation: mocks.sendOrganizationInvitation,
  })),
}));

import { auth } from "@/lib/auth";
import { sendParticipantInvitation } from "@/lib/email";

type InvitationCallback = (data: {
  id: string;
  role: string;
  email: string;
  inviter: { user: { name: string } };
  organization: { name: string };
}) => Promise<void>;

const sendInvitationEmail = (
  auth as unknown as {
    organization: { sendInvitationEmail: InvitationCallback };
  }
).organization.sendInvitationEmail;

beforeEach(() => vi.clearAllMocks());

describe("Cost Tracker invitation email routing", () => {
  it("builds the Participant Invitation accept URL with the issued identity", async () => {
    await sendParticipantInvitation({
      email: "recipient@example.com",
      invitationId: "invitation-182",
    });
    expect(mocks.sendParticipantInvitation).toHaveBeenCalledWith({
      email: "recipient@example.com",
      inviteLink: expect.stringMatching(
        /\/participant-invitations\/invitation-182$/,
      ),
    });
  });

  it("defers host Participant Invitations to the same post-bridge sender and preserves Organization Invitations", async () => {
    const data = {
      id: "invitation-182",
      role: "participant",
      email: "recipient@example.com",
      inviter: { user: { name: "Host" } },
      organization: { name: "Host Organization" },
    };
    await sendInvitationEmail(data);
    expect(mocks.sendParticipantInvitation).not.toHaveBeenCalled();
    expect(mocks.sendOrganizationInvitation).not.toHaveBeenCalled();
    await sendInvitationEmail({ ...data, role: "member" });
    expect(mocks.sendOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: data.email,
        organizationName: "Host Organization",
      }),
    );
  });
});
