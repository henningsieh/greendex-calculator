// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimsTable as claims,
  member,
  organization,
  principalQuotaCounters as counters,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
  proofDocumentsTable as documents,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as links,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ownedCleanup } from "@/__tests__/owned-cleanup.test-helper";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  delete: vi.fn(),
  cleanupExecutor: undefined as Pick<typeof db, "execute"> | undefined,
  session: vi.fn(),
  failInsert: false,
  failAfterPut: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/proof-storage", () => ({
  putProofFile: mocks.put,
  deleteProofFile: mocks.delete,
  getProofFile: vi.fn(),
}));
vi.mock("@greendex/database", async (original) => {
  const actual = await original<typeof import("@greendex/database")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, key) {
        if (key === "transaction")
          return (callback: Parameters<typeof actual.db.transaction>[0]) =>
            target.transaction(async (tx) => {
              const result = await callback(
                new Proxy(tx, {
                  get(transaction, property) {
                    if (property === "insert" && mocks.failInsert)
                      return (table: Parameters<typeof transaction.insert>[0]) =>
                        table === documents
                          ? {
                              values: () => ({
                                returning: () =>
                                  transaction.execute(sql`select 1 / 0`),
                              }),
                            }
                          : transaction.insert(table);
                    const value = Reflect.get(transaction, property, transaction);
                    return typeof value === "function"
                      ? value.bind(transaction)
                      : value;
                  },
                }),
              );
              if (mocks.failAfterPut && mocks.put.mock.calls.length > 0)
                await tx.execute(sql`select 1 / 0`);
              return result;
            });
        if (key === "execute")
          return ownedCleanup(mocks.cleanupExecutor ?? target, [partner, other])
            .execute;
        return Reflect.get(target, key);
      },
    }),
  };
});
import { POST } from "@/app/api/proof-documents/route";
import { env } from "@/env";
import { linkDocument } from "@/features/claims/procedures/costs";
import { uploadProofDocument } from "@/features/claims/procedures/documents";
import { list } from "@/features/claims/procedures/documents";
import { submit } from "@/features/claims/procedures/submission";
import { DAILY_UPLOAD_BYTES } from "@/features/quotas/procedures/counters";

const prefix = `upload-quota-${randomUUID()}`;
const actorId = `${prefix}-actor`;
const host = `${prefix}-host`;
const partner = `${prefix}-partner`;
const other = `${prefix}-other`;
const projectIds = [0, 1, 2].map((i) => `${prefix}-project-${i}`);
const partnershipIds = [0, 1, 2].map((i) => `${prefix}-partnership-${i}`);
const claimIds = [0, 1, 2].map((i) => `${prefix}-claim-${i}`);
const file = () =>
  new File(["%PDF-\n"], "receipt.pdf", { type: "application/pdf" });
const upload = (index = 0) =>
  uploadProofDocument({
    actorId,
    activeOrganizationId: index === 2 ? other : partner,
    partnershipId: partnershipIds[index],
    file: file(),
  });
const quotaRows = () =>
  db
    .select()
    .from(counters)
    .where(inArray(counters.organizationId, [partner, other]));
async function seed(used: number) {
  const start = new Date(Math.floor(Date.now() / 86400000) * 86400000);
  await db.insert(counters).values({
    kind: "upload_bytes",
    organizationId: partner,
    userKey: "",
    windowStart: start,
    expiresAt: new Date(start.getTime() + 86400000),
    used: BigInt(used),
  });
}

