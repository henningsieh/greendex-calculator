// @vitest-environment node

import { randomUUID } from "node:crypto";

import {
  getOrganizationCreationEligibility,
  ORGANIZATION_ROLES,
} from "@greendex/auth";
import { db } from "@greendex/database";
import {
  invitation,
  organization,
  session as sessions,
  user,
  verification,
  partnerOrganizationSetupLinksTable as links,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi
    .fn<(input: { url: string }) => Promise<void>>()
    .mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizationInvitation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({ emailSender: mail }));
vi.mock("server-only", () => ({}));

import { OnboardingDecisionSchema } from "@/features/authentication/onboarding-decision";
import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

const users: { id: string; email: string }[] = [];
const organizations: string[] = [];

function client(headers = new Headers(), resHeaders = new Headers()) {
  return createRouterClient(router, {
    context: async () => ({ headers, resHeaders }),
  });
}

async function account() {
  const email = `onboarding-${randomUUID()}@example.com`;
  const registered = await auth.api.signUpEmail({
    body: {
      email,
      name: "Onboarding recipient",
      password: "correct-horse-battery-staple",
      callbackURL: "/projects",
    },
  });
  users.push({ id: registered.user.id, email });
  const delivered = mail.sendEmailVerificationEmail.mock.calls.at(-1)?.[0];
  if (!delivered) throw new Error("Verification delivery missing");
  const response = await auth.handler(new Request(delivered.url));
  expect(response.status).toBe(302);
  const headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; "),
  });
  const api = client(headers);
  return { email, id: registered.user.id, headers, api };
}

async function createOrganization(actor: Awaited<ReturnType<typeof account>>) {
  const name = `Onboarding ${randomUUID()}`;
  const result = await actor.api.authentication.createOrganization({
    name,
    slug: `onboarding-${randomUUID()}`,
    country: "DE",
  });
  organizations.push(result.organizationId);
  return { id: result.organizationId, name };
}

async function setup() {
  const host = await account();
  const hosting = await createOrganization(host);
  const project = await host.api.projects.create({
    name: "Onboarding project",
    location: "Berlin",
    country: "DE",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  });
  const recipient = await account();
  const link = await host.api.projectPartnerships.createSetupLink({
    projectId: project.id,
    recipientEmail: recipient.email,
  });
  const returnTo = `/setup-links/${link.id}?secret=${link.secret}`;
  return { host, hosting, project, recipient, link, returnTo };
}

it("maps case-insensitive name refusal before creation and permits a corrected name", async () => {
  const owner = await account();
  const taken = await createOrganization(owner);
  const recipient = await account();
  await expect(
    recipient.api.authentication.createOrganization({
      name: taken.name.toUpperCase(),
      slug: `available-${randomUUID()}`,
      country: "DE",
    }),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
    data: { reason: "ORGANIZATION_NAME_TAKEN_BEFORE_CREATION" },
  });
  expect(await recipient.api.authentication.onboardingNextStep({})).toMatchObject(
    { nextStep: "create-organization" },
  );
  await createOrganization(recipient);
});

async function invite(existingRecipient?: Awaited<ReturnType<typeof account>>) {
  const host = await account();
  const target = await createOrganization(host);
  const recipient = existingRecipient ?? (await account());
  const result = await host.api.organizations.inviteMember({
    email: recipient.email,
    role: "admin",
  });
  return {
    host,
    target,
    recipient,
    invitationId: result.invitationId,
    returnTo: `/accept-invitation/${result.invitationId}`,
  };
}

afterEach(async () => {
  for (const id of organizations.splice(0))
    await db.delete(organization).where(eq(organization.id, id));
  for (const actor of users.splice(0)) {
    await db.delete(user).where(eq(user.id, actor.id));
  }
  vi.clearAllMocks();
});

