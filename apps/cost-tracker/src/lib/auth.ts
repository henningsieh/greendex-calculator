import { createServerAuth } from "@greendex/auth";
import { localE2EAuthEnabled } from "@greendex/auth/local-e2e-auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";

import { env } from "@/env";
import { participantMembershipGrantPlugin } from "@/features/organizations/participant-membership-grant";
import {
  costTrackerOrganizationHooks,
  costTrackerInvitationRoleGate,
} from "@/features/organizations/roles";
import { emailSender } from "@/lib/email";

export const costTrackerAuthFlags = { singleOrganization: true };

export const auth = createServerAuth({
  appName: "Cost Tracker",
  flags: costTrackerAuthFlags,
  roleSet: "costTracker",
  organizationHooks: costTrackerOrganizationHooks,
  plugins: [costTrackerInvitationRoleGate, participantMembershipGrantPlugin],
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  localE2EAuth: localE2EAuthEnabled(env),
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  emailSender,
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  organization: {
    requireEmailVerificationOnInvitation: true,
    async sendInvitationEmail(data) {
      // Participant entry never flows through Better Auth invitations
      // (ADR-0013): the app-owned email-bound invitation delivers its own
      // secret-bound link after durable issuance, so Better Auth sends no
      // mail for the participant role.
      if (data.role === ORGANIZATION_ROLES.Participant) return;
      await emailSender.sendOrganizationInvitation({
        email: data.email,
        inviterName: data.inviter.user.name,
        inviteLink: `${env.NEXT_PUBLIC_BASE_URL}/accept-invitation/${data.id}`,
        organizationName: data.organization.name,
      });
    },
  },
});
