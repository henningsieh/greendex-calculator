import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { organizationCountryFields } from "@greendex/config/organization-country";
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
  accessControl,
  costTrackerOrganizationRoles,
  calculatorOrganizationRoles,
  ORGANIZATION_ROLES,
  isValidOrganizationRole,
} from "./permissions";

type EmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
>;
type SessionDatabaseHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
>;

// P preserves each passed plugin's endpoint types into auth.api. A wide
// BetterAuthPlugin[] would erase custom server-only endpoints (such as the
// participant-membership grant) from the inferred API surface.
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
  advanced?: {
    database?: {
      joins?: boolean;
    };
  };
  organization?: Pick<OrganizationOptions, "sendInvitationEmail">;
  organizationHooks?: Omit<
    NonNullable<OrganizationOptions["organizationHooks"]>,
    "beforeCreateOrganization"
  >;
  costTrackerRoles?: boolean;
  plugins?: P;
  session?: BetterAuthOptions["session"];
  sessionUpdate?: SessionDatabaseHooks["update"];
}

/**
 * Creates the Greendex Better Auth server instance with shared organization,
 * email, social-login, and active-Organization behavior.
 */
export function createServerAuth<const P extends BetterAuthPlugin[]>(
  config: ServerAuthConfig<P>,
) {
  return betterAuth({
    appName: config.appName,
    baseURL: config.baseURL,
    secret: config.secret,
    advanced: config.advanced,
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
        roles: config.costTrackerRoles
          ? costTrackerOrganizationRoles
          : calculatorOrganizationRoles,
        ...config.organization,
        creatorRole: ORGANIZATION_ROLES.OrganizationOwner,
        schema: {
          organization: { additionalFields: organizationCountryFields },
          member: { additionalFields: { role: { type: "string", required: true, defaultValue: ORGANIZATION_ROLES.Participant } } },
        },
        allowUserToCreateOrganization: async (user) => {
          const membership = await db.query.member.findFirst({
            where: eq(member.userId, user.id),
            columns: { id: true },
          });

          return !membership;
        },
        organizationHooks: {
          ...config.organizationHooks,
          beforeCreateInvitation: async (data) => {
            requireOrganizationRole(data.invitation.role);
            return config.organizationHooks?.beforeCreateInvitation?.(data);
          },
          beforeAcceptInvitation: async (data) => {
            requireOrganizationRole(data.invitation.role);
            return config.organizationHooks?.beforeAcceptInvitation?.(data);
          },
          beforeAddMember: async (data) => {
            requireOrganizationRole(data.member.role);
            return config.organizationHooks?.beforeAddMember?.(data);
          },
          beforeUpdateMemberRole: async (data) => {
            requireOrganizationRole(data.newRole);
            return config.organizationHooks?.beforeUpdateMemberRole?.(data);
          },
          beforeUpdateOrganization: async (data) => {
            if ("country" in data.organization)
              requireOrganizationCountry(data.organization.country);
            return config.organizationHooks?.beforeUpdateOrganization?.(data);
          },
          beforeCreateOrganization: async ({ organization }) => {
            requireOrganizationCountry(organization.country);
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
      {
        id: "organization-role-validation",
        hooks: {
          before: [{
            matcher: (context) => context.path === "/organization/invite-member",
            handler: createAuthMiddleware(async (context) => {
              const role: unknown = context.body?.role;
              requireOrganizationRole(Array.isArray(role) ? role.join(",") : typeof role === "string" ? role : undefined);
            }),
          }],
        },
      },
      ...(config.plugins ?? []),
      // Cookie integration must stay last so hooks.after cookies from
      // preceding plugins are forwarded to the framework cookie store.
      nextCookies(),
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

/** Better Auth 1.7 maps enum additionalFields to z.any(), so validate before writes. */
function requireOrganizationCountry(country: unknown): void {
  if (typeof country !== "string" || !EU_COUNTRY_CODES.some((code) => code === country)) {
    throw new APIError("BAD_REQUEST", { message: "An EU Organization country is required." });
  }
}

function requireOrganizationRole(role: string | null | undefined): void {
  if (!isValidOrganizationRole(role)) {
    throw new APIError("BAD_REQUEST", { message: "Use a defined Organization role." });
  }
}
