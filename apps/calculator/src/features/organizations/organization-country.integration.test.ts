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
          where: eq(organization.id, created.id),
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
          where: eq(organization.id, created.id),
        })
      )?.country,
    ).toBe("FR");
  });
});
