import { z } from "zod";

import type { StaffOrganizationContext } from "@/features/organizations/staff-eligibility";
import { ErrorReasonSchema, type Situation } from "@/lib/orpc/error-contract";

const identifier = z.string().min(1).max(128);
const organization = z.object({ id: identifier, name: z.string() }).strict();
const organizations = z.array(organization);
const entryContext = z.enum([
  "direct",
  "organization-invitation",
  "partner-setup",
]);
const otherEntryContext = z.enum(["direct", "partner-setup"]);
const invitationDestination = z
  .string()
  .regex(/^\/accept-invitation\/[a-zA-Z0-9_-]{1,128}$/);
const invitationIdentity = z
  .object({ invitationId: identifier, organization })
  .strict();
const authEntry = z.enum(["register", "login"]);
const invitationAuthenticate = z
  .object({
    kind: z.literal("authenticate"),
    entry: authEntry,
    returnTo: invitationDestination,
  })
  .strict();
const invitationSignOut = z
  .object({ kind: z.literal("sign-out"), destination: z.string() })
  .strict();
const resendVerification = z
  .object({
    kind: z.literal("resend-verification"),
    email: z.email(),
    callbackURL: invitationDestination,
  })
  .strict();
const signOut = z.object({ kind: z.literal("sign-out") }).strict();
const create = z.object({ kind: z.literal("create-organization") }).strict();
const chooseOwned = z
  .object({ kind: z.literal("choose-owned-organization"), organizations })
  .strict();
const recheck = z.object({ kind: z.literal("recheck") }).strict();