describe("authoritative onboarding next step", () => {
  it.each([
    [undefined, "direct", undefined],
    ["https://foreign.example/accept-invitation/id", "direct", undefined],
    ["//foreign.example/setup-links/id", "direct", undefined],
    ["/projects?next=https://foreign.example", "direct", undefined],
    [
      "/setup-links/setup_123?secret=abc_DEF-123",
      "partner-setup",
      "/setup-links/setup_123?secret=abc_DEF-123",
    ],
    ["/setup-links/id?secret=bad&extra=value", "partner-setup", undefined],
  ])(
    "only discloses authentication guidance for signed-out continuation %s",
    async (returnTo, entryContext, destination) => {
      const headers = new Headers();
      expect(
        await client(new Headers(), headers).authentication.onboardingNextStep({
          returnTo,
        }),
      ).toEqual({
        entryContext,
        nextStep: "authenticate",
        availableActions: [
          {
            kind: "authenticate",
            ...(destination ? { returnTo: destination } : {}),
          },
        ],
      });
      expect(headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("derives direct creation, completion, and stale selection from current facts", async () => {
    const actor = await account();
    expect(await actor.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "create-organization",
      availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    });
    const owned = await createOrganization(actor);
    expect(await actor.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "continue",
      availableActions: [{ kind: "continue", destination: "/projects" }],
    });
    await auth.api.setActiveOrganization({
      headers: actor.headers,
      body: { organizationId: null },
    });
    expect(await actor.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [owned] },
        { kind: "sign-out" },
      ],
    });
    const current = await auth.api.getSession({ headers: actor.headers });
    if (!current) throw new Error("Session missing");
    await db
      .update(sessions)
      .set({ activeOrganizationId: "revoked-organization" })
      .where(eq(sessions.id, current.session.id));
    expect(await actor.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [owned] },
        { kind: "sign-out" },
      ],
    });
    await expect(
      actor.api.authentication.createOrganization({
        name: "Forged second",
        slug: `forged-${randomUUID()}`,
        country: "DE",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      auth.api.setActiveOrganization({
        headers: actor.headers,
        body: { organizationId: "foreign-organization" },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([undefined, "/setup-links/missing?secret=abc"])(
    "requires current verification before protected entry %s",
    async (returnTo) => {
      const actor = await account();
      await db
        .update(user)
        .set({ emailVerified: false })
        .where(eq(user.id, actor.id));
      const entryContext = returnTo?.startsWith("/accept-invitation")
        ? "organization-invitation"
        : returnTo
          ? "partner-setup"
          : "direct";
      expect(
        await actor.api.authentication.onboardingNextStep({ returnTo }),
      ).toEqual({
        entryContext,
        nextStep: "verify-email",
        email: actor.email,
        availableActions: [{ kind: "sign-out" }],
      });
    },
  );

  it("preserves colleague acceptance and recovers exact selection after acceptance", async () => {
    const recipient = await account();
    const existing = await createOrganization(recipient);
    const { host, target, invitationId, returnTo } = await invite(recipient);
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "accept-invitation",
      invitation: { invitationId, organization: target },
      availableActions: [
        { kind: "accept-invitation", invitationId },
        {
          kind: "sign-out",
          destination: `/register?next=${encodeURIComponent(returnTo)}`,
        },
      ],
    });
    expect(
      await recipient.api.organizations.acceptInvitation({ invitationId }),
    ).toEqual({ organizationId: target.id });
    await auth.api.setActiveOrganization({
      headers: recipient.headers,
      body: { organizationId: existing.id },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [target] },
        {
          kind: "sign-out",
          destination: `/register?next=${encodeURIComponent(returnTo)}`,
        },
      ],
    });
    await auth.api.setActiveOrganization({
      headers: recipient.headers,
      body: { organizationId: target.id },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "continue",
      availableActions: [{ kind: "continue", destination: "/projects" }],
    });
    await auth.api.removeMember({
      headers: host.headers,
      body: { memberIdOrEmail: recipient.email, organizationId: target.id },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "invitation-recovery",
      reason: "STAFF_INVITATION_ACCEPTED",
      returnTo,
      availableActions: [
        {
          kind: "sign-out",
          destination: `/register?next=${encodeURIComponent(returnTo)}`,
        },
        { kind: "recheck" },
      ],
    });
  });

  it.each([
    "missing",
    "malformed",
    "invalid-character",
    "expired",
    "cancelled",
    "wrong-recipient",
  ])(
    "keeps %s invitations in recovery and refuses forged acceptance",
    async (invalid) => {
      const { host, target, recipient, invitationId, returnTo } = await invite();
      let actor = recipient;
      let input = returnTo;
      let id = invitationId;
      let reason = "STAFF_INVITATION_NOT_FOUND";
      if (invalid === "missing") {
        input = "/accept-invitation/missing";
        id = "missing";
      }
      if (invalid === "malformed") {
        input = "/accept-invitation/bad/path";
        id = "missing";
      }
      if (invalid === "invalid-character") {
        input = "/accept-invitation/bad!";
        id = "missing";
      }
      if (invalid === "expired") {
        await db
          .update(invitation)
          .set({ expiresAt: new Date(0) })
          .where(eq(invitation.id, id));
        reason = "STAFF_INVITATION_EXPIRED";
      }
      if (invalid === "cancelled") {
        expect(
          await recipient.api.authentication.onboardingNextStep({ returnTo }),
        ).toEqual({
          entryContext: "organization-invitation",
          nextStep: "accept-invitation",
          invitation: { invitationId, organization: target },
          availableActions: [
            { kind: "accept-invitation", invitationId },
            {
              kind: "sign-out",
              destination: `/register?next=${encodeURIComponent(returnTo)}`,
            },
          ],
        });
        await host.api.organizations.cancelInvitation({ invitationId });
        reason = "STAFF_INVITATION_WITHDRAWN";
      }
      if (invalid === "wrong-recipient") {
        actor = await account();
        reason = "STAFF_INVITATION_WRONG_EMAIL";
      }
      expect(
        await actor.api.authentication.onboardingNextStep({ returnTo: input }),
      ).toEqual({
        entryContext: "organization-invitation",
        nextStep: "invitation-recovery",
        reason,
        returnTo: input.startsWith("/accept-invitation/bad")
          ? "/accept-invitation"
          : input,
        availableActions: [
          {
            kind: "sign-out",
            destination: input.startsWith("/accept-invitation/bad")
              ? "/accept-invitation"
              : `/register?next=${encodeURIComponent(input)}`,
          },
          { kind: "recheck" },
        ],
      });
      await expect(
        actor.api.organizations.acceptInvitation({ invitationId: id }),
      ).rejects.toMatchObject({ data: { reason } });
    },
  );

  it("blocks current creation through the app and Better Auth, then reassesses every remaining invitation", async () => {
    const { host, target, recipient, invitationId } = await invite();
    await db
      .update(invitation)
      .set({ email: recipient.email.toUpperCase() })
      .where(eq(invitation.id, invitationId));
    const restriction = {
      nextStep: "resolve-invitation",
      invitation: { invitationId, organization: target },
    };
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject(restriction);
    await expect(createOrganization(recipient)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      auth.api.createOrganization({
        headers: recipient.headers,
        body: {
          country: "DE",
          name: `Blocked ${randomUUID()}`,
          slug: `blocked-${randomUUID()}`,
        },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(
      await getOrganizationCreationEligibility(
        recipient.id,
        recipient.email.toUpperCase(),
        { singleOrganization: true },
      ),
    ).toMatchObject({ status: "denied-invitation", invitationId });
    expect(
      await getOrganizationCreationEligibility(recipient.id, recipient.email, {
        singleOrganization: false,
      }),
    ).toEqual({ status: "allowed" });
    const other = await account();
    expect(await other.api.authentication.onboardingNextStep({})).toMatchObject({
      nextStep: "create-organization",
    });
    await expect(
      other.api.organizations.rejectInvitation({ invitationId }),
    ).rejects.toMatchObject({ data: { reason: "STAFF_INVITATION_WRONG_EMAIL" } });
    const anotherHost = await account();
    await createOrganization(anotherHost);
    const second = await anotherHost.api.organizations.inviteMember({
      email: recipient.email,
      role: "owner",
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject(restriction);
    await recipient.api.organizations.rejectInvitation({ invitationId });
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject({
      nextStep: "resolve-invitation",
      invitation: { invitationId: second.invitationId },
    });
    await expect(
      recipient.api.organizations.rejectInvitation({ invitationId }),
    ).rejects.toMatchObject({ data: { reason: "STAFF_INVITATION_REJECTED" } });
    await anotherHost.api.organizations.cancelInvitation({
      invitationId: second.invitationId,
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject({ nextStep: "create-organization" });
    const expiring = await host.api.organizations.inviteMember({
      email: recipient.email,
      role: "admin",
    });
    await db
      .update(invitation)
      .set({ expiresAt: new Date(0) })
      .where(eq(invitation.id, expiring.invitationId));
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject({ nextStep: "create-organization" });
    await expect(
      recipient.api.organizations.rejectInvitation({
        invitationId: expiring.invitationId,
      }),
    ).rejects.toMatchObject({ data: { reason: "STAFF_INVITATION_EXPIRED" } });
    await createOrganization(recipient);
    expect(
      await recipient.api.authentication.onboardingNextStep({}),
    ).toMatchObject({ nextStep: "continue" });
    expect(
      await getOrganizationCreationEligibility(recipient.id, recipient.email, {
        singleOrganization: true,
      }),
    ).toEqual({ status: "denied-membership" });
  });

  it("excludes non-colleague invitations and matches an email literally, not as a wildcard", async () => {
    const host = await account();
    const target = await createOrganization(host);
    const recipient = await account();
    for (const role of [
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ] as const) {
      const invited = await auth.api.createInvitation({
        headers: host.headers,
        body: { email: recipient.email, role, organizationId: target.id },
      });
      expect(
        await getOrganizationCreationEligibility(recipient.id, recipient.email, {
          singleOrganization: true,
        }),
      ).toEqual({ status: "allowed" });
      await auth.api.cancelInvitation({
        headers: host.headers,
        body: { invitationId: invited.id },
      });
    }
    await host.api.organizations.inviteMember({
      email: recipient.email,
      role: "admin",
    });
    expect(
      await getOrganizationCreationEligibility(
        recipient.id,
        recipient.email.replace("onboarding", "%"),
        { singleOrganization: true },
      ),
    ).toEqual({ status: "allowed" });
  });

  it("retains Partner setup while an invitation is rejected and rechecks before offering creation", async () => {
    const { host, recipient, returnTo } = await setup();
    const initially = await recipient.api.authentication.onboardingNextStep({
      returnTo,
    });
    expect(initially).toMatchObject({ nextStep: "choose-organization" });
    const invited = await host.api.organizations.inviteMember({
      email: recipient.email,
      role: "admin",
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toMatchObject({
      nextStep: "resolve-invitation",
      returnTo,
      invitation: { invitationId: invited.invitationId },
    });
    await expect(createOrganization(recipient)).rejects.toMatchObject({
      data: { reason: "ORGANIZATION_CREATION_DENIED_BEFORE_CREATION" },
    });
    await recipient.api.organizations.rejectInvitation({
      invitationId: invited.invitationId,
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toMatchObject({
      nextStep: "choose-organization",
      availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    });
  });

  it("separates Partner creation, exact binding, explicit selection, and completion", async () => {
    const { host, hosting, recipient, project, link, returnTo } = await setup();
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "choose-organization",
      availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    });
    const owned = await createOrganization(recipient);
    const setupRecovery = { phase: "created" as const, organizationId: owned.id };
    expect(
      await recipient.api.authentication.onboardingNextStep({
        returnTo,
        setupRecovery,
      }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "bind-partnership",
      availableActions: [
        { kind: "bind-partnership", organizationId: owned.id },
        { kind: "sign-out" },
      ],
    });
    const result = await recipient.api.projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: owned.id,
    });
    expect(result.organizationId).toBe(owned.id);
    await auth.api.setActiveOrganization({
      headers: recipient.headers,
      body: { organizationId: null },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({
        returnTo,
        setupRecovery,
      }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [owned] },
        { kind: "sign-out" },
      ],
    });
    const unrelated = await host.api.organizations.inviteMember({
      email: recipient.email,
      role: "owner",
    });
    await recipient.api.organizations.acceptInvitation({
      invitationId: unrelated.invitationId,
    });
    await auth.api.setActiveOrganization({
      headers: recipient.headers,
      body: { organizationId: hosting.id },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "select-organization",
      availableActions: [
        { kind: "select-organization", organizations: [owned] },
        { kind: "sign-out" },
      ],
    });
    expect(
      (await auth.api.getSession({ headers: recipient.headers }))?.session
        .activeOrganizationId,
    ).toBe(hosting.id);
    expect(
      await recipient.api.authentication.onboardingNextStep({
        returnTo,
        setupRecovery: { phase: "selected", organizationId: hosting.id },
      }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "setup-recovery",
      reason: "SETUP_LINK_USED",
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
    });
    await expect(
      recipient.api.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: hosting.id,
      }),
    ).rejects.toMatchObject({ data: { reason: "SETUP_LINK_USED" } });
    await auth.api.setActiveOrganization({
      headers: recipient.headers,
      body: { organizationId: owned.id },
    });
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "continue",
      availableActions: [
        { kind: "continue", destination: `/projects/${project.id}` },
      ],
    });
    expect(
      (await auth.api.getSession({ headers: host.headers }))?.session
        .activeOrganizationId,
    ).toBe(hosting.id);
  });

  it("requires inspection after uncertain creation and revalidates exact owned recovery IDs", async () => {
    const { hosting, recipient, link, returnTo } = await setup();
    expect(
      await recipient.api.authentication.onboardingNextStep({
        returnTo,
        setupRecovery: { phase: "creating" },
      }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "setup-recovery",
      reason: "ORGANIZATION_OWNER_REQUIRED",
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
    });
    const owned = await createOrganization(recipient);
    expect(
      await recipient.api.authentication.onboardingNextStep({
        returnTo,
        setupRecovery: { phase: "creating" },
      }),
    ).toEqual({
      entryContext: "partner-setup",
      nextStep: "choose-organization",
      availableActions: [
        { kind: "choose-owned-organization", organizations: [owned] },
        { kind: "sign-out" },
      ],
    });
    for (const phase of ["created", "selected"] as const) {
      expect(
        await recipient.api.authentication.onboardingNextStep({
          returnTo,
          setupRecovery: { phase, organizationId: hosting.id },
        }),
      ).toEqual({
        entryContext: "partner-setup",
        nextStep: "setup-recovery",
        reason: "ORGANIZATION_OWNER_REQUIRED",
        availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
      });
      expect(
        await recipient.api.authentication.onboardingNextStep({
          returnTo,
          setupRecovery: { phase, organizationId: owned.id },
        }),
      ).toEqual({
        entryContext: "partner-setup",
        nextStep: "bind-partnership",
        availableActions: [
          { kind: "bind-partnership", organizationId: owned.id },
          { kind: "sign-out" },
        ],
      });
    }
    await expect(
      recipient.api.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: hosting.id,
      }),
    ).rejects.toMatchObject({ data: { reason: "ORGANIZATION_OWNER_REQUIRED" } });
  });

  it.each([
    "wrong-secret",
    "wrong-recipient",
    "expired",
    "disabled",
    "missing-secret",
  ])(
    "recovers %s Partner links without creation and refuses stale binding",
    async (invalid) => {
      const { host, recipient, link, returnTo } = await setup();
      const owned = await createOrganization(recipient);
      let actor = recipient;
      let destination = returnTo;
      let secret = link.secret;
      let reason = "SETUP_LINK_NOT_FOUND";
      if (invalid === "wrong-secret") {
        secret = "wrong";
        destination = `/setup-links/${link.id}?secret=${secret}`;
      }
      if (invalid === "missing-secret") {
        secret = "";
        destination = `/setup-links/${link.id}`;
      }
      if (invalid === "wrong-recipient") {
        actor = await account();
        reason = "SETUP_LINK_WRONG_EMAIL";
      }
      if (invalid === "expired") {
        await db
          .update(links)
          .set({ expiresAt: new Date(0) })
          .where(eq(links.id, link.id));
        reason = "SETUP_LINK_EXPIRED";
      }
      if (invalid === "disabled") {
        expect(
          await recipient.api.authentication.onboardingNextStep({
            returnTo,
            setupRecovery: { phase: "selected", organizationId: owned.id },
          }),
        ).toEqual({
          entryContext: "partner-setup",
          nextStep: "bind-partnership",
          availableActions: [
            { kind: "bind-partnership", organizationId: owned.id },
            { kind: "sign-out" },
          ],
        });
        await host.api.projectPartnerships.disableSetupLink({ id: link.id });
        reason = "SETUP_LINK_DISABLED";
      }
      expect(
        await actor.api.authentication.onboardingNextStep({
          returnTo: destination,
          setupRecovery: { phase: "selected", organizationId: owned.id },
        }),
      ).toEqual({
        entryContext: "partner-setup",
        nextStep: "setup-recovery",
        reason,
        availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
      });
      await expect(
        actor.api.projectPartnerships.consumeSetupLink({
          id: link.id,
          secret,
          organizationId: owned.id,
        }),
      ).rejects.toMatchObject(
        invalid === "missing-secret"
          ? { code: "BAD_REQUEST" }
          : { data: { reason } },
      );
    },
  );

  it("rejects client-supplied actions and missing action payloads", async () => {
    await expect(
      Reflect.apply(client().authentication.onboardingNextStep, undefined, [
        {
          availableActions: [
            { kind: "continue", destination: "https://foreign.example" },
          ],
        },
      ]),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      OnboardingDecisionSchema.safeParse({
        entryContext: "direct",
        nextStep: "continue",
        availableActions: [],
      }).success,
    ).toBe(false);
    expect(
      OnboardingDecisionSchema.safeParse({
        entryContext: "direct",
        nextStep: "continue",
        availableActions: [{ kind: "continue" }],
      }).success,
    ).toBe(false);
    expect(await client().authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "authenticate",
      availableActions: [{ kind: "authenticate" }],
    });
  });
});

