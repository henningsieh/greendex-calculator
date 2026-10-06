import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { organizationAdditionalFields } from "@greendex/config/organization-country";
import { db } from "@greendex/database";
import { member } from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import type { EmailSender } from "@greendex/email";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { desc, eq } from "drizzle-orm";

import { accessControl, calculatorRoles } from "./permissions";

type EmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
>;
type SessionDatabaseHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
>;

// P preserves each passed plugin's endpoint types into auth.api. A wide
// BetterAuthPlugin[] would erase custom server-only endpoints from the
// inferred API surface.
export interface ServerAuthConfig<
  P extends BetterAuthPlugin[] = BetterAuthPlugin[],
> {
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
  organization?: Pick<OrganizationOptions, "sendInvitationEmail">;
  organizationHooks?: Omit<
    NonNullable<OrganizationOptions["organizationHooks"]>,
    "beforeCreateOrganization" | "beforeUpdateOrganization"
  >;
  plugins?: P;
  session?: BetterAuthOptions["session"];
  sessionUpdate?: SessionDatabaseHooks["update"];
}

/**
 * Creates the Greendex Better Auth server instance with shared organization,
 * email, social-login, and active-organization behavior.
 *
 * One home for auth logic. Each app calls this with its own env values,
 * email sender, and extra plugins. Same pattern for Calculator and
 * Cost Tracker.
 */
export function createServerAuth<const P extends BetterAuthPlugin[]>(
  config: ServerAuthConfig<P>,
) {
  return betterAuth({
    appName: config.appName,
    baseURL: config.baseURL,
    secret: config.secret,
    advanced: {
      database: {
        joins: true,
      },
    },
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
      ...config.session,
    },
    user: {},
    plugins: [
      organization({
        ac: accessControl,
        roles: calculatorRoles,
        ...config.organization,
        schema: {
          organization: { additionalFields: organizationAdditionalFields },
        },
        organizationHooks: {
          ...config.organizationHooks,
          beforeCreateOrganization: async ({ organization }) => {
            if (
              typeof organization.country !== "string" ||
              !EU_COUNTRY_CODES.some((code) => code === organization.country)
            ) {
              throw new APIError("BAD_REQUEST", {
                message: "An EU organization country is required",
              });
            }
          },
          beforeUpdateOrganization: async ({ organization }) => {
            if (
              "country" in organization &&
              (typeof organization.country !== "string" ||
                !EU_COUNTRY_CODES.some((code) => code === organization.country))
            ) {
              throw new APIError("BAD_REQUEST", {
                message: "Organization country must be an EU country",
              });
            }
          },
        },
      }),
      ...(config.plugins ?? []),
      // Cookie integration must stay last so hooks.after cookies from
      // preceding plugins are forwarded to the framework cookie store.
      nextCookies(),
    ],
    databaseHooks: {
      /**
       * Initializes a session with the user's most recently created
       * organization membership. This only selects the default tenant;
       * it never changes memberships, roles, or projects.
       */
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
        ...(config.sessionUpdate ? { update: config.sessionUpdate } : {}),
      },
    },
  });
}
