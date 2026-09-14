import { db } from "@greendex/database";
import {
  member,
  organization as organizationTable,
} from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import type { EmailSender } from "@greendex/email";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { desc, eq, ilike } from "drizzle-orm";

import { accessControl, organizationRoles } from "./permissions";

type EmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
>;
type SessionDatabaseHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
>;

export interface ServerAuthConfig {
  appName: string;
  baseURL: string;
  secret: string;
  socialProviders: {
    google: {
      clientId: string;
      clientSecret: string;
    };
    discord?: {
      clientId: string;
      clientSecret: string;
    };
    github?: {
      clientId: string;
      clientSecret: string;
    };
  };
  emailSender: Pick<
    EmailSender,
    "sendEmailVerificationEmail" | "sendPasswordResetEmail"
  >;
  emailVerification?: Omit<EmailVerificationOptions, "sendOnSignUp">;
  experimental?: {
    joins?: boolean;
  };
  organization?: Pick<OrganizationOptions, "sendInvitationEmail">;
  plugins?: BetterAuthPlugin[];
  session?: BetterAuthOptions["session"];
  sessionUpdate?: SessionDatabaseHooks["update"];
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
    experimental: config.experimental,
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
      ...config.emailVerification,
    },
    socialProviders: config.socialProviders,
    plugins: [
      organization({
        ac: accessControl,
        roles: organizationRoles,
        ...config.organization,
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
      ...(config.plugins ?? []),
    ],
    session: config.session,
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
        ...(config.sessionUpdate ? { update: config.sessionUpdate } : {}),
      },
    },
  });
}
