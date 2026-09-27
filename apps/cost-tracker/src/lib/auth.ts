import { createServerAuth } from "@greendex/auth";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = createServerAuth({
  appName: "Cost Tracker",
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
      // Participant Invitations are delivered by the onboarding procedure after
      // its Project Partnership bridge commits, just like native partner issuance.
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
