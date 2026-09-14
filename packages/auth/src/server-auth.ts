import { db } from "@greendex/database";
import {
  member,
  organization as organizationTable,
} from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import type { EmailSender } from "@greendex/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { desc, eq, ilike } from "drizzle-orm";

import { accessControl, organizationRoles } from "./permissions";

export interface ServerAuthConfig {
  appName: string;
  baseURL: string;
  secret: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  emailSender: Pick<
    EmailSender,
    "sendEmailVerificationEmail" | "sendPasswordResetEmail"
  >;
}

/**
 * Creates the Greendex Better Auth server instance with shared organization,
 * email, social-login, and active-Organization behavior.
 */
export function createServerAuth(config: ServerAuthConfig) {
  return betterAuth({
    appName: config.appName,
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) =>
        config.emailSender.sendPasswordResetEmail({ user, url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: ({ user, url }) =>
        config.emailSender.sendEmailVerificationEmail({ user, url }),
    },
    socialProviders: {
      google: config.google,
    },
    plugins: [
      organization({
        ac: accessControl,
        roles: organizationRoles,
        allowUserToCreateOrganization: async (user) => {
          const membership = await db.query.member.findFirst({
            where: eq(member.userId, user.id),
            columns: { id: true },
          });

          return !membership;
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            const organizationName = organization.name;
            if (!organizationName) {
              throw new APIError("BAD_REQUEST", {
                message: "Organization name is required.",
              });
            }

            const existingOrganization = await db.query.organization.findFirst({
              where: ilike(organizationTable.name, organizationName),
              columns: { id: true },
            });

            if (existingOrganization) {
              throw new APIError("BAD_REQUEST", {
                message: "Choose a different Organization name.",
              });
            }

            return { data: organization };
          },
        },
      }),
      nextCookies(),
    ],
    databaseHooks: {
      /**
       * Initializes a session with the User's most recently created Organization
       * Membership. This only selects the default tenant; it never changes
       * Memberships, roles, Projects, or other persisted domain data.
       */
      session: {
        create: {
          before: async (userSession) => {
            const membership = await db.query.member.findFirst({
              where: eq(member.userId, userSession.userId),
              orderBy: desc(member.createdAt),
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
}
