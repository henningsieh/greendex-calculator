import { randomUUID } from "node:crypto";

// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
  verification,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
const password = "correct-horse-battery-staple";
const hostEmail = `setup-host-${lane}@example.com`;
const recipientEmail = `setup-recipient-${lane}@example.com`;
const outsiderEmail = `setup-outsider-${lane}@example.com`;
const projectId = `setup-ba-project-${lane}`;

let hostHeaders: Headers;
let recipientHeaders: Headers;
let recipientUserId: string;
let recipientOrganizationId: string;

async function signInHeaders(email: string) {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`Sign-in created no session for ${email}`);
  return new Headers({ cookie });
}

async function signUpVerified(email: string) {
  const signUp = await auth.api.signUpEmail({
    body: { email, name: "Setup User", password },
  });
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, signUp.user.id));
  return signUp.user.id;
}

function client(headers: Headers) {
  return createRouterClient(router, {
    context: async () => ({ headers }),
  });
}

beforeAll(async () => {
  await signUpVerified(hostEmail);
  recipientUserId = await signUpVerified(recipientEmail);
  await signUpVerified(outsiderEmail);
  hostHeaders = await signInHeaders(hostEmail);
  recipientHeaders = await signInHeaders(recipientEmail);

  const hostOrganization = await auth.api.createOrganization({
    body: { country: "DE" as const, name: `Host ${lane}`, slug: `host-${lane}` },
    headers: hostHeaders,
  });
  // Refresh the host session so issuance sees the Hosting Organization.
  hostHeaders = await signInHeaders(hostEmail);
  const now = new Date();
  await db.insert(projectsTable).values({
    id: projectId,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: hostOrganization.id,
  });
  const [hostUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, hostEmail));
  await db.insert(hostAssignments).values({ projectId, userId: hostUser!.id });
}, 60_000);

afterAll(async () => {
  await db.delete(links).where(eq(links.projectId, projectId));
  await db.delete(partnerships).where(eq(partnerships.projectId, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  for (const email of [hostEmail, recipientEmail, outsiderEmail]) {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (row) {
      const memberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, row.id));
      await db.delete(member).where(eq(member.userId, row.id));
      for (const { organizationId } of memberships)
        await db.delete(organization).where(eq(organization.id, organizationId));
      await db.delete(user).where(eq(user.id, row.id));
    }
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${email}%`));
  }
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
