// @vitest-environment node
import { randomUUID } from "node:crypto";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  costAllocationsTable as allocations,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  proofDocumentsTable as documents,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  travelCostEntriesTable as entries,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq } from "drizzle-orm";
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
  put: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/proof-storage", () => ({
  putProofFile: authMocks.put,
  getProofFile: authMocks.get,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { GET as download, POST as upload } from "@/app/api/proof-documents/route";
import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const id = (part: string) => `cost-${part}-${suffix}`;
const host = id("host"),
  partner = id("partner"),
  other = id("other");
const coordinator = id("coordinator"),
  participantUser = id("user");
const project = id("project"),
  secondProject = id("second-project");
const own = id("own"),
  foreign = id("foreign"),
  next = id("next");
const first = id("first"),
  second = id("second"),
  third = id("third");
const outside = id("outside"),
  later = id("later");
const ownClaim = id("claim"),
  foreignClaim = id("foreign-claim");
const proof = id("proof"),
  foreignProof = id("foreign-proof");
let actor = coordinator;
let activeOrg = partner;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const base = {
  partnershipId: own,
  transportProfile: "train" as const,
  amountEur: "10.00",
  allocationMethod: "equal" as const,
  allocations: [first, second, third].map((projectParticipantId) => ({
    projectParticipantId,
  })),
};

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: coordinator,
      name: "Coordinator",
      email: `${coordinator}@example.org`,
      emailVerified: true,
    },
    {
      id: participantUser,
      name: "Participant",
      email: `${participantUser}@example.org`,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values([
    { id: host, name: "Host", slug: host, createdAt: now },
    { id: partner, name: "Partner", slug: partner, createdAt: now },
    { id: other, name: "Other", slug: other, createdAt: now },
  ]);
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: partner,
      role: "project-coordinator",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participantUser,
      organizationId: partner,
      role: "participant",
      createdAt: now,
    },
  ]);
  await db.insert(projects).values(
    [project, secondProject].map((projectId) => ({
      id: projectId,
      name: "Project",
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV" as const,
      organizationId: host,
    })),
  );
  await db
    .insert(hostAssignments)
    .values({ projectId: project, userId: coordinator });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
    { id: next, projectId: secondProject, organizationId: partner },
  ]);
  await db.insert(assignments).values([
    { partnershipId: own, userId: coordinator },
    { partnershipId: next, userId: coordinator },
  ]);
  await db.insert(participants).values([
    ...[first, second, third].map((participantId) => ({
      id: participantId,
      projectId: project,
      representedOrganizationId: partner,
      displayName: participantId,
    })),
    {
      id: outside,
      projectId: project,
      representedOrganizationId: other,
      displayName: "Outside",
    },
    {
      id: later,
      projectId: secondProject,
      representedOrganizationId: partner,
      displayName: "Later",
    },
  ]);
  await db.insert(claims).values([
    { id: ownClaim, partnershipId: own },
    { id: foreignClaim, partnershipId: foreign },
  ]);
  await db.insert(documents).values(
    [ownClaim, foreignClaim].map((claimId, index) => ({
      id: index === 0 ? proof : foreignProof,
      claimId,
      fileReference: `test/${claimId}`,
      originalFileName: "ticket.pdf",
      mediaType: "application/pdf",
      byteSize: 4,
      checksum: "test-checksum",
    })),
  );
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(async () => {
  actor = coordinator;
  activeOrg = partner;
  await db.delete(entries).where(eq(entries.claimId, ownClaim));
  await db
    .delete(documents)
    .where(
      and(
        eq(documents.claimId, ownClaim),
        eq(documents.originalFileName, "uploaded.pdf"),
      ),
    );
  authMocks.put.mockReset().mockResolvedValue(undefined);
  authMocks.get.mockReset();
});

afterAll(async () => {
  await db.delete(claims).where(eq(claims.id, ownClaim));
  await db.delete(claims).where(eq(claims.id, foreignClaim));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(participants).where(eq(participants.projectId, secondProject));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(assignments).where(eq(assignments.partnershipId, next));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(partnerships).where(eq(partnerships.projectId, secondProject));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(projects).where(eq(projects.id, secondProject));
  await db.delete(member).where(eq(member.organizationId, partner));
  for (const orgId of [other, partner, host])
    await db.delete(organization).where(eq(organization.id, orgId));
  for (const userId of [participantUser, coordinator])
    await db.delete(user).where(eq(user.id, userId));
});

