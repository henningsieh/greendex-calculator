// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  session as sessionsTable,
  user,
} from "@greendex/database/schema";
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

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Setup signs in as these recognizable
 * users; Organization creation, invitation, and role changes below go
 * through the supported Better Auth behavior as the action under test.
 * Case Organizations are removed afterwards; canonical actors are never
 * deleted.
 */
const SEED_OWNER_EMAIL = SEED_USER.email;
const SEED_PARTICIPANT_EMAIL = "seed-participant@example.org";
const SEED_OUTSIDER_EMAIL = "seed-outsider@example.org";
const SEED_ORG_SLUG = "seed-org";

const organizationIds: string[] = [];
const caseSessionTokens: string[] = [];

async function seedSession(email: string) {
  const stored = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!stored) throw new Error(`Seed user is missing: ${email}`);
  const signedIn = await auth.api.signInEmail({
    body: { email, password: SEED_USER.password },
    returnHeaders: true,
  });
  caseSessionTokens.push(signedIn.response.token);
  const cookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
  return { userId: stored.id, headers: new Headers({ cookie }) };
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
  for (const token of caseSessionTokens.splice(0)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  const caseOrgIds = organizationIds.splice(0);
  if (caseOrgIds.length) {
    await db.delete(member).where(inArray(member.organizationId, caseOrgIds));
    await db
      .delete(invitation)
      .where(inArray(invitation.organizationId, caseOrgIds));
    await db.delete(organization).where(inArray(organization.id, caseOrgIds));
  }
  // Canonical actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
  for (const email of [
    SEED_OWNER_EMAIL,
    SEED_PARTICIPANT_EMAIL,
    SEED_OUTSIDER_EMAIL,
  ]) {
    expect(
      await db.query.user.findFirst({ where: eq(user.email, email) }),
      `canonical seed User was deleted: ${email}`,
    ).not.toBeUndefined();
  }
});

describe("Organization country through Better Auth", () => {
  it("leaves Calculator multi-Organization creation enabled and uses the Owner creator role", async () => {
    const owner = await seedSession(SEED_OWNER_EMAIL);
    const first = await createOwnOrganization(owner.headers);
    const second = await createOwnOrganization(owner.headers);
    expect(second.id).not.toBe(first.id);
    const membership = await db.query.member.findFirst({
      where: eq(member.organizationId, second.id),
    });
    expect(membership?.role).toBe(ORGANIZATION_ROLES.OrganizationOwner);
  });

  it("rejects case-insensitive duplicate Organization names", async () => {
    const owner = await seedSession(SEED_OWNER_EMAIL);
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
    const owner = await seedSession(SEED_OWNER_EMAIL);
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
        where: eq(invitation.email, email),
      }),
    ).toBeUndefined();
  });

  it("accepts native array role grants without replacing combined authority", async () => {
    const owner = await seedSession(SEED_OWNER_EMAIL);
    const organization = await createOwnOrganization(owner.headers);
    const target = await seedSession(SEED_PARTICIPANT_EMAIL);
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
      (await db.query.member.findFirst({ where: eq(member.id, granted!.id) }))
        ?.role,
    ).toBe(roles.join(","));
  });

  it("refuses missing, lowercase and non-EU country, then persists the selected EU country", async () => {
    const owner = await seedSession(SEED_OWNER_EMAIL);
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
    const owner = await seedSession(SEED_OWNER_EMAIL);
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
    const outsider = await seedSession(SEED_OUTSIDER_EMAIL);
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
