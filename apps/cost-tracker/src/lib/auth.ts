import { organizationRoles, accessControl } from "@greendex/auth";
import { db } from "@greendex/database";
import * as schema from "@greendex/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { env } from "@/env";
import { emailSender } from "@/lib/email";

export const auth = betterAuth({
  appName: "Cost Tracker",
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: ({ user, url }) =>
      emailSender.sendPasswordResetEmail({ user, url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: ({ user, url }) =>
      emailSender.sendEmailVerificationEmail({ user, url }),
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization({ ac: accessControl, roles: organizationRoles }),
    nextCookies(),
  ],
  databaseHooks: {
    /**
     * Initializes every new session with the user's most recently created
     * Organization Membership. Cost Tracker uses `activeOrganizationId` as its
     * tenant boundary for Project and Partner Organization queries. This hook
     * only selects that default tenant; it never changes memberships, roles,
     * Projects, or other persisted domain data.
     */
    session: {
      create: {
        before: async (userSession) => {
          const membership = await db.query.member.findFirst({
            where: (membership, { eq }) =>
              eq(membership.userId, userSession.userId),
            orderBy: (membership, { desc }) => [desc(membership.createdAt)],
            columns: { organizationId: true },
          });

          return {
            data: {
              ...userSession,
              activeOrganizationId: membership?.organizationId,
            },
          };
        },
      },
    },
  },
});
