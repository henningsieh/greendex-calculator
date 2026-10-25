// @vitest-environment node

import { randomUUID } from "node:crypto";

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
import { eq, like } from "drizzle-orm";
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

async function invite() {
  const host = await account();
  const target = await createOrganization(host);
  const recipient = await account();
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
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${actor.email}%`));
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
      "/accept-invitation/invite_123",
      "organization-invitation",
      "/accept-invitation/invite_123",
    ],
    [
      "/setup-links/setup_123?secret=abc_DEF-123",
      "partner-setup",
      "/setup-links/setup_123?secret=abc_DEF-123",
    ],
    ["/accept-invitation/bad/path", "organization-invitation", undefined],
    ["/accept-invitation/bad!", "organization-invitation", undefined],
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

  it.each([
    undefined,
    "/accept-invitation/missing",
    "/setup-links/missing?secret=abc",
  ])(
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
    const { recipient, host, target, invitationId, returnTo } = await invite();
    const existing = await createOrganization(recipient);
    expect(
      await recipient.api.authentication.onboardingNextStep({ returnTo }),
    ).toEqual({
      entryContext: "organization-invitation",
      nextStep: "accept-invitation",
      availableActions: [
        { kind: "accept-invitation", invitationId },
        { kind: "sign-out" },
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
        { kind: "sign-out" },
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
      reason: "STAFF_INVITATION_CLOSED",
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
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
      const { host, recipient, invitationId, returnTo } = await invite();
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
          availableActions: [
            { kind: "accept-invitation", invitationId },
            { kind: "sign-out" },
          ],
        });
        await host.api.organizations.cancelInvitation({ invitationId });
        reason = "STAFF_INVITATION_CLOSED";
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
        availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
      });
      await expect(
        actor.api.organizations.acceptInvitation({ invitationId: id }),
      ).rejects.toMatchObject({ data: { reason } });
    },
  );

  it("does not add an account-wide pending invitation creation block", async () => {
    const { recipient } = await invite();
    expect(await recipient.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "create-organization",
      availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    });
    const created = await createOrganization(recipient);
    expect(await recipient.api.authentication.onboardingNextStep({})).toEqual({
      entryContext: "direct",
      nextStep: "continue",
      availableActions: [{ kind: "continue", destination: "/projects" }],
    });
    expect(await recipient.api.organizations.listMemberships()).toEqual([
      { ...created, role: "owner" },
    ]);
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
