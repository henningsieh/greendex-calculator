// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import { organization, user } from "@greendex/database/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({
  emailSender: {
    sendEmailVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendOrganizationInvitation: vi.fn(),
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void task(),
}));

import { auth } from "@/lib/better-auth";

const userIds: string[] = [];
const organizationIds: string[] = [];

async function account() {
  const email = `organization-country-${randomUUID()}@example.org`;
  const password = "organization-country-fixture-password";
  const created = await auth.api.signUpEmail({
    body: { email, password, name: "Country Owner" },
  });
  userIds.push(created.user.id);
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, created.user.id));
  const signedIn = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
  return { userId: created.user.id, headers: new Headers({ cookie }) };
}

async function createOwnOrganization(headers: Headers) {
  const id = randomUUID();
  const result = await auth.api.createOrganization({
    headers,
    body: { name: `Country Organization ${id}`, slug: id, country: "DE" },
  });
  organizationIds.push(result.id);
  return result;
}

async function request(path: string, headers: Headers, body: unknown) {
  const { baseURL } = (await auth.$context).options;
  return auth.handler(
    new Request(`${baseURL}/api/auth/organization/${path}`, {
      method: "POST",
      headers: {
        cookie: headers.get("cookie")!,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(async () => {
  if (organizationIds.length)
    await db
      .delete(organization)
      .where(inArray(organization.id, organizationIds.splice(0)));
  if (userIds.length)
    await db.delete(user).where(inArray(user.id, userIds.splice(0)));
});

describe("Organization country through Better Auth", () => {
  it("leaves Calculator multi-Organization creation enabled and uses the Owner creator role", async () => {
    const owner = await account();
    const first = await createOwnOrganization(owner.headers);
    const second = await createOwnOrganization(owner.headers);
    expect(second.id).not.toBe(first.id);
    const membership = await db.query.member.findFirst({
      where: { organizationId: second.id },
    });
    expect(membership?.role).toBe(ORGANIZATION_ROLES.OrganizationOwner);
  });

  it("rejects case-insensitive duplicate Organization names", async () => {
    const owner = await account();
    const first = await createOwnOrganization(owner.headers);
    await expect(
      auth.api.createOrganization({
        headers: owner.headers,
        body: {
          name: first.name.toLowerCase(),
          slug: randomUUID(),
          country: "DE",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects unknown member roles before persistence", async () => {
    const owner = await account();
    const organization = await createOwnOrganization(owner.headers);
    const email = `invited-${randomUUID()}@example.org`;
    const response = await request("invite-member", owner.headers, {
      organizationId: organization.id,
      email,
      role: "unknown",
    });
    expect(response.status).toBe(400);
    expect(
      await db.query.invitation.findFirst({
        where: { email },
      }),
    ).toBeUndefined();
  });

  it("accepts native array role grants without replacing combined authority", async () => {
    const owner = await account();
    const organization = await createOwnOrganization(owner.headers);
    const target = await account();
    const roles = [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.Participant,
    ];
    const granted = await auth.api.addMember({
      body: {
        userId: target.userId,
        organizationId: organization.id,
        role: roles,
      },
    });
    expect(granted?.role).toBe(roles.join(","));
    expect(
      (await db.query.member.findFirst({ where: { id: granted!.id } }))?.role,
    ).toBe(roles.join(","));
  });

  it("refuses missing, lowercase and non-EU country, then persists the selected EU country", async () => {
    const owner = await account();
    for (const country of [undefined, null, "", "de", "US"]) {
      const id = randomUUID();
      const response = await request("create", owner.headers, {
        name: `Invalid ${id}`,
        slug: id,
        country,
      });
      expect(response.status).toBe(400);
    }
    const created = await createOwnOrganization(owner.headers);
    expect(created.country).toBe("DE");
    expect(
      (
        await db.query.organization.findFirst({
          where: { id: created.id },
        })
      )?.country,
    ).toBe("DE");
  });

  it("lets an Owner correct their Organization country, refuses invalid corrections and denies an outsider", async () => {
    const owner = await account();
    const created = await createOwnOrganization(owner.headers);
    const updated = await auth.api.updateOrganization({
      headers: owner.headers,
      body: { organizationId: created.id, data: { country: "FR" } },
    });
    expect(updated?.country).toBe("FR");
    for (const country of [null, "", "US", "fr"]) {
      const response = await request("update", owner.headers, {
        organizationId: created.id,
        data: { country },
      });
      expect(response.status).toBe(400);
    }
    const outsider = await account();
    const denied = await request("update", outsider.headers, {
      organizationId: created.id,
      data: { country: "IT" },
    });
    expect(denied.ok).toBe(false);
    await auth.api.addMember({
      body: {
        userId: outsider.userId,
        organizationId: created.id,
        role: ORGANIZATION_ROLES.Participant,
      },
    });
    const participantDenied = await request("update", outsider.headers, {
      organizationId: created.id,
      data: { country: "IT" },
    });
    expect(participantDenied.status).toBe(403);
    expect(
      (
        await db.query.organization.findFirst({
          where: { id: created.id },
        })
      )?.country,
    ).toBe("FR");
  });
});