it("names only a usable staff invitation before authentication and retains both entry doors", async () => {
  const { host, target, invitationId, returnTo } = await invite();
  expect(await client().authentication.onboardingNextStep({ returnTo })).toEqual({
    entryContext: "organization-invitation",
    nextStep: "authenticate",
    invitation: { invitationId, organization: target },
    availableActions: [
      { kind: "authenticate", entry: "register", returnTo },
      { kind: "authenticate", entry: "login", returnTo },
      { kind: "google", returnTo },
    ],
  });
  expect(
    await client().authentication.onboardingNextStep({
      returnTo,
      authEntry: "login",
    }),
  ).toMatchObject({
    availableActions: [
      { kind: "authenticate", entry: "login", returnTo },
      { kind: "authenticate", entry: "register", returnTo },
      { kind: "google", returnTo },
    ],
  });
  await host.api.organizations.cancelInvitation({ invitationId });
  for (const destination of [
    returnTo,
    "/accept-invitation/missing",
    "/accept-invitation/bad!",
    "/accept-invitation/bad/path",
    "/accept-invitation",
  ]) {
    expect(
      await client().authentication.onboardingNextStep({ returnTo: destination }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "invitation-recovery",
      reason: "STAFF_INVITATION_NOT_FOUND",
      returnTo:
        destination.includes("bad") || destination === "/accept-invitation"
          ? "/accept-invitation"
          : destination,
      availableActions:
        destination.includes("bad") || destination === "/accept-invitation"
          ? [{ kind: "recheck" }]
          : [
              { kind: "authenticate", entry: "login", returnTo: destination },
              { kind: "recheck" },
            ],
    });
  }
});

