import { createServerAuth } from "@greendex/auth";
import { lastLoginMethod, magicLink } from "better-auth/plugins";
import { after } from "next/server";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = createServerAuth({
  appName: "Next WebSocket Server",
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  experimental: {
    joins: true,
  },
  emailSender,
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: false,
    sendVerificationEmail: async ({ user, url }) => {
      after(async () => {
        try {
          await emailSender.sendEmailVerificationEmail({ user, url });
        } catch (error) {
          console.error("Failed to send verification email:", error);
        }
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  organization: {
    async sendInvitationEmail(data) {
      try {
        const inviteLink = `${env.NEXT_PUBLIC_BASE_URL}/accept-invitation/${data.id}`;
        await emailSender.sendOrganizationInvitation({
          email: data.email,
          inviterName: data.inviter?.user?.name,
          inviteLink,
          organizationName: data.organization?.name,
        });
      } catch (error) {
        console.error("Failed to send organization invitation email:", error);
        throw error;
      }
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: ({ email, url }) =>
        emailSender.sendMagicLinkEmail({ email, url }),
    }),
    lastLoginMethod({
      customResolveMethod: (context) =>
        context.path === "/magic-link/verify" ? "magic-link" : null,
    }),
  ],
  session: {
    cookieCache: {
      enabled: false,
    },
    additionalFields: {
      activeProjectId: {
        type: "string",
        required: false,
      },
    },
  },
  sessionUpdate: {
    before: (session) =>
      Promise.resolve({
        data: {
          ...session,
          activeProjectId: null,
        },
      }),
  },
});
