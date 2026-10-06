import { createServerAuth } from "@greendex/auth";
import { lastLoginMethod, magicLink } from "better-auth/plugins";
import { after } from "next/server";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = createServerAuth({
  appName: "Next WebSocket Server",
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailSender,
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: false, // Don't send on every sign-in, only on signup
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
      } catch (err) {
        console.error("Failed to send organization invitation email:", err);
        throw err;
      }
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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await emailSender.sendMagicLinkEmail({ email, url });
      },
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => {
        // Track magic link authentication
        if (ctx.path === "/magic-link/verify") {
          return "magic-link";
        }
        // Return null to use default logic
        return null;
      },
    }),
  ],
});
