import { describe, expect, it } from "vitest";

import {
  decideOnboarding,
  OnboardingDecisionSchema,
  type OnboardingFacts,
} from "@/features/authentication/onboarding-decision";

const invitation = {
  invitationId: "invite-1",
  organization: { id: "org-1", name: "Example Organization" },
};
const returnTo = "/accept-invitation/invite-1";
const pending = {
  kind: "organization-invitation",
  status: "pending",
  ...invitation,
} as const;

function anonymous(
  account: "signed-out" | "unverified" | "verification-requested",
): Extract<OnboardingFacts, { entryContext: "organization-invitation" }> {
  return {
    account,
    entryContext: "organization-invitation",
    entry: pending,
    authEntry: "register",
    returnTo,
    email: "submitted@example.org",
  };
}

describe("invitation decisions", () => {
  it("defaults to registration without discovering an account and retains both doors and Google", () => {
    const decision = decideOnboarding(anonymous("signed-out"));
    expect(OnboardingDecisionSchema.parse(decision)).toEqual({
      entryContext: "organization-invitation",
      nextStep: "authenticate",
      invitation,
      availableActions: [
        { kind: "authenticate", entry: "register", returnTo },
        { kind: "authenticate", entry: "login", returnTo },
        { kind: "google", returnTo },
      ],
    });
    expect(
      decideOnboarding({ ...anonymous("signed-out"), authEntry: "login" }),
    ).toMatchObject({
      availableActions: [
        { entry: "login", returnTo },
        { entry: "register", returnTo },
        { kind: "google", returnTo },
      ],
    });
  });

  it.each(["unverified", "verification-requested"] as const)(
    "renders %s as named verification without authorizing acceptance",
    (account) => {
      expect(
        OnboardingDecisionSchema.parse(decideOnboarding(anonymous(account))),
      ).toEqual({
        entryContext: "organization-invitation",
        nextStep: "verify-email",
        invitation,
        email: "submitted@example.org",
        availableActions:
          account === "unverified"
            ? [
                {
                  kind: "sign-out",
                  destination: "/register?next=%2Faccept-invitation%2Finvite-1",
                },
                {
                  kind: "resend-verification",
                  email: "submitted@example.org",
                  callbackURL: returnTo,
                },
              ]
            : [
                { kind: "authenticate", entry: "login", returnTo },
                {
                  kind: "resend-verification",
                  email: "submitted@example.org",
                  callbackURL: returnTo,
                },
              ],
      });
    },
  );

  it.each(["signed-out", "unverified", "verification-requested"] as const)(
    "keeps malformed %s entries in recovery with no authentication callback",
    (account) => {
      const decision = decideOnboarding({
        account,
        entryContext: "organization-invitation",
        authEntry: "login",
        returnTo: "/accept-invitation",
        email: "submitted@example.org",
        entry: {
          kind: "organization-invitation",
          status: "recovery",
          reason: "STAFF_INVITATION_NOT_FOUND",
        },
      });
      expect(OnboardingDecisionSchema.parse(decision)).toEqual({
        entryContext: "organization-invitation",
        nextStep: "invitation-recovery",
        reason: "STAFF_INVITATION_NOT_FOUND",
        returnTo: "/accept-invitation",
        availableActions:
          account === "unverified"
            ? [
                { kind: "sign-out", destination: "/accept-invitation" },
                { kind: "recheck" },
              ]
            : [{ kind: "recheck" }],
      });
    },
  );

  it("requires one explicit accept and preserves completion selection", () => {
    const facts = {
      account: "verified",
      returnTo,
      entry: pending,
      canCreate: true,
      organizationContext: { status: "no-membership" },
    } as const;
    expect(OnboardingDecisionSchema.parse(decideOnboarding(facts))).toEqual({
      entryContext: "organization-invitation",
      nextStep: "accept-invitation",
      invitation,
      availableActions: [
        { kind: "accept-invitation", invitationId: "invite-1" },
        {
          kind: "sign-out",
          destination: "/register?next=%2Faccept-invitation%2Finvite-1",
        },
      ],
    });
    expect(
      decideOnboarding({
        ...facts,
        entry: {
          kind: "organization-invitation",
          status: "complete",
          organization: invitation.organization,
        },
      }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [invitation.organization] },
        {
          kind: "sign-out",
          destination: "/register?next=%2Faccept-invitation%2Finvite-1",
        },
      ],
    });
  });

  it("rejects missing named context and unsafe authentication callbacks", () => {
    const valid = decideOnboarding(anonymous("signed-out"));
    expect(OnboardingDecisionSchema.safeParse(valid).success).toBe(true);
    expect(
      OnboardingDecisionSchema.safeParse({ ...valid, invitation: undefined })
        .success,
    ).toBe(false);
    expect(
      OnboardingDecisionSchema.safeParse({
        ...valid,
        availableActions: [
          {
            kind: "authenticate",
            entry: "register",
            returnTo: "https://example.org",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

it("lets an established member authenticate from generic unavailable recovery without public identity", () => {
  const facts: OnboardingFacts = {
    ...anonymous("signed-out"),
    entry: {
      kind: "organization-invitation",
      status: "recovery",
      reason: "STAFF_INVITATION_NOT_FOUND",
    },
  };
  expect(OnboardingDecisionSchema.parse(decideOnboarding(facts))).toEqual({
    entryContext: "organization-invitation",
    nextStep: "invitation-recovery",
    reason: "STAFF_INVITATION_NOT_FOUND",
    returnTo,
    availableActions: [
      { kind: "authenticate", entry: "login", returnTo },
      { kind: "recheck" },
    ],
  });
  expect(
    OnboardingDecisionSchema.parse(
      decideOnboarding({ ...facts, authEntry: "login" }),
    ),
  ).toEqual({
    entryContext: "organization-invitation",
    nextStep: "authenticate",
    invitation: null,
    availableActions: [
      { kind: "authenticate", entry: "login", returnTo },
      { kind: "authenticate", entry: "register", returnTo },
      { kind: "google", returnTo },
    ],
  });
});

it.each(["verification-requested", "unverified"] as const)(
  "keeps a wrong-address %s in recovery before verification without leaking an address",
  (account) => {
    const decision = decideOnboarding({
      ...anonymous(account),
      entry: {
        kind: "organization-invitation",
        status: "recovery",
        reason: "STAFF_INVITATION_WRONG_EMAIL",
      },
    });
    expect(OnboardingDecisionSchema.parse(decision)).toEqual({
      entryContext: "organization-invitation",
      nextStep: "invitation-recovery",
      reason: "STAFF_INVITATION_WRONG_EMAIL",
      returnTo,
      availableActions: [
        account === "unverified"
          ? {
              kind: "sign-out",
              destination: `/register?next=${encodeURIComponent(returnTo)}`,
            }
          : { kind: "authenticate", entry: "login", returnTo },
        { kind: "recheck" },
      ],
    });
    expect(JSON.stringify(decision)).not.toContain("submitted@example.org");
  },
);

it.each(["direct", "partner-setup"] as const)(
  "keeps %s verification free of invitation resend actions",
  (entryContext) => {
    expect(
      OnboardingDecisionSchema.parse(
        decideOnboarding({
          account: "unverified",
          entryContext,
          email: "submitted@example.org",
        }),
      ),
    ).toEqual({
      entryContext,
      nextStep: "verify-email",
      email: "submitted@example.org",
      availableActions: [{ kind: "sign-out" }],
    });
  },
);

it("keeps the invitation sign-out destination equal across verification, recovery, acceptance and selection", () => {
  const verified = {
    account: "verified",
    returnTo,
    entry: pending,
    canCreate: true,
    organizationContext: { status: "no-membership" },
  } as const;
  const facts: OnboardingFacts[] = [
    anonymous("unverified"),
    {
      ...verified,
      entry: {
        kind: "organization-invitation",
        status: "recovery",
        reason: "STAFF_INVITATION_NOT_FOUND",
      },
    },
    verified,
    {
      ...verified,
      entry: {
        kind: "organization-invitation",
        status: "complete",
        organization: invitation.organization,
      },
    },
  ];
  expect(
    facts.map((input) => {
      const action = decideOnboarding(input).availableActions.find(
        (candidate) => candidate.kind === "sign-out",
      );
      return action && "destination" in action ? action.destination : undefined;
    }),
  ).toEqual([
    "/register?next=%2Faccept-invitation%2Finvite-1",
    "/register?next=%2Faccept-invitation%2Finvite-1",
    "/register?next=%2Faccept-invitation%2Finvite-1",
    "/register?next=%2Faccept-invitation%2Finvite-1",
  ]);
});