export const OnboardingInputSchema = z
  .object({
    returnTo: z.string().max(2048).optional(),
    authEntry: authEntry.optional(),
    setupRecovery: z
      .discriminatedUnion("phase", [
        z.object({ phase: z.literal("creating") }).strict(),
        z
          .object({
            phase: z.enum(["created", "selected"]),
            organizationId: identifier,
          })
          .strict(),
      ])
      .optional(),
  })
  .strict();
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const OnboardingDecisionSchema = z.union([
  z
    .object({
      entryContext: otherEntryContext,
      nextStep: z.literal("resolve-invitation"),
      invitation: invitationIdentity,
      returnTo: z.string(),
      availableActions: z.tuple([
        z
          .object({
            kind: z.literal("accept-invitation"),
            invitationId: identifier,
          })
          .strict(),
        z
          .object({
            kind: z.literal("reject-invitation"),
            invitationId: identifier,
          })
          .strict(),
        recheck,
        signOut,
      ]),
    })
    .strict(),

  z
    .object({
      entryContext: z.literal("organization-invitation"),
      nextStep: z.literal("authenticate"),
      invitation: invitationIdentity.nullable(),
      availableActions: z.tuple([
        invitationAuthenticate,
        invitationAuthenticate,
        z
          .object({ kind: z.literal("google"), returnTo: invitationDestination })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("organization-invitation"),
      nextStep: z.literal("verify-email"),
      invitation: invitationIdentity,
      email: z.email(),
      availableActions: z.union([
        z.tuple([invitationSignOut, resendVerification]),
        z.tuple([invitationAuthenticate, resendVerification]),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: otherEntryContext,
      nextStep: z.literal("authenticate"),
      availableActions: z.tuple([
        z
          .object({
            kind: z.literal("authenticate"),
            returnTo: z.string().optional(),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: otherEntryContext,
      nextStep: z.literal("verify-email"),
      email: z.email(),
      availableActions: z.tuple([signOut]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("direct"),
      nextStep: z.literal("create-organization"),
      availableActions: z.tuple([create, signOut]),
    })
    .strict(),
  z
    .object({
      entryContext,
      nextStep: z.literal("select-organization"),
      availableActions: z.tuple([
        z
          .object({ kind: z.literal("select-organization"), organizations })
          .strict(),
        z.union([signOut, invitationSignOut]),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext,
      nextStep: z.literal("continue"),
      availableActions: z.tuple([
        z
          .object({ kind: z.literal("continue"), destination: z.string().min(1) })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("organization-invitation"),
      nextStep: z.literal("accept-invitation"),
      invitation: invitationIdentity,
      availableActions: z.tuple([
        z
          .object({
            kind: z.literal("accept-invitation"),
            invitationId: identifier,
          })
          .strict(),
        invitationSignOut,
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("organization-invitation"),
      nextStep: z.literal("invitation-recovery"),
      reason: ErrorReasonSchema,
      returnTo: z.string(),
      availableActions: z.union([
        z.tuple([recheck]),
        z.tuple([invitationAuthenticate, recheck]),
        z.tuple([invitationSignOut, recheck]),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("partner-setup"),
      nextStep: z.literal("choose-organization"),
      availableActions: z.union([
        z.tuple([create, signOut]),
        z.tuple([chooseOwned, signOut]),
        z.tuple([create, chooseOwned, signOut]),
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("partner-setup"),
      nextStep: z.literal("bind-partnership"),
      availableActions: z.tuple([
        z
          .object({
            kind: z.literal("bind-partnership"),
            organizationId: identifier,
          })
          .strict(),
        signOut,
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("partner-setup"),
      nextStep: z.literal("setup-recovery"),
      reason: ErrorReasonSchema,
      availableActions: z.tuple([signOut, recheck]),
    })
    .strict(),
]);
export type OnboardingDecision = z.infer<typeof OnboardingDecisionSchema>;
type Organization = z.infer<typeof organization>;
type RecoveryReason = Situation["reason"];

export type ValidatedOnboardingEntry =
  | { kind: "direct" }
  | {
      kind: "organization-invitation";
      status: "pending";
      invitationId: string;
      organization: Organization;
    }
  | {
      kind: "organization-invitation";
      status: "complete";
      organization: Organization;
    }
  | {
      kind: "organization-invitation";
      status: "recovery";
      reason: RecoveryReason;
    }
  | {
      kind: "partner-setup";
      status: "choose";
      organizations: Organization[];
      canCreate: boolean;
    }
  | { kind: "partner-setup"; status: "bind"; organizationId: string }
  | {
      kind: "partner-setup";
      status: "complete";
      organization: Organization;
      destination: string;
    }
  | { kind: "partner-setup"; status: "recovery"; reason: RecoveryReason };

export type OnboardingFacts =
  | {
      account: "signed-out";
      entryContext: "direct" | "partner-setup";
      returnTo?: string;
    }
  | {
      account: "unverified";
      entryContext: "direct" | "partner-setup";
      email: string;
    }
  | {
      account: "signed-out" | "unverified" | "verification-requested";
      entryContext: "organization-invitation";
      entry: Extract<
        ValidatedOnboardingEntry,
        { kind: "organization-invitation"; status: "pending" | "recovery" }
      >;
      authEntry: "register" | "login";
      returnTo: string;
      email: string;
    }
  | {
      account: "verified";
      returnTo: string;
      organizationContext: StaffOrganizationContext;
      canCreate: boolean;
      blockingInvitation?: z.infer<typeof invitationIdentity>;
      entry: ValidatedOnboardingEntry;
    };

function invitationSignOutDestination(returnTo: string): string {
  return returnTo === "/accept-invitation"
    ? returnTo
    : `/register?next=${encodeURIComponent(returnTo)}`;
}

export function decideOnboarding(facts: OnboardingFacts): OnboardingDecision {
  if (facts.account !== "verified") {
    if (facts.entryContext === "organization-invitation") {
      const { entry, returnTo } = facts;
      const signOutAction = {
        kind: "sign-out" as const,
        destination: invitationSignOutDestination(returnTo),
      };
      if (entry.status === "recovery") {
        const canAuthenticate =
          facts.account !== "unverified" &&
          invitationDestination.safeParse(returnTo).success;
        if (canAuthenticate && facts.authEntry === "login")
          return {
            entryContext: "organization-invitation",
            nextStep: "authenticate",
            invitation: null,
            availableActions: [
              { kind: "authenticate", entry: "login", returnTo },
              { kind: "authenticate", entry: "register", returnTo },
              { kind: "google", returnTo },
            ],
          };
        return {
          entryContext: "organization-invitation",
          nextStep: "invitation-recovery",
          reason: entry.reason,
          returnTo,
          availableActions:
            facts.account === "unverified"
              ? [signOutAction, { kind: "recheck" }]
              : canAuthenticate
                ? [
                    { kind: "authenticate", entry: "login", returnTo },
                    { kind: "recheck" },
                  ]
                : [{ kind: "recheck" }],
        };
      }
      const invitation = {
        invitationId: entry.invitationId,
        organization: entry.organization,
      };
      const login = {
        kind: "authenticate" as const,
        entry: "login" as const,
        returnTo,
      };
      if (facts.account !== "signed-out") {
        const resend = {
          kind: "resend-verification" as const,
          email: facts.email,
          callbackURL: returnTo,
        };
        return {
          entryContext: "organization-invitation",
          nextStep: "verify-email",
          invitation,
          email: facts.email,
          availableActions:
            facts.account === "unverified"
              ? [signOutAction, resend]
              : [login, resend],
        };
      }
      const register = {
        kind: "authenticate" as const,
        entry: "register" as const,
        returnTo,
      };
      return {
        entryContext: "organization-invitation",
        nextStep: "authenticate",
        invitation,
        availableActions:
          facts.authEntry === "login"
            ? [login, register, { kind: "google", returnTo }]
            : [register, login, { kind: "google", returnTo }],
      };
    }
    if (facts.account === "signed-out")
      return {
        entryContext: facts.entryContext,
        nextStep: "authenticate",
        availableActions: [
          {
            kind: "authenticate",
            ...(facts.returnTo ? { returnTo: facts.returnTo } : {}),
          },
        ],
      };
    return {
      entryContext: facts.entryContext,
      nextStep: "verify-email",
      email: facts.email,
      availableActions: [{ kind: "sign-out" }],
    };
  }
  const { entry, organizationContext } = facts;
  const entryContext = entry.kind;
  if (
    facts.blockingInvitation &&
    (entry.kind === "direct" ||
      (entry.kind === "partner-setup" &&
        entry.status === "choose" &&
        entry.organizations.length === 0))
  ) {
    return {
      entryContext: entry.kind,
      nextStep: "resolve-invitation",
      invitation: facts.blockingInvitation,
      returnTo: facts.returnTo,
      availableActions: [
        {
          kind: "accept-invitation",
          invitationId: facts.blockingInvitation.invitationId,
        },
        {
          kind: "reject-invitation",
          invitationId: facts.blockingInvitation.invitationId,
        },
        { kind: "recheck" },
        { kind: "sign-out" },
      ],
    };
  }

  if (entry.kind !== "direct") {
    if (entry.status === "recovery") {
      return entry.kind === "organization-invitation"
        ? {
            entryContext: entry.kind,
            nextStep: "invitation-recovery",
            reason: entry.reason,
            returnTo: facts.returnTo,
            availableActions: [
              {
                kind: "sign-out",
                destination: invitationSignOutDestination(facts.returnTo),
              },
              { kind: "recheck" },
            ],
          }
        : {
            entryContext: entry.kind,
            nextStep: "setup-recovery",
            reason: entry.reason,
            availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
          };
    }
    if (entry.status === "pending")
      return {
        entryContext: entry.kind,
        nextStep: "accept-invitation",
        invitation: {
          invitationId: entry.invitationId,
          organization: entry.organization,
        },
        availableActions: [
          { kind: "accept-invitation", invitationId: entry.invitationId },
          {
            kind: "sign-out",
            destination: invitationSignOutDestination(facts.returnTo),
          },
        ],
      };
    if (entry.status === "choose") {
      const choose = {
        kind: "choose-owned-organization" as const,
        organizations: entry.organizations,
      };
      return {
        entryContext: entry.kind,
        nextStep: "choose-organization",
        availableActions: entry.canCreate
          ? entry.organizations.length
            ? [{ kind: "create-organization" }, choose, { kind: "sign-out" }]
            : [{ kind: "create-organization" }, { kind: "sign-out" }]
          : [choose, { kind: "sign-out" }],
      };
    }
    if (entry.status === "bind")
      return {
        entryContext: entry.kind,
        nextStep: "bind-partnership",
        availableActions: [
          { kind: "bind-partnership", organizationId: entry.organizationId },
          { kind: "sign-out" },
        ],
      };
    if (
      organizationContext.status !== "ready" ||
      organizationContext.activeOrganizationId !== entry.organization.id
    )
      return {
        entryContext,
        nextStep: "select-organization",
        availableActions: [
          { kind: "select-organization", organizations: [entry.organization] },
          entry.kind === "organization-invitation"
            ? {
                kind: "sign-out",
                destination: invitationSignOutDestination(facts.returnTo),
              }
            : { kind: "sign-out" },
        ],
      };
    return {
      entryContext,
      nextStep: "continue",
      availableActions: [
        {
          kind: "continue",
          destination:
            entry.kind === "partner-setup" ? entry.destination : "/projects",
        },
      ],
    };
  }
  if (organizationContext.status === "no-membership" && facts.canCreate)
    return {
      entryContext: "direct",
      nextStep: "create-organization",
      availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    };
  if (organizationContext.status !== "ready")
    return {
      entryContext,
      nextStep: "select-organization",
      availableActions: [
        {
          kind: "select-organization",
          organizations:
            organizationContext.status === "select"
              ? organizationContext.memberships.map(({ id, name }) => ({
                  id,
                  name,
                }))
              : [],
        },
        { kind: "sign-out" },
      ],
    };
  return {
    entryContext,
    nextStep: "continue",
    availableActions: [{ kind: "continue", destination: "/projects" }],
  };
}

export function onboardingReturnTo(
  value: string | string[] | undefined,
): string | undefined {
  const values = Array.isArray(value) ? value : [value];
  const invitation = values.some(
    (item) =>
      item === "/accept-invitation" || item?.startsWith("/accept-invitation/"),
  );
  if (typeof value === "string" && value.length <= 2048) return value;
  return invitation ? "/accept-invitation" : undefined;
}