it("returns the same named signup receipt for new and duplicate email without granting a session", async () => {
  const host = await account();
  const target = await createOrganization(host);
  const email = `onboarding-${randomUUID()}@example.com`;
  const result = await host.api.organizations.inviteMember({
    email,
    role: "admin",
  });
  const returnTo = `/accept-invitation/${result.invitationId}`;
  const input = {
    name: "New colleague",
    email,
    password: "correct-horse-battery-staple",
    returnTo,
  };
  try {
    for (const attempt of [0, 1]) {
      const headers = new Headers();
      expect(
        await client(new Headers(), headers).authentication.signUp(input),
      ).toEqual({
        success: true,
        decision: {
          entryContext: "organization-invitation",
          nextStep: "verify-email",
          invitation: { invitationId: result.invitationId, organization: target },
          email,
          availableActions: [
            { kind: "authenticate", entry: "login", returnTo },
            {
              kind: "resend-verification",
              email,
              callbackURL: returnTo,
            },
          ],
        },
      });
      expect(headers.get("cache-control")).toBe("private, no-store");
      expect(
        await auth.api.getSession({
          headers: new Headers({
            cookie: headers
              .getSetCookie()
              .map((cookie) => cookie.split(";")[0])
              .join("; "),
          }),
        }),
      ).toBeNull();
      if (attempt === 0) {
        const created = await db.query.user.findFirst({
          where: eq(user.email, email),
        });
        if (!created) throw new Error("Signup did not create a User");
        users.push({ id: created.id, email });
      }
    }
    const delivered = mail.sendEmailVerificationEmail.mock.calls.at(-1)?.[0];
    if (!delivered) throw new Error("Verification delivery missing");
    const verified = await auth.handler(new Request(delivered.url));
    expect(verified.status).toBe(302);
    const location = new URL(
      verified.headers.get("location") ?? "",
      delivered.url,
    );
    expect(location.pathname).toBe(returnTo);
    const headers = new Headers({
      cookie: verified.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; "),
    });
    const api = client(headers);
    expect((await auth.api.getSession({ headers }))?.user.emailVerified).toBe(
      true,
    );
    expect(
      await api.authentication.onboardingNextStep({ returnTo }),
    ).toMatchObject({
      nextStep: "accept-invitation",
      invitation: { invitationId: result.invitationId, organization: target },
    });
    expect(
      await api.organizations.acceptInvitation({
        invitationId: result.invitationId,
      }),
    ).toEqual({ organizationId: target.id });
    expect(await api.organizations.listMemberships()).toEqual([
      { ...target, role: "admin" },
    ]);
    const replay = await auth.handler(new Request(delivered.url));
    expect(
      await auth.api.getSession({
        headers: new Headers({
          cookie: replay.headers
            .getSetCookie()
            .map((cookie) => cookie.split(";")[0])
            .join("; "),
        }),
      }),
    ).toBeNull();
  } finally {
    const created = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (created && !users.some(({ id }) => id === created.id))
      users.push({ id: created.id, email });
  }
});

