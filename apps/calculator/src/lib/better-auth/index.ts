import { db } from "@greendex/database";
import * as schema from "@greendex/database/schema";
import { member } from "@greendex/database/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  lastLoginMethod,
  magicLink,
  organization as organizationPlugin,
} from "better-auth/plugins";
import { desc, eq } from "drizzle-orm";
import { after } from "next/server";

import { env } from "@/env";
import {
  ac,
  admin,
  member as memberRole,
  owner,
} from "@/features/projects/permissions";
import { emailSender } from "@/lib/email";

export const auth = betterAuth({
  appName: "Next WebSocket Server",
  baseURL: env.NEXT_PUBLIC_BASE_URL,

  experimental: {
    joins: true,
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Must be true to block login until verified
    sendResetPassword: async ({ user, url }) => {
      await emailSender.sendPasswordResetEmail({
        user,
        url,
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true, // This triggers email verification on signup
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
  session: {
    cookieCache: {
      enabled: false,
      // maxAge: 60, // 1 minute
    },
    additionalFields: {
      activeProjectId: {
        type: "string",
        required: false,
      },
    },
  },
  user: {
    // No additional fields - country is stored in project_participant table
  },
  plugins: [
    organizationPlugin({
      ac,
      roles: {
        owner,
        admin,
        member: memberRole,
      },
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
    }),
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
    nextCookies(),
  ],

  databaseHooks: {
    session: {
      create: {
        before: async (userSession) => {
          const membership = await db.query.member.findFirst({
            where: eq(member.userId, userSession.userId),
            // always get the most recent organization membership
            orderBy: desc(member.createdAt),
            columns: {
              organizationId: true,
            },
          });

          return {
            data: {
              ...userSession,
              activeOrganizationId: membership?.organizationId,
            },
          };
        },
      },

      update: {
        before: (session, _context) => {
          // console.log("=== SESSION UPDATE HOOK CALLED ===");
          // console.log(
          //   "Incoming session object:",
          //   JSON.stringify(session, null, 2),
          // );
          // console.log("Session keys:", Object.keys(session));
          // console.log(
          //   "Has activeOrganizationId?",
          //   "activeOrganizationId" in session,
          // );
          // console.log(
          //   "activeOrganizationId value:",
          //   session.activeOrganizationId,
          // );
          // console.log("activeProjectId value:", session.activeProjectId);

          const result = {
            data: {
              ...session,
              activeProjectId: null,
            },
          };

          // console.log("Returning:", JSON.stringify(result, null, 2));
          // console.log("=== END HOOK ===");

          return Promise.resolve(result);
        },
      },
    },
  },
});
