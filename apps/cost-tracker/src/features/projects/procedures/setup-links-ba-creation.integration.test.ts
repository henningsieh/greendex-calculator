import { randomUUID } from "node:crypto";

// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
  session,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizationInvitation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({ emailSender: emailMocks }));
vi.mock("server-only", () => ({}));

import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

const lane = randomUUID();
const password = SEED_USER.password;
const hostEmail = SEED_USER.email;
const recipientEmail = "seed-setup-links-creator@example.org";
const outsiderEmail = "seed-outsider@example.org";
let projectId = "";
const sessionIds: string[] = [];

let hostHeaders: Headers;
let recipientHeaders: Headers;
let recipientUserId: string;
let recipientOrganizationId: string;

async function signInHeaders(email: string) {
  const actor = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (!actor) throw new Error("Canonical seed actor missing.");
  const existing = await db.query.session.findMany({
    where: eq(session.userId, actor.id),
  });
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const previous = new Set(existing.map(({ id }) => id));
  const signedIn = await db.query.session.findMany({
    where: eq(session.userId, actor.id),
  });
  sessionIds.push(
    ...signedIn.filter(({ id }) => !previous.has(id)).map(({ id }) => id),
  );
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`Sign-in created no session for ${email}`);
  return new Headers({ cookie });
}

function client(headers: Headers) {
  return createRouterClient(router, {
    context: async () => ({ headers }),
  });
}

beforeAll(async () => {
  const seededProject = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.name, "Renewable Energy Conference"),
  });
  const recipient = await db.query.user.findFirst({
    where: eq(user.email, recipientEmail),
  });
  if (!seededProject || !recipient)
    throw new Error(
      "Canonical seed required: run the isolated seeded lifecycle.",
    );
  projectId = seededProject.id;
  recipientUserId = recipient.id;
  hostHeaders = await signInHeaders(hostEmail);
  recipientHeaders = await signInHeaders(recipientEmail);
}, 60_000);

afterEach(async () => {
  await db.delete(links).where(eq(links.projectId, projectId));
  if (recipientOrganizationId) {
    await db
      .delete(partnerships)
      .where(eq(partnerships.organizationId, recipientOrganizationId));
    await db
      .delete(organization)
      .where(eq(organization.id, recipientOrganizationId));
    recipientOrganizationId = "";
  }
}, 60_000);

afterAll(async () => {
  if (sessionIds.length)
    await db.delete(session).where(inArray(session.id, sessionIds));
}, 60_000);

describe("Partner setup links through supported Organization creation", () => {
  it("binds an Organization created through the Better Auth API", async () => {
    // The recipient arrives with no Organization and creates one through the
    // normal supported flow; Better Auth grants creator Ownership itself.
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Partner ${lane}`,
        slug: `partner-${lane}`,
      },
      headers: recipientHeaders,
    });
    recipientOrganizationId = created.id;
    const createdMembers = await db
      .select({ userId: member.userId, role: member.role })
      .from(member)
      .where(eq(member.organizationId, created.id));
    expect(createdMembers).toMatchObject([
      { userId: recipientUserId, role: ORGANIZATION_ROLES.OrganizationOwner },
    ]);

    const link = await client(hostHeaders).projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const result = await client(
      recipientHeaders,
    ).projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: created.id,
    });
    expect(result.organizationId).toBe(created.id);
    // Redemption binds only: no Membership was granted or altered.
    expect(
      await db
        .select({ userId: member.userId, role: member.role })
        .from(member)
        .where(eq(member.organizationId, created.id)),
    ).toEqual(createdMembers);
    expect(
      await db
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(eq(partnerships.id, result.partnershipId)),
    ).toHaveLength(1);
  }, 60_000);

  it("refuses a second Organization and an unrelated Organization", async () => {
    // Each case creates its own Organization through the behavior under test;
    // no dependence on the previous binding case.
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Partner ${lane}`,
        slug: `partner-${lane}`,
      },
      headers: recipientHeaders,
    });
    recipientOrganizationId = created.id;
    // Better Auth allows exactly one Organization creation per User without
    // Membership, so a recipient that already owns one cannot mint another.
    await expect(
      auth.api.createOrganization({
        body: {
          country: "DE" as const,
          name: `Second ${lane}`,
          slug: `second-${lane}`,
        },
        headers: recipientHeaders,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const outsiderHeaders = await signInHeaders(outsiderEmail);
    const link = await client(hostHeaders).projectPartnerships.createSetupLink({
      projectId,
      recipientEmail: outsiderEmail,
    });
    // The outsider owns no Organization, so binding the recipient's
    // Organization is an unrelated selection the server must refuse.
    await expect(
      client(outsiderHeaders).projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: recipientOrganizationId,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "ORGANIZATION_OWNER_REQUIRED" },
    });
    const [unchanged] = await db
      .select({ partnershipId: links.partnershipId })
      .from(links)
      .where(eq(links.id, link.id));
    expect(unchanged?.partnershipId).toBeNull();
  }, 60_000);
});