describe("Claim cost procedures", () => {
  it("lists only Claim-scoped Proof Documents and refuses foreign Partnerships", async () => {
    expect(
      (await client.documents.list({ partnershipId: own })).map(
        (item) => item.id,
      ),
    ).toEqual([proof]);
    expect(await client.documents.list({ partnershipId: next })).toEqual([]);
    await expect(
      client.documents.list({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("uploads only to an editable Claim with authenticated Partner scope", async () => {
    function request(partnershipId: string, origin = "https://test.example") {
      const data = new FormData();
      data.set("partnershipId", partnershipId);
      data.set(
        "file",
        new File(["test"], "uploaded.pdf", { type: "application/pdf" }),
      );
      return new Request("https://test.example/api/proof-documents", {
        method: "POST",
        headers: { origin },
        body: data,
      });
    }
    expect((await upload(request(own, "https://foreign.example"))).status).toBe(
      403,
    );
    expect(authMocks.put).not.toHaveBeenCalled();
    authMocks.getSession.mockResolvedValueOnce(null);
    expect((await upload(request(own))).status).toBe(401);
    expect((await upload(request(next))).status).toBe(400);
    expect((await upload(request(foreign))).status).toBe(403);
    const response = await upload(request(own));
    expect(response.status).toBe(201);
    expect(authMocks.put).toHaveBeenCalledWith(
      expect.stringContaining(`claims/${partner}/${ownClaim}/`),
      expect.any(Uint8Array),
      "application/pdf",
    );
    const body = await response.json();
    expect(
      (await client.documents.list({ partnershipId: own })).map(
        (item) => item.id,
      ),
    ).toContain(body.id);
    expect(
      (await client.documents.list({ partnershipId: next })).map(
        (item) => item.id,
      ),
    ).not.toContain(body.id);
    actor = participantUser;
    expect((await upload(request(own))).status).toBe(403);
    actor = coordinator;
    await db
      .update(claims)
      .set({ status: "submitted" })
      .where(eq(claims.id, ownClaim));
    try {
      expect((await upload(request(own))).status).toBe(400);
      expect(authMocks.put).toHaveBeenCalledTimes(1);
    } finally {
      await db
        .update(claims)
        .set({ status: "editable" })
        .where(eq(claims.id, ownClaim));
    }
  });
  it("downloads identical uploaded bytes only for the authorized Claim Partnership", async () => {
    const bytes = new Uint8Array([0, 255, 37, 10, 128]);
    const data = new FormData();
    data.set("partnershipId", own);
    data.set(
      "file",
      new File([bytes], "uploaded.pdf", { type: "application/pdf" }),
    );
    const uploaded = await upload(
      new Request("https://test.example/api/proof-documents", {
        method: "POST",
        headers: { origin: "https://test.example" },
        body: data,
      }),
    );
    expect(uploaded.status).toBe(201);
    const { id: documentId } = await uploaded.json();
    const [reference, storedBytes] = authMocks.put.mock.lastCall!;
    authMocks.get.mockImplementation(async (key: string) => {
      expect(key).toBe(reference);
      return storedBytes;
    });
    const request = (partnershipId: string, id = documentId) =>
      new Request(
        `https://test.example/api/proof-documents?${new URLSearchParams({ partnershipId, documentId: id })}`,
      );
    authMocks.getSession.mockResolvedValueOnce(null);
    expect((await download(request(own))).status).toBe(401);
    expect((await download(request(foreign))).status).toBe(403);
    expect((await download(request(next))).status).toBe(404);
    expect((await download(request(own, foreignProof))).status).toBe(404);
    actor = participantUser;
    expect((await download(request(own))).status).toBe(403);
    actor = coordinator;
    activeOrg = other;
    expect((await download(request(own))).status).toBe(403);
    activeOrg = partner;
    expect(authMocks.get).not.toHaveBeenCalled();
    const response = await download(request(own));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("uploaded.pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(authMocks.get).toHaveBeenCalledTimes(1);
  });

  it("keeps one real group total and derives equal cents that sum exactly to it", async () => {
    const saved = await client.costs.save(base);
    expect(saved.allocations.map((row) => row.amountEur)).toEqual([
      "3.34",
      "3.33",
      "3.33",
    ]);
    expect(saved.amountEur).toBe("10.00");
    expect(
      await db.select().from(entries).where(eq(entries.id, saved.id)),
    ).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(allocations)
          .where(eq(allocations.travelCostEntryId, saved.id))
      ).every((row) => row.amountEur === null && row.percentage === null),
    ).toBe(true);
    const view = await client.costs.list({ partnershipId: own });
    expect(view.coveredProjectParticipantIds).toEqual([first, second, third]);
    expect(
      view.entries
        .find((entry) => entry.id === saved.id)
        ?.allocations.map((row) => row.amountEur),
    ).toEqual(["3.34", "3.33", "3.33"]);
    expect(saved.proofDocumentIds).toEqual([]);
    await client.costs.linkDocument({
      partnershipId: own,
      entryId: saved.id,
      proofDocumentId: proof,
    });
    expect(
      (await client.costs.list({ partnershipId: own })).entries.find(
        (entry) => entry.id === saved.id,
      )?.proofDocumentIds,
    ).toEqual([proof]);
  });

  it("saves exact percentages and amounts, then replaces allocations without duplicating cost", async () => {
    const percentages = await client.costs.save({
      ...base,
      allocationMethod: "percentage",
      allocations: [
        { projectParticipantId: first, percentage: "33.333333" },
        { projectParticipantId: second, percentage: "66.666667" },
      ],
    });
    expect(percentages.allocations.map((row) => row.percentage)).toEqual([
      "33.333333",
      "66.666667",
    ]);
    const amounts = await client.costs.save({
      ...base,
      allocationMethod: "amount",
      allocations: [
        { projectParticipantId: first, amountEur: "3.33" },
        { projectParticipantId: second, amountEur: "6.67" },
      ],
    });
    expect(amounts.allocations.map((row) => row.amountEur)).toEqual([
      "3.33",
      "6.67",
    ]);
    const updated = await client.costs.save({
      ...base,
      entryId: amounts.id,
      allocations: [{ projectParticipantId: third }],
    });
    expect(updated.id).toBe(amounts.id);
    expect(updated.allocations).toHaveLength(1);
    expect(
      (await client.costs.list({ partnershipId: own }))
        .coveredProjectParticipantIds,
    ).toEqual([first, second, third]);
    expect(
      await db
        .select()
        .from(allocations)
        .where(eq(allocations.travelCostEntryId, amounts.id)),
    ).toHaveLength(1);
  });

  it("rejects missing, nonpositive, mixed, duplicate, and wrong totals with itemized errors", async () => {
    for (const patch of [
      { amountEur: "0" },
      { amountEur: "-1" },
      { amountEur: undefined },
      { allocations: [] },
      {
        allocations: [
          { projectParticipantId: first },
          { projectParticipantId: first },
        ],
      },
      {
        allocationMethod: "equal",
        allocations: [{ projectParticipantId: first, percentage: "100" }],
      },
      {
        allocationMethod: "percentage",
        allocations: [{ projectParticipantId: first, percentage: "50" }],
      },
      {
        allocationMethod: "percentage",
        allocations: [{ projectParticipantId: first, amountEur: "10.00" }],
      },
      {
        allocationMethod: "amount",
        allocations: [{ projectParticipantId: first, amountEur: "9.99" }],
      },
      {
        allocationMethod: "amount",
        allocations: [{ projectParticipantId: first, amountEur: "0" }],
      },
      { transportProfile: "not-configured" },
    ]) {
      await expect(
        client.costs.save({ ...base, ...patch } as typeof base),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      client.costs.save({
        ...base,
        allocationMethod: "amount",
        allocations: [
          { projectParticipantId: first, amountEur: "4.00" },
          { projectParticipantId: second, percentage: "60" },
        ],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["allocations", 1] }),
          expect.objectContaining({ path: ["allocations"] }),
        ]),
      },
    });
    expect(
      await db.select().from(entries).where(eq(entries.claimId, ownClaim)),
    ).toHaveLength(0);
  });

  it("requires a previously saved Claim and validates transport against live config", async () => {
    await expect(
      client.costs.save({ ...base, partnershipId: next }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const profiles =
      PARTICIPANT_TRANSPORT_EMISSION_PROFILES as unknown as string[];
    const index = profiles.indexOf("train");
    profiles.splice(index, 1);
    try {
      await expect(client.costs.save(base)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: ["transportProfile"] }),
          ]),
        },
      });
    } finally {
      profiles.splice(index, 0, "train");
    }
  });

  it("denies cross-Project, cross-Partnership, cross-Claim links and locked writes", async () => {
    for (const projectParticipantId of [outside, later]) {
      await expect(
        client.costs.save({ ...base, allocations: [{ projectParticipantId }] }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    const saved = await client.costs.save(base);
    await expect(
      client.costs.linkDocument({
        partnershipId: own,
        entryId: saved.id,
        proofDocumentId: foreignProof,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.costs.linkDocument({
        partnershipId: foreign,
        entryId: saved.id,
        proofDocumentId: proof,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db
      .update(claims)
      .set({ status: "submitted" })
      .where(eq(claims.id, ownClaim));
    try {
      await expect(client.costs.save(base)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(
        client.costs.linkDocument({
          partnershipId: own,
          entryId: saved.id,
          proofDocumentId: proof,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    } finally {
      await db
        .update(claims)
        .set({ status: "editable" })
        .where(eq(claims.id, ownClaim));
    }
    actor = participantUser;
    await expect(client.costs.save(base)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    activeOrg = host;
    await expect(client.costs.save(base)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    actor = coordinator;
    activeOrg = partner;
    await expect(
      client.costs.list({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