beforeAll(async () => {
  const target = new URL(process.env.DATABASE_URL!);
  if (
    target.hostname !== "188.245.144.137" ||
    target.port !== "5489" ||
    target.pathname !== "/greendex_development"
  )
    throw new Error("Unapproved upload test database");
  await db
    .insert(user)
    .values({ id: actorId, name: "Quota test", email: `${actorId}@example.com` });
  await db.insert(organization).values(
    [host, partner, other].map((id) => ({
      id,
      name: id,
      slug: id,
      country: "DE" as const,
      createdAt: new Date(),
    })),
  );
  await db.insert(member).values(
    [partner, other].map((organizationId) => ({
      id: randomUUID(),
      organizationId,
      userId: actorId,
      role: "owner",
      createdAt: new Date(),
    })),
  );
  await db.insert(projects).values(
    projectIds.map((id) => ({
      id,
      organizationId: host,
      name: id,
      startDate: new Date(),
      endDate: new Date(),
      location: "Berlin",
      country: "DE" as const,
    })),
  );
  await db.insert(partnerships).values(
    partnershipIds.map((id, i) => ({
      id,
      projectId: projectIds[i],
      organizationId: i === 2 ? other : partner,
    })),
  );
  await db
    .insert(claims)
    .values(claimIds.map((id, i) => ({ id, partnershipId: partnershipIds[i] })));
});
beforeEach(async () => {
  mocks.failInsert = false;
  mocks.failAfterPut = false;
  mocks.delete.mockReset().mockResolvedValue(undefined);
  mocks.put.mockReset().mockResolvedValue(undefined);
  mocks.session.mockResolvedValue({
    user: { id: actorId },
    session: { activeOrganizationId: partner },
  });
  await db.delete(documents).where(inArray(documents.claimId, claimIds));
  await db.delete(entries).where(inArray(entries.claimId, claimIds));
  await db
    .update(claims)
    .set({ status: "editable" })
    .where(inArray(claims.id, claimIds));
  await db
    .delete(counters)
    .where(inArray(counters.organizationId, [partner, other]));
});
afterAll(async () => {
  await db.delete(projects).where(inArray(projects.id, projectIds));
  await db
    .delete(organization)
    .where(inArray(organization.id, [host, partner, other]));
  await db.delete(user).where(eq(user.id, actorId));
  await db
    .delete(counters)
    .where(inArray(counters.organizationId, [partner, other]));
});

