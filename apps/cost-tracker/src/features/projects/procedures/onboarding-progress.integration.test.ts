// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantProfilesTable as profiles,
  partnerCoordinatorAssignmentsTable as assignments,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { createOnboardingProgressProcedure } from "@/features/projects/procedures/onboarding-progress";

const suffix = randomUUID();
const host = `progress-host-${suffix}`;
const partner = `progress-partner-${suffix}`;
const other = `progress-other-${suffix}`;
const project = `progress-project-${suffix}`;
const own = `progress-own-${suffix}`;
const foreign = `progress-foreign-${suffix}`;
const coordinator = `progress-coordinator-${suffix}`;
const joined = `progress-joined-${suffix}`;
const pending = `progress-pending-${suffix}`;
const revoked = `progress-revoked-${suffix}`;
const outsider = `progress-outsider-${suffix}`;
const mail = (key: string) => `${key}-${suffix}@example.org`;
const version = { id: "fixture-v2", contentHash: "fixture-hash-v2" };
let actor = coordinator;
let activeOrg = partner;
let agreement = version;
const client = createRouterClient(
  { progress: createOnboardingProgressProcedure(() => agreement) },
  { context: async () => ({ headers: new Headers() }) },
);

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values(
    [coordinator, joined, pending, revoked, outsider].map((id) => ({
      id,
      name: id,
      email: mail(id),
      emailVerified: true,
    })),
  );
  await db.insert(organization).values(
    [host, partner, other].map((id) => ({ country: "DE" as const,
      id,
      name: id,
      slug: id,
      createdAt: now,
    })),
  );
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: partner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: joined,
      organizationId: host,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: joined,
      organizationId: partner,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: outsider,
      organizationId: host,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
  ]);
  await db.insert(projects).values({
    id: project,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: host,
  });
  await db
    .insert(hostAssignments)
    .values({ projectId: project, userId: coordinator });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
  ]);
  await db.insert(assignments).values([
    { partnershipId: own, userId: coordinator },
    { partnershipId: own, userId: joined },
  ]);
  await db.insert(profiles).values([
    { userId: joined, fullName: "Joined" },
    { userId: pending, fullName: "Pending" },
    { userId: outsider, fullName: "Outsider" },
  ]);
  await db.insert(acceptances).values([
    {
      userId: joined,
      version: version.id,
      contentHash: version.contentHash,
      answers: '{"accepted":true}',
    },
    {
      userId: pending,
      version: "fixture-v1",
      contentHash: "old-hash",
      answers: '{"accepted":true}',
    },
    {
      userId: outsider,
      version: version.id,
      contentHash: version.contentHash,
      answers: '{"accepted":true}',
    },
  ]);
  await db.insert(participants).values([
    {
      projectId: project,
      representedOrganizationId: partner,
      userId: joined,
      email: mail(joined),
      displayName: "Joined",
    },
    {
      projectId: project,
      representedOrganizationId: other,
      userId: outsider,
      email: mail(outsider),
      displayName: "Outsider",
    },
    {
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Unlinked",
    },
  ]);
  const invites = [
    {
      id: `old-${suffix}`,
      email: mail(pending),
      status: "revoked",
      partnershipId: own,
      issuedAt: new Date(now.getTime() - 10000),
    },
    {
      id: `new-${suffix}`,
      email: mail(pending),
      status: "pending",
      partnershipId: own,
      issuedAt: now,
    },
    {
      id: `joined-${suffix}`,
      email: mail(joined),
      status: "pending",
      partnershipId: own,
      issuedAt: now,
    },
    {
      id: `revoked-${suffix}`,
      email: mail(revoked),
      status: "revoked",
      partnershipId: own,
      issuedAt: now,
    },
    {
      id: `outside-${suffix}`,
      email: mail(outsider),
      status: "pending",
      partnershipId: foreign,
      issuedAt: now,
    },
  ];
  await db.insert(entryTokens).values(
    invites.map(({ id, email, status, partnershipId, issuedAt }) => ({
      id,
      email,
      status,
      secretHash: "fixture-secret-hash",
      partnershipId,
      projectId: project,
      expiresAt: new Date(now.getTime() + 600000),
      issuedByUserId: coordinator,
      issuedAt,
    })),
  );
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

