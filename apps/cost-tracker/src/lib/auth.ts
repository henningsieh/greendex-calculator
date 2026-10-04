import { createServerAuth } from "@greendex/auth";

import { env } from "@/env";
import { participantMembershipGrantPlugin } from "@/features/organizations/participant-membership-grant";
import {
  costTrackerOrganizationHooks,
  costTrackerInvitationRoleGate,
} from "@/features/organizations/roles";
import { emailSender } from "@/lib/email";

export const auth = createServerAuth({
  appName: "Cost Tracker",
  costTrackerRoles: true,
  organizationHooks: costTrackerOrganizationHooks,
  plugins: [costTrackerInvitationRoleGate, participantMembershipGrantPlugin],
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  emailSender,
  organization: {
    async sendInvitationEmail(data) {
      // Participant entry never flows through Better Auth invitations
      // (ADR-0013): the app-owned email-bound invitation delivers its own
      // secret-bound link after durable issuance, so Better Auth sends no
      // mail for the participant role.
      if (data.role === "participant") return;
      await emailSender.sendOrganizationInvitation({
        email: data.email,
        inviterName: data.inviter.user.name,
        inviteLink: `${env.NEXT_PUBLIC_BASE_URL}/accept-invitation/${data.id}`,
        organizationName: data.organization.name,
      });
    },
  },
});
