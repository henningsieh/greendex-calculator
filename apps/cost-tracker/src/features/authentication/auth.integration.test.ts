// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  participantInvitationBridgesTable,
  projectPartnerOrganizationsTable,
  projectsTable,
  user,
  verification,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, like } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({ emailSender: emailMocks }));
vi.mock("server-only", () => ({}));

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];

function uniqueEmail() {
  const email = `cost-tracker-auth-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(user).where(eq(user.email, email));
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${email}%`));
  }
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  vi.clearAllMocks();
});

describe("Cost Tracker Better Auth", () => {
  it("signs up with email verification and signs in only after verification", async () => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";

    const signUp = await auth.api.signUpEmail({
      body: { email, name: "Cost Tracker User", password },
    });

    expect(signUp.user.email).toBe(email);
    expect(emailMocks.sendEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email }),
        url: expect.stringContaining("/api/auth/verify-email"),
      }),
    );

    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, email));

    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("session");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: setCookie!.split(";")[0]! }),
    });
    expect(session?.user).toMatchObject({ email, name: "Cost Tracker User" });
  });

  it("assigns the newest membership to a new session so dashboard reads are authorized", async () => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";
    const olderOrganizationId = randomUUID();
    const newestOrganizationId = randomUUID();
    createdOrganizationIds.push(olderOrganizationId, newestOrganizationId);

    const signUp = await auth.api.signUpEmail({
      body: { email, name: "Project User", password },
    });
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, signUp.user.id));
    await db.insert(organization).values([
      {
        id: olderOrganizationId,
        name: "Earlier Organization",
        slug: `earlier-${olderOrganizationId}`,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: newestOrganizationId,
        name: "Latest Organization",
        slug: `latest-${newestOrganizationId}`,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        organizationId: olderOrganizationId,
        userId: signUp.user.id,
        role: "admin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: randomUUID(),
        organizationId: newestOrganizationId,
        userId: signUp.user.id,
        role: "admin",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not create a session cookie");

    const headers = new Headers({ cookie });
    const session = await auth.api.getSession({ headers });
    expect(session?.session.activeOrganizationId).toBe(newestOrganizationId);

    const client = createRouterClient(router, {
      context: async () => ({ headers }),
    });
    await expect(client.projects.scopes()).resolves.toEqual({
      hosted: false,
      partner: false,
    });
    await expect(
      auth.api.createOrganization({
        body: {
          name: "A second Organization",
          slug: `second-${randomUUID()}`,
        },
        headers,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("accepts a partner-issued native invitation row through Better Auth's own endpoint", async () => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";
    const invited = await auth.api.signUpEmail({
      body: { email, name: "Invited User", password },
    });
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, invited.user.id));
    const hostId = randomUUID();
    const partnerId = randomUUID();
    const inviterId = randomUUID();
    const projectId = randomUUID();
    const partnershipId = randomUUID();
    const invitationId = randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id: inviterId,
      name: "Partner Owner",
      email: uniqueEmail(),
      emailVerified: true,
    });
    await db.insert(organization).values([
      { id: hostId, name: "Invite Host", slug: hostId, createdAt: now },
      { id: partnerId, name: "Invite Partner", slug: partnerId, createdAt: now },
    ]);
    await db.insert(projectsTable).values({
      id: projectId,
      name: "Invite Project",
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV",
      organizationId: hostId,
    });
    await db
      .insert(projectPartnerOrganizationsTable)
      .values({ id: partnershipId, projectId, organizationId: partnerId });
    try {
      // Structural equivalence: BA 1.7's organization adapter creates a pending
      // invitation with these eight native fields and a 48-hour expiry. This test
      // additionally proves its own accept endpoint consumes that shape.
      await db.insert(invitation).values({
        id: invitationId,
        organizationId: hostId,
        email,
        role: "participant",
        status: "pending",
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        createdAt: now,
        inviterId,
      });
      await db.insert(participantInvitationBridgesTable).values({
        invitationId,
        partnershipId,
        projectId,
        email,
        issuedByUserId: inviterId,
      });
      const response = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Sign-in did not create a session cookie");
      const accepted = await auth.api.acceptInvitation({
        body: { invitationId },
        headers: new Headers({ cookie }),
      });
      expect(accepted.member).toMatchObject({
        userId: invited.user.id,
        organizationId: hostId,
        role: "participant",
      });
      expect(
        (
          await db
            .select()
            .from(invitation)
            .where(eq(invitation.id, invitationId))
        )[0]?.status,
      ).toBe("accepted");
    } finally {
      await db
        .delete(participantInvitationBridgesTable)
        .where(eq(participantInvitationBridgesTable.invitationId, invitationId));
      await db.delete(invitation).where(eq(invitation.id, invitationId));
      await db.delete(member).where(eq(member.userId, invited.user.id));
      await db
        .delete(projectPartnerOrganizationsTable)
        .where(eq(projectPartnerOrganizationsTable.id, partnershipId));
      await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
      await db.delete(organization).where(eq(organization.id, partnerId));
      await db.delete(organization).where(eq(organization.id, hostId));
    }
  });

  it("starts Google sign-in with the deployed Cost Tracker callback contract", async () => {
    const result = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: "/projects" },
    });

    expect(result.redirect).toBe(true);
    expect(result.url).toContain("accounts.google.com");
    if (!result.url)
      throw new Error("Google sign-in did not return a redirect URL");
    expect(decodeURIComponent(result.url)).toContain(
      `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
    );
  });
});
