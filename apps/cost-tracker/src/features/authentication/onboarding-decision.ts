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
const signOut = z.object({ kind: z.literal("sign-out") }).strict();
const create = z.object({ kind: z.literal("create-organization") }).strict();
const chooseOwned = z
  .object({ kind: z.literal("choose-owned-organization"), organizations })
  .strict();
const recheck = z.object({ kind: z.literal("recheck") }).strict();

export const OnboardingInputSchema = z
  .object({
    returnTo: z.string().max(2048).optional(),
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

export const OnboardingDecisionSchema = z.discriminatedUnion("nextStep", [
  z
    .object({
      entryContext,
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
      entryContext,
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
        signOut,
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
      availableActions: z.tuple([
        z
          .object({
            kind: z.literal("accept-invitation"),
            invitationId: identifier,
          })
          .strict(),
        signOut,
      ]),
    })
    .strict(),
  z
    .object({
      entryContext: z.literal("organization-invitation"),
      nextStep: z.literal("invitation-recovery"),
      reason: ErrorReasonSchema,
      availableActions: z.tuple([signOut, recheck]),
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
type EntryContext = z.infer<typeof entryContext>;
type RecoveryReason = Situation["reason"];

export type ValidatedOnboardingEntry =
  | { kind: "direct" }
  | { kind: "organization-invitation"; status: "pending"; invitationId: string }
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
  | { account: "signed-out"; entryContext: EntryContext; returnTo?: string }
  | { account: "unverified"; entryContext: EntryContext; email: string }
  | {
      account: "verified";
      organizationContext: StaffOrganizationContext;
      canCreate: boolean;
      entry: ValidatedOnboardingEntry;
    };

export function decideOnboarding(facts: OnboardingFacts): OnboardingDecision {
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
  if (facts.account === "unverified")
    return {
      entryContext: facts.entryContext,
      nextStep: "verify-email",
      email: facts.email,
      availableActions: [{ kind: "sign-out" }],
    };
  const { entry, organizationContext } = facts;
  const entryContext = entry.kind;
  if (entry.kind !== "direct") {
    if (entry.status === "recovery") {
      return entry.kind === "organization-invitation"
        ? {
            entryContext: entry.kind,
            nextStep: "invitation-recovery",
            reason: entry.reason,
            availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
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
        availableActions: [
          { kind: "accept-invitation", invitationId: entry.invitationId },
          { kind: "sign-out" },
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
          { kind: "sign-out" },
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
