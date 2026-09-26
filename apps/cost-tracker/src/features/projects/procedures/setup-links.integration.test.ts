import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { router } from "@/lib/orpc/router";

const id = randomUUID();
const userId = `setup-user-${id}`;
const hostId = `setup-host-${id}`;
const partnerId = `setup-partner-${id}`;
const projectId = `setup-project-${id}`;
const recipientEmail = `setup-${id}@example.com`;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function asUser(email = recipientEmail, activeOrganizationId = hostId) {
  authMocks.getSession.mockResolvedValue({
    session: { id, userId, activeOrganizationId },
    user: { id: userId, email, emailVerified: true, name: "Setup User" },
  });
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Setup User",
    email: recipientEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: hostId, slug: hostId, name: "Host", createdAt: now },
    { id: partnerId, slug: partnerId, name: "Partner", createdAt: now },
  ]);
  await db.insert(member).values({
    id: `setup-member-${id}`,
    userId,
    organizationId: partnerId,
    role: "owner",
    createdAt: now,
  });
  await db.insert(projectsTable).values({
    id: projectId,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    responsibleUserId: userId,
    organizationId: hostId,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  asUser();
});

afterAll(async () => {
  const created = await db
    .select({ organizationId: partnerships.organizationId })
    .from(partnerships)
    .where(eq(partnerships.projectId, projectId));
  await db.delete(links).where(eq(links.projectId, projectId));
  await db.delete(partnerships).where(eq(partnerships.projectId, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(member).where(eq(member.userId, userId));
  for (const row of created)
    if (row.organizationId !== partnerId)
      await db
        .delete(organization)
        .where(eq(organization.id, row.organizationId));
  await db.delete(organization).where(eq(organization.id, partnerId));
  await db.delete(organization).where(eq(organization.id, hostId));
  await db.delete(user).where(eq(user.id, userId));
});

describe("Partner Organization setup links", () => {
  it("creates a Partnership for an Owner exactly once on replay", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = {
      id: link.id,
      secret: link.secret,
      organization: { kind: "existing" as const, organizationId: partnerId },
    };
    const first = await client.projectPartnerships.consumeSetupLink(input);
    expect(await client.projectPartnerships.consumeSetupLink(input)).toEqual(
      first,
    );
    expect(
      (
        await db
          .select()
          .from(partnerships)
          .where(eq(partnerships.projectId, projectId))
      ).length,
    ).toBe(1);
    const duplicate = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await expect(
      client.projectPartnerships.consumeSetupLink({
        ...input,
        id: duplicate.id,
        secret: duplicate.secret,
      }),
    ).rejects.toThrow("already assigned");
  });

  it("rejects wrong email and disabled links without creating a Partnership", async () => {
    const before = await db
      .select({ id: partnerships.id })
      .from(partnerships)
      .where(eq(partnerships.projectId, projectId));
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = {
      id: link.id,
      secret: link.secret,
      organization: { kind: "existing" as const, organizationId: partnerId },
    };
    asUser("wrong@example.com");
    await expect(
      client.projectPartnerships.consumeSetupLink(input),
    ).rejects.toThrow("another email");
    asUser();
    await client.projectPartnerships.disableSetupLink({ id: link.id });
    await expect(
      client.projectPartnerships.consumeSetupLink(input),
    ).rejects.toThrow("disabled");
    expect(
      await db
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(eq(partnerships.projectId, projectId)),
    ).toEqual(before);
  });

  it("creates a new Organization with Owner membership, without Host membership", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = {
      id: link.id,
      secret: link.secret,
      organization: { kind: "new" as const, name: "New Partner" },
    };
    const result = await client.projectPartnerships.consumeSetupLink(input);
    expect(await client.projectPartnerships.consumeSetupLink(input)).toEqual(
      result,
    );
    expect(
      await db
        .select()
        .from(member)
        .where(eq(member.organizationId, result.organizationId)),
    ).toMatchObject([{ role: "owner", userId }]);
    expect(
      await db.select().from(member).where(eq(member.organizationId, hostId)),
    ).toEqual([]);
  });

  it("requires Owner verification and rejects expired links", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await db
      .update(member)
      .set({ role: "member" })
      .where(eq(member.organizationId, partnerId));
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organization: { kind: "existing", organizationId: partnerId },
      }),
    ).rejects.toThrow("Owner");
    await db
      .update(member)
      .set({ role: "owner" })
      .where(eq(member.organizationId, partnerId));
    await db
      .update(links)
      .set({ expiresAt: new Date(0) })
      .where(eq(links.id, link.id));
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organization: { kind: "existing", organizationId: partnerId },
      }),
    ).rejects.toThrow("expired");
  });
});
