import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { type FeatureFlags, resolveFlags } from "@greendex/config/feature-flags";
import { organizationAdditionalFields } from "@greendex/config/organization-country";
import { db } from "@greendex/database";
import {
  member,
  organization as organizationTable,
} from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import type { EmailSender } from "@greendex/email";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { desc, eq, ilike } from "drizzle-orm";

import {
  isValidOrganizationRole,
  ORGANIZATION_ROLES,
} from "./organization-roles";
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
    "beforeCreateOrganization"
  >;
  /** Centralized feature flags. Every flag defaults to off (safe). */
  flags?: Partial<FeatureFlags>;
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
  const flags = resolveFlags(config.flags);

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
          member: {
            additionalFields: {
              role: {
                type: "string",
                required: true,
                defaultValue: ORGANIZATION_ROLES.Participant,
                // Preserve Better Auth's native string-or-array endpoint role schema.
                input: false,
              },
            },
          },
        },
        allowUserToCreateOrganization: flags.singleOrganization
          ? async (user) => {
              const membership = await db.query.member.findFirst({
                where: eq(member.userId, user.id),
                columns: { id: true },
              });

              return !membership;
            }
          : undefined,
        organizationHooks: {
          ...config.organizationHooks,
          beforeCreateInvitation: async (data) => {
            requireOrganizationRole(data.invitation.role);
          },
          beforeAcceptInvitation: async (data) => {
            requireOrganizationRole(data.invitation.role);
          },
          beforeAddMember: async (data) => {
            requireOrganizationRole(data.member.role);
          },
          beforeUpdateMemberRole: async (data) => {
            requireOrganizationRole(data.newRole);
          },
          beforeCreateOrganization: async ({ organization }) => {
            requireOrganizationCountry(organization.country);
            await requireUniqueOrganizationName(organization.name);
          },
          beforeUpdateOrganization: async ({ organization }) => {
            if ("country" in organization)
              requireOrganizationCountry(organization.country);
          },
        },
      }),
      {
        id: "organization-role-validation",
        hooks: {
          before: [
            {
              matcher: (context) =>
                context.path === "/organization/invite-member",
              handler: createAuthMiddleware(async (context) => {
                const role: unknown = context.body?.role;
                requireOrganizationRole(
                  Array.isArray(role)
                    ? role.join(",")
                    : typeof role === "string"
                      ? role
                      : undefined,
                );
              }),
            },
          ],
        },
      },
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

/** Better Auth 1.7 maps enum additionalFields to z.any(), so validate before writes. */
function requireOrganizationCountry(country: unknown): void {
  if (
    typeof country !== "string" ||
    !EU_COUNTRY_CODES.some((code) => code === country)
  ) {
    throw new APIError("BAD_REQUEST", {
      message: "An EU organization country is required",
    });
  }
}

/** Organization names stay unique (case-insensitive). */
async function requireUniqueOrganizationName(name: unknown): Promise<void> {
  if (typeof name !== "string" || name.length === 0) return;

  const existingOrganization = await db.query.organization.findFirst({
    where: ilike(organizationTable.name, name),
    columns: { id: true },
  });

  if (existingOrganization) {
    throw new APIError("BAD_REQUEST", {
      message: "Choose a different Organization name.",
    });
  }
}

function requireOrganizationRole(role: string | null | undefined): void {
  if (!isValidOrganizationRole(role)) {
    throw new APIError("BAD_REQUEST", {
      message: "Use a defined Organization role.",
    });
  }
}