it("enforces current verification at both acceptance doors after a verified session is revoked", async () => {
  const { recipient, invitationId, returnTo, target } = await invite();
  expect(
    await recipient.api.authentication.onboardingNextStep({ returnTo }),
  ).toMatchObject({ nextStep: "accept-invitation" });
  await db
    .update(user)
    .set({ emailVerified: false })
    .where(eq(user.id, recipient.id));
  expect(
    await recipient.api.authentication.onboardingNextStep({ returnTo }),
  ).toEqual({
    entryContext: "organization-invitation",
    nextStep: "verify-email",
    invitation: { invitationId, organization: target },
    email: recipient.email,
    availableActions: [
      {
        kind: "sign-out",
        destination: `/register?next=${encodeURIComponent(returnTo)}`,
      },
      {
        kind: "resend-verification",
        email: recipient.email,
        callbackURL: returnTo,
      },
    ],
  });
  await expect(
    recipient.api.organizations.acceptInvitation({ invitationId }),
  ).rejects.toMatchObject({ data: { reason: "EMAIL_VERIFICATION_REQUIRED" } });
  await expect(
    auth.api.acceptInvitation({
      headers: recipient.headers,
      body: { invitationId },
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(await recipient.api.organizations.listMemberships()).toEqual([]);
});

it("returns identical wrong-address recovery for new and duplicate signup before verification", async () => {
  const { returnTo, target, invitationId, recipient } = await invite();
  const email = `onboarding-${randomUUID()}@example.com`;
  const input = {
    name: "Mistyped colleague",
    email,
    password: "correct-horse-battery-staple",
    returnTo,
  };
  try {
    for (const attempt of [0, 1]) {
      const headers = new Headers();
      const result = await client(new Headers(), headers).authentication.signUp(
        input,
      );
      expect(result).toEqual({
        success: true,
        decision: {
          entryContext: "organization-invitation",
          nextStep: "invitation-recovery",
          reason: "STAFF_INVITATION_WRONG_EMAIL",
          returnTo,
          availableActions: [
            { kind: "authenticate", entry: "login", returnTo },
            { kind: "recheck" },
          ],
        },
      });
      expect(JSON.stringify(result)).not.toContain(recipient.email);
      expect(JSON.stringify(result)).not.toContain(email);
      expect(headers.get("cache-control")).toBe("private, no-store");
      expect(await auth.api.getSession({ headers })).toBeNull();
      const created = await db.query.user.findFirst({
        where: eq(user.email, email),
      });
      expect(created?.emailVerified).toBe(false);
      if (attempt === 0 && created) users.push({ id: created.id, email });
      expect(await recipient.api.organizations.listMemberships()).toEqual([]);
      expect(
        await db.query.invitation.findFirst({
          where: eq(invitation.id, invitationId),
        }),
      ).toMatchObject({ status: "pending", organizationId: target.id });
    }
    expect(
      await client().authentication.onboardingNextStep({ returnTo }),
    ).toMatchObject({
      nextStep: "authenticate",
      availableActions: [
        { kind: "authenticate", entry: "register", returnTo },
        { kind: "authenticate", entry: "login", returnTo },
        { kind: "google", returnTo },
      ],
    });
  } finally {
    const created = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (created && !users.some(({ id }) => id === created.id))
      users.push({ id: created.id, email });
  }
});

it("signup verification and owned User cleanup preserve pre-existing verification rows", async () => {
  const actor = await account();
  await auth.api.requestPasswordReset({ body: { email: actor.email } });
  const delivered = mail.sendPasswordResetEmail.mock.calls.at(-1)?.[0];
  if (!delivered) throw new Error("Password reset delivery missing");
  const resetURL = new URL(delivered.url);
  const identifier = `reset-password:${resetURL.pathname.split("/").at(-1)}`;
  const retained = await db.query.verification.findFirst({
    where: eq(verification.identifier, identifier),
  });
  if (!retained)
    throw new Error("Supported password reset did not create a verification row");
  try {
    const before = await db.select().from(verification);
    const email = `onboarding-${randomUUID()}@example.com`;
    await client().authentication.signUp({
      name: "Cleanup regression",
      email,
      password: "correct-horse-battery-staple",
    });
    const created = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (!created) throw new Error("Signup did not create a User");
    users.push({ id: created.id, email });
    expect(await db.select().from(verification)).toEqual(
      expect.arrayContaining(before),
    );
    expect(await db.select().from(verification)).toHaveLength(before.length);
    await db.delete(user).where(eq(user.id, created.id));
    expect(await db.select().from(verification)).toEqual(
      expect.arrayContaining(before),
    );
    expect(
      await db.query.verification.findFirst({
        where: eq(verification.id, retained.id),
      }),
    ).toEqual(retained);
  } finally {
    await db.delete(verification).where(eq(verification.id, retained.id));
  }
});