describe("Proof upload Organization daily consumption", () => {
  it("restricts automatic cleanup to this file's fixture Organizations", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`create temporary table principal_quota_counters (like public.principal_quota_counters including all) on commit drop`,
      );
      await tx.execute(
        sql`insert into principal_quota_counters values
          ('listing_calls', ${partner}, 'expired', '2000-01-01', '2000-01-02', 1),
          ('listing_calls', 'unrelated-fixture', 'expired', '2000-01-01', '2000-01-02', 1)`,
      );
      mocks.cleanupExecutor = tx;
      try {
        await upload();
        expect((await quotaRows()).map((row) => row.used)).toEqual([6n]);
        const remaining = await tx.execute(
          sql`select organization_id from principal_quota_counters`,
        );
        expect(remaining.rows).toEqual([
          { organization_id: "unrelated-fixture" },
        ]);
      } finally {
        mocks.cleanupExecutor = undefined;
      }
    });
  });
  it("serializes simultaneous uploads to different Claims at the exact byte boundary", async () => {
    await seed(DAILY_UPLOAD_BYTES - 6);
    const result = await Promise.allSettled([
      upload(0),
      upload(1),
      upload(0),
      upload(1),
    ]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = result.filter((item) => item.status === "rejected");
    expect(rejected).toHaveLength(3);
    for (const item of rejected)
      expect(item.reason).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        data: { reason: "PROOF_DAILY_QUOTA_EXCEEDED" },
      });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(
      (
        await db
          .select()
          .from(documents)
          .where(inArray(documents.claimId, claimIds))
      ).map((row) => row.byteSize),
    ).toEqual([6]);
    expect((await quotaRows())[0].used).toBe(524288000n);
    await upload(2);
    expect(
      (await quotaRows())
        .map((row) => row.used)
        .sort((left, right) => Number(left - right)),
    ).toEqual([6n, 524288000n]);
  });
  it("creates one shared counter for concurrent first uploads across Claims", async () => {
    await Promise.all([upload(0), upload(1)]);
    expect((await quotaRows()).map((row) => row.used)).toEqual([12n]);
    expect(mocks.put).toHaveBeenCalledTimes(2);
  });
  it("does not refund successfully persisted bytes when a document is deleted", async () => {
    await seed(DAILY_UPLOAD_BYTES - 6);
    const saved = await upload();
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, saved.document.id),
          eq(documents.claimId, claimIds[0]),
        ),
      );
    await expect(upload(1)).rejects.toMatchObject({
      data: { reason: "PROOF_DAILY_QUOTA_EXCEEDED" },
    });
    expect((await quotaRows())[0].used).toBe(524288000n);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });
  it("keeps the committed usage but removes the document after storage failure", async () => {
    mocks.put.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(upload()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { reason: "PROOF_UPLOAD_FAILED" },
    });
    expect((await quotaRows())[0].used).toBe(6n);
    expect(
      await db
        .select()
        .from(documents)
        .where(inArray(documents.claimId, claimIds)),
    ).toEqual([]);
    expect(mocks.delete).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
  });
  it("removes the stored object if database finalization rolls back after PUT", async () => {
    mocks.failAfterPut = true;
    await expect(upload()).rejects.toMatchObject({ cause: { code: "22012" } });
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.delete).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
    expect((await quotaRows())[0].used).toBe(6n);
    expect(
      await db.select().from(documents).where(eq(documents.claimId, claimIds[0])),
    ).toEqual([]);
  });
  it("does not hold the shared Organization quota lock while storage is pending", async () => {
    const started = Promise.withResolvers<void>();
    const storage = Promise.withResolvers<void>();
    mocks.put.mockImplementationOnce(() => {
      started.resolve();
      return storage.promise;
    });
    const first = upload(0);
    const firstResult = Promise.allSettled([first]);
    await started.promise;
    const second = upload(1);
    const secondResult = Promise.allSettled([second]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        second,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error("A pending upload blocked another Claim's quota")),
            3_000,
          );
        }),
      ]);
      expect((await quotaRows())[0].used).toBe(12n);
    } finally {
      clearTimeout(timer);
      storage.resolve();
      await Promise.all([firstResult, secondResult]);
    }
    expect(await firstResult).toMatchObject([{ status: "fulfilled" }]);
  });
  it("refuses publication if the Claim was submitted while storage was pending", async () => {
    const started = Promise.withResolvers<void>();
    const storage = Promise.withResolvers<void>();
    mocks.put.mockImplementationOnce(() => {
      started.resolve();
      return storage.promise;
    });
    const result = Promise.allSettled([upload()]);
    await started.promise;
    try {
      await db
        .update(claims)
        .set({ status: "submitted" })
        .where(eq(claims.id, claimIds[0]));
    } finally {
      storage.resolve();
      await result;
    }
    expect(await result).toMatchObject([
      {
        status: "rejected",
        reason: { data: { reason: "CLAIM_NOT_EDITABLE" } },
      },
    ]);
    expect(mocks.delete).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
    expect(
      await db.select().from(documents).where(eq(documents.claimId, claimIds[0])),
    ).toEqual([]);
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimIds[0])))[0]
        .status,
    ).toBe("submitted");
  });
  it("rechecks the per-Claim quota when two pending uploads compete for the last document slot", async () => {
    await db.insert(documents).values(
      Array.from({ length: 24 }, (_, i) => ({
        claimId: claimIds[0],
        fileReference: `${prefix}/existing-${i}`,
        originalFileName: `existing-${i}.pdf`,
        mediaType: "application/pdf",
        byteSize: 6,
        checksum: "fixture",
      })),
    );
    const started = Promise.withResolvers<void>();
    const storage = Promise.withResolvers<void>();
    let pending = 0;
    mocks.put.mockImplementation(() => {
      if (++pending === 2) started.resolve();
      return storage.promise;
    });
    const results = Promise.allSettled([upload(), upload()]);
    try {
      await started.promise;
    } finally {
      storage.resolve();
      await results;
    }
    const outcomes = await results;
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toMatchObject([
      {
        reason: { data: { reason: "PROOF_QUOTA_EXCEEDED" } },
      },
    ]);
    expect(
      await db.select().from(documents).where(eq(documents.claimId, claimIds[0])),
    ).toHaveLength(25);
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect((await quotaRows())[0].used).toBe(12n);
  });
  it("never exposes a pending proof to concurrent linking and submission when storage fails", async () => {
    const client = createRouterClient(
      { list, linkDocument, submit },
      { context: { headers: new Headers() } },
    );
    const [entry] = await db
      .insert(entries)
      .values({
        claimId: claimIds[0],
        transportProfile: "train",
        amountEur: "10.00",
        allocationMethod: "equal",
      })
      .returning({ id: entries.id });
    const started = Promise.withResolvers<void>();
    const storage = Promise.withResolvers<void>();
    mocks.put.mockImplementationOnce(() => {
      started.resolve();
      return storage.promise;
    });
    const uploading = upload();
    const uploadResult = Promise.allSettled([uploading]);
    await started.promise;
    let concurrent;
    try {
      const visible = await client.list({ partnershipId: partnershipIds[0] });
      concurrent = Promise.allSettled([
        client.linkDocument({
          partnershipId: partnershipIds[0],
          entryId: entry.id,
          proofDocumentId: visible[0]?.id ?? "unpublished-proof",
        }),
        client.submit({ partnershipId: partnershipIds[0] }),
      ]);
      expect(visible).toEqual([]);
    } finally {
      storage.reject(new Error("storage unavailable"));
      await uploadResult;
      if (concurrent) await concurrent;
    }
    expect(await uploadResult).toMatchObject([
      {
        status: "rejected",
        reason: { data: { reason: "PROOF_UPLOAD_FAILED" } },
      },
    ]);
    expect(await concurrent).toMatchObject([
      {
        status: "rejected",
        reason: { data: { reason: "CLAIM_DOCUMENT_REFERENCES_REQUIRED" } },
      },
      {
        status: "rejected",
        reason: { data: { reason: "CLAIM_SUBMISSION_INCOMPLETE" } },
      },
    ]);
    expect(await client.list({ partnershipId: partnershipIds[0] })).toEqual([]);
    expect(
      await db.select().from(links).where(eq(links.travelCostEntryId, entry.id)),
    ).toEqual([]);
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimIds[0])))[0]
        .status,
    ).toBe("editable");
  });
  it("removes the stored file and retains attempted bytes when document insertion fails", async () => {
    await seed(0);
    mocks.failInsert = true;
    await expect(upload()).rejects.toMatchObject({ cause: { code: "22012" } });
    expect((await quotaRows())[0].used).toBe(6n);
    expect(
      await db
        .select()
        .from(documents)
        .where(inArray(documents.claimId, claimIds)),
    ).toEqual([]);
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.delete).toHaveBeenCalledWith(mocks.put.mock.calls[0][0]);
  });
  it("returns a safe HTTP 429 body with no usage or principal identifiers", async () => {
    await seed(DAILY_UPLOAD_BYTES);
    const body = new FormData();
    body.set("partnershipId", partnershipIds[0]);
    body.set("file", file());
    const origin = new URL(env.NEXT_PUBLIC_BASE_URL).origin;
    const response = await POST(
      new Request(`${origin}/api/proof-documents`, {
        method: "POST",
        headers: { origin },
        body,
      }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error:
        "The daily Proof Document upload allowance is exhausted. It resets at 00:00 UTC.",
      code: "TOO_MANY_REQUESTS",
      reason: "PROOF_DAILY_QUOTA_EXCEEDED",
    });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