afterAll(async () => {
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(participants).where(eq(participants.projectId, project));
  for (const id of [joined, pending, outsider]) {
    await db.delete(acceptances).where(eq(acceptances.userId, id));
    await db.delete(profiles).where(eq(profiles.userId, id));
  }
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(projects).where(eq(projects.id, project));
  for (const id of [host, partner, other]) {
    await db.delete(member).where(eq(member.organizationId, id));
    await db.delete(organization).where(eq(organization.id, id));
  }
  for (const id of [coordinator, joined, pending, revoked, outsider])
    await db.delete(user).where(eq(user.id, id));
});

describe("Partner invitee onboarding progress", () => {
  it("deduplicates reissues, joins and revoked history without exposing another Partnership", async () => {
    const rows = await client.progress({ partnershipId: own });
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.email === null)).toMatchObject({
      participationId: expect.any(String),
      participation: "joined",
      profile: "missing",
      agreement: "missing",
      membership: "missing",
      bridge: "none",
    });
    expect(rows.find((row) => row.email === mail(joined))).toMatchObject({
      participationId: expect.any(String),
      participation: "joined",
      profile: "complete",
      agreement: "current",
      membership: ORGANIZATION_ROLES.Participant,
      bridge: "pending",
    });
    expect(rows.find((row) => row.email === mail(pending))).toMatchObject({
      participationId: null,
      participation: "not-joined",
      invitationId: `new-${suffix}`,
      profile: "complete",
      agreement: "outdated",
      membership: "missing",
      bridge: "pending",
    });
    expect(rows.find((row) => row.email === mail(revoked))).toMatchObject({
      profile: "missing",
      agreement: "missing",
      membership: "missing",
      bridge: "revoked",
    });
    expect(rows.some((row) => row.email === mail(outsider))).toBe(false);
  });

  it("does not claim an unpublished agreement is current", async () => {
    agreement = { id: "PENDING-LEGAL-001", contentHash: "" };
    try {
      const rows = await client.progress({ partnershipId: own });
      expect(rows.find((row) => row.email === mail(joined))?.agreement).toBe(
        "unavailable",
      );
      expect(rows.find((row) => row.email === mail(pending))?.agreement).toBe(
        "unavailable",
      );
    } finally {
      agreement = version;
    }
  });

  it("requires the current content hash and reports expired invitations", async () => {
    await db
      .update(acceptances)
      .set({ contentHash: "superseded-hash" })
      .where(eq(acceptances.userId, joined));
    await db
      .update(entryTokens)
      .set({ expiresAt: new Date(0) })
      .where(eq(entryTokens.id, `new-${suffix}`));
    try {
      const rows = await client.progress({ partnershipId: own });
      expect(rows.find((row) => row.email === mail(joined))?.agreement).toBe(
        "outdated",
      );
      expect(rows.find((row) => row.email === mail(pending))?.bridge).toBe(
        "expired",
      );
    } finally {
      await db
        .update(acceptances)
        .set({ contentHash: version.contentHash })
        .where(eq(acceptances.userId, joined));
      await db
        .update(entryTokens)
        .set({ expiresAt: new Date(Date.now() + 600000) })
        .where(eq(entryTokens.id, `new-${suffix}`));
    }
  });

  it("denies foreign scope, Host-side access and Participants", async () => {
    await expect(
      client.progress({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(client.progress({ partnershipId: own })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    activeOrg = partner;
    actor = joined;
    await expect(client.progress({ partnershipId: own })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    actor = coordinator;
  });
});
