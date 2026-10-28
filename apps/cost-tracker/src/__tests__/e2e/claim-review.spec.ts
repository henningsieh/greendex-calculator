import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantJourneysTable as journeys,
  participantProfilesTable as profiles,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as payoutAccounts,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  proofDocumentsTable as documents,
  session,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as entryDocuments,
  user,
} from "@greendex/database/schema";
import { type Browser, type BrowserContext } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray } from "drizzle-orm";

import { env } from "@/env";
import { CURRENT_PARTICIPANT_AGREEMENT_VERSION } from "@/features/participant-onboarding/participant-agreement";

import {
  expectPrivateURL,
  expect,
  test,
  registerPrivateValues,
} from "./fixtures/artifact-privacy";
import { postSignInWithRateLimitRetry } from "./fixtures/rate-limit-retry";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: beforeAll inserts verified disposable Users and credentials,
// Hosting/Partner Organizations and memberships, one Project, two Project Partnerships,
// joined Project Participations, frozen funding rules, Participant Journeys, Payout
// Account references, submitted Claims, exact Travel Cost Entries/Cost Allocations,
// synthetic Proof Document metadata and submission history. These are prerequisites,
// not browser evidence for cases 20–24. No browser mail-producing form is submitted.
// Unique synthetic PDF bytes are seeded in S3 and deleted with the fixture;
// Hosting review download is real browser evidence, not a mocked byte response.
// The test-only payout reference is deliberately NOT an IBAN or bank account.
// Case 27 is NOT-RUN: no transfer or paid marking is authorized.
const suffix = randomUUID();
const ids = {
  host: randomUUID(),
  project: randomUUID(),
  partners: [randomUUID(), randomUUID()],
  partnerships: [randomUUID(), randomUUID()],
  participants: [randomUUID(), randomUUID()],
  participantUsers: [randomUUID(), randomUUID()],
  claims: [randomUUID(), randomUUID()],
  entries: [randomUUID(), randomUUID()],
  documents: [randomUUID(), randomUUID()],
  payoutAccounts: [randomUUID(), randomUUID()],
};
const actors = Object.fromEntries(
  (["H", "P", "F"] as const).map((code) => [
    code,
    {
      id: randomUUID(),
      email: `ct-${suffix}-${code.toLowerCase()}@example.invalid`,
      name: `CT ${suffix} ${code}`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "H" | "P" | "F",
  { id: string; email: string; name: string; password: string }
>;
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));
const projectName = `CT ${suffix} Main`;
const partnerNames = [`CT ${suffix} Partner A`, `CT ${suffix} Partner B`];
const personNames = [`CT ${suffix} Participant A`, `CT ${suffix} Participant B`];
const proofNames = [`proof-${suffix}-a.pdf`, `proof-${suffix}-b.pdf`];
const proofBytes = Buffer.from(
  "%PDF-1.4\n% Disposable journey Proof Document\n%%EOF\n",
);
const proofReferences = ids.documents.map(
  (id) => `journey-tests/${suffix}/${id}`,
);
const uploadedReferences = new Set<string>();
const storage = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});
const correctionReason = `Correct the origin for ${personNames[0]}`;
const rejectionReason = `Ineligible funding for ${partnerNames[1]}`;
const contexts: BrowserContext[] = [];
let baseline: Awaited<ReturnType<typeof counts>>;
let reviewURL: string;

async function counts() {
  const actorIds = [
    ...Object.values(actors).map((actor) => actor.id),
    ...ids.participantUsers,
  ];
  const queries = [
    db.select({ value: count() }).from(user).where(inArray(user.id, actorIds)),
    db
      .select({ value: count() })
      .from(account)
      .where(inArray(account.userId, actorIds)),
    db
      .select({ value: count() })
      .from(session)
      .where(inArray(session.userId, actorIds)),
    db
      .select({ value: count() })
      .from(organization)
      .where(inArray(organization.id, [ids.host, ...ids.partners])),
    db
      .select({ value: count() })
      .from(member)
      .where(inArray(member.organizationId, [ids.host, ...ids.partners])),
    db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.id, ids.project)),
    db
      .select({ value: count() })
      .from(partnerships)
      .where(inArray(partnerships.id, ids.partnerships)),
    db
      .select({ value: count() })
      .from(participants)
      .where(inArray(participants.id, ids.participants)),
    db
      .select({ value: count() })
      .from(journeys)
      .where(inArray(journeys.projectParticipantId, ids.participants)),
    db
      .select({ value: count() })
      .from(profiles)
      .where(inArray(profiles.userId, ids.participantUsers)),
    db
      .select({ value: count() })
      .from(acceptances)
      .where(inArray(acceptances.userId, ids.participantUsers)),
    db
      .select({ value: count() })
      .from(snapshots)
      .where(eq(snapshots.projectId, ids.project)),
    db
      .select({ value: count() })
      .from(bands)
      .where(eq(bands.projectId, ids.project)),
    db
      .select({ value: count() })
      .from(payoutAccounts)
      .where(inArray(payoutAccounts.id, ids.payoutAccounts)),
    db
      .select({ value: count() })
      .from(selections)
      .where(inArray(selections.partnershipId, ids.partnerships)),
    db
      .select({ value: count() })
      .from(claims)
      .where(inArray(claims.id, ids.claims)),
    db
      .select({ value: count() })
      .from(entries)
      .where(inArray(entries.id, ids.entries)),
    db
      .select({ value: count() })
      .from(allocations)
      .where(inArray(allocations.travelCostEntryId, ids.entries)),
    db
      .select({ value: count() })
      .from(documents)
      .where(inArray(documents.id, ids.documents)),
    db
      .select({ value: count() })
      .from(entryDocuments)
      .where(inArray(entryDocuments.travelCostEntryId, ids.entries)),
    db
      .select({ value: count() })
      .from(history)
      .where(inArray(history.claimId, ids.claims)),
  ];
  return Promise.all(queries.map(async (query) => (await query)[0]!.value));
}

async function pageFor(
  browser: Browser,
  actor: keyof typeof actors,
  baseURL: string,
) {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  contexts.push(context);
  const response = await postSignInWithRateLimitRetry(
    context.request,
    actors[actor].email,
    actors[actor].password,
  );
  expect(response.ok(), `${actor} setup sign-in`).toBe(true);
  return context.newPage();
}

async function claimState(index: number) {
  const [claim] = await db
    .select({
      status: claims.status,
      approvedAmountEur: claims.approvedAmountEur,
    })
    .from(claims)
    .where(eq(claims.id, ids.claims[index]!));
  return claim;
}

async function events(index: number) {
  return db
    .select({
      eventType: history.eventType,
      reason: history.reason,
      actorUserId: history.actorUserId,
    })
    .from(history)
    .where(eq(history.claimId, ids.claims[index]!));
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Claim review journey 25–26", () => {
  test.beforeAll(async () => {
    baseline = await counts();
    const now = new Date();
    for (const actor of Object.values(actors)) {
      await db.insert(user).values({
        id: actor.id,
        name: actor.name,
        email: actor.email,
        emailVerified: true,
      });
      await db.insert(account).values({
        id: randomUUID(),
        accountId: actor.id,
        userId: actor.id,
        providerId: "credential",
        password: await hashPassword(actor.password),
      });
    }
    await db.insert(user).values(
      ids.participantUsers.map((id, index) => ({
        id,
        name: personNames[index]!,
        email: `ct-${suffix}-participant-${index}@example.invalid`,
        emailVerified: true,
      })),
    );
    await db.insert(organization).values([
      {
        country: "DE",
        id: ids.host,
        name: `CT ${suffix} Hosting`,
        slug: ids.host,
        createdAt: now,
      },
      ...ids.partners.map((id, index) => ({
        country: "DE" as const,
        id,
        name: partnerNames[index]!,
        slug: id,
        createdAt: now,
      })),
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: actors.H.id,
        organizationId: ids.host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      ...ids.partners.map((id, index) => ({
        id: randomUUID(),
        userId: actors[index === 0 ? "P" : "F"].id,
        organizationId: id,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      })),
      ...ids.participantUsers.map((id) => ({
        id: randomUUID(),
        userId: id,
        organizationId: ids.host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      })),
    ]);
    await db.insert(projects).values({
      id: ids.project,
      name: projectName,
      organizationId: ids.host,
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV",
    });
    await db.insert(partnerships).values(
      ids.partnerships.map((id, index) => ({
        id,
        projectId: ids.project,
        organizationId: ids.partners[index]!,
      })),
    );
    await db.insert(profiles).values(
      ids.participantUsers.map((userId, index) => ({
        userId,
        fullName: personNames[index]!,
      })),
    );
    await db.insert(acceptances).values(
      ids.participantUsers.map((userId) => ({
        userId,
        version: CURRENT_PARTICIPANT_AGREEMENT_VERSION.id,
        contentHash: CURRENT_PARTICIPANT_AGREEMENT_VERSION.contentHash,
        answers: JSON.stringify({ accepted: true }),
      })),
    );
    await db.insert(participants).values(
      ids.participants.map((id, index) => ({
        id,
        projectId: ids.project,
        representedOrganizationId: ids.partners[index]!,
        userId: ids.participantUsers[index]!,
        displayName: personNames[index]!,
        email: `ct-${suffix}-participant-${index}@example.invalid`,
      })),
    );
    await db.insert(snapshots).values({
      projectId: ids.project,
      rulesVersion: TRAVEL_FUNDING_RULES.version,
      participantTransportProfiles: [
        ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
      ],
    });
    await db.insert(bands).values(
      TRAVEL_FUNDING_RULES.bands.map((band) => ({
        projectId: ids.project,
        minKm: String(band.minKm),
        maxKm: String(band.maxKm),
        standardEur: String(band.standardEur),
        greenEur: String(band.greenEur),
      })),
    );
    await db.insert(journeys).values(
      ids.participants.map((id) => ({
        projectParticipantId: id,
        origin: "Berlin",
        destination: "Riga",
        tripType: "round-trip" as const,
        erasmusDistanceKm: "850.25",
      })),
    );
    await db.insert(payoutAccounts).values(
      ids.payoutAccounts.map((id, index) => ({
        id,
        organizationId: ids.partners[index]!,
        accountHolder: `CT ${suffix} test-only reference`,
        iban: `NOT-A-BANK-ACCOUNT-${suffix}`,
      })),
    );
    await db.insert(selections).values(
      ids.partnerships.map((partnershipId, index) => ({
        partnershipId,
        payoutAccountId: ids.payoutAccounts[index]!,
      })),
    );
    await db.insert(claims).values(
      ids.claims.map((id, index) => ({
        id,
        partnershipId: ids.partnerships[index]!,
        status: "submitted" as const,
        approvedAmountEur: "100.00",
      })),
    );
    await db.insert(entries).values(
      ids.entries.map((id, index) => ({
        id,
        claimId: ids.claims[index]!,
        transportProfile: "train" as const,
        amountEur: "100.00",
        allocationMethod: "equal" as const,
      })),
    );
    await db.insert(allocations).values(
      ids.entries.map((travelCostEntryId, index) => ({
        travelCostEntryId,
        projectParticipantId: ids.participants[index]!,
      })),
    );
    for (const reference of proofReferences) {
      await storage.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: reference,
          Body: proofBytes,
          ContentType: "application/pdf",
        }),
      );
      uploadedReferences.add(reference);
    }
    await db.insert(documents).values(
      ids.documents.map((id, index) => ({
        id,
        claimId: ids.claims[index]!,
        fileReference: proofReferences[index]!,
        originalFileName: proofNames[index]!,
        mediaType: "application/pdf",
        byteSize: proofBytes.length,
        checksum: createHash("sha256").update(proofBytes).digest("hex"),
      })),
    );
    await db.insert(entryDocuments).values(
      ids.entries.map((travelCostEntryId, index) => ({
        travelCostEntryId,
        proofDocumentId: ids.documents[index]!,
      })),
    );
    await db.insert(history).values(
      ids.claims.map((claimId, index) => ({
        claimId,
        eventType: "submitted" as const,
        actorUserId: actors[index === 0 ? "P" : "F"].id,
      })),
    );
    const seeded = await counts();
    expect(seeded.map((value, index) => value - baseline[index]!)).toEqual([
      5,
      3,
      0,
      3,
      5,
      1,
      2,
      2,
      2,
      2,
      2,
      1,
      TRAVEL_FUNDING_RULES.bands.length,
      2,
      2,
      2,
      2,
      2,
      2,
      2,
      2,
    ]);
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    try {
      for (const reference of uploadedReferences) {
        await storage.send(
          new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: reference }),
        );
        let missing = false;
        try {
          await storage.send(
            new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: reference }),
          );
        } catch (error) {
          if (error instanceof Error && "$metadata" in error) {
            const metadata = error.$metadata;
            missing =
              typeof metadata === "object" &&
              metadata !== null &&
              "httpStatusCode" in metadata &&
              metadata.httpStatusCode === 404;
          }
          if (!missing) throw error;
        }
        expect(missing, "fixture Proof Document bytes removed").toBe(true);
      }
    } finally {
      storage.destroy();
      // Always remove database fixtures, even if object cleanup reports a failure.
      await db.delete(history).where(inArray(history.claimId, ids.claims));
      await db.delete(claims).where(inArray(claims.id, ids.claims));
      await db
        .delete(journeys)
        .where(inArray(journeys.projectParticipantId, ids.participants));
      await db
        .delete(participants)
        .where(inArray(participants.id, ids.participants));
      await db
        .delete(selections)
        .where(inArray(selections.partnershipId, ids.partnerships));
      await db
        .delete(payoutAccounts)
        .where(inArray(payoutAccounts.id, ids.payoutAccounts));
      await db.delete(snapshots).where(eq(snapshots.projectId, ids.project));
      await db
        .delete(partnerships)
        .where(inArray(partnerships.id, ids.partnerships));
      await db.delete(projects).where(eq(projects.id, ids.project));
      await db
        .delete(member)
        .where(inArray(member.organizationId, [ids.host, ...ids.partners]));
      await db
        .delete(organization)
        .where(inArray(organization.id, [ids.host, ...ids.partners]));
      await db
        .delete(acceptances)
        .where(inArray(acceptances.userId, ids.participantUsers));
      await db
        .delete(profiles)
        .where(inArray(profiles.userId, ids.participantUsers));
      for (const actor of Object.values(actors)) {
        await db.delete(session).where(eq(session.userId, actor.id));
        await db.delete(user).where(eq(user.id, actor.id));
      }
      await db.delete(user).where(inArray(user.id, ids.participantUsers));
      expect(
        await counts(),
        "all own records including Claim history removed",
      ).toEqual(baseline);
    }
  });

  test("25 Hosting requests a required correction; Partner corrects its Participant Journey and resubmits", async ({
    browser,
    baseURL,
  }) => {
    const host = await pageFor(browser, "H", baseURL!);
    await host.goto("/claims/review");
    await expect(host.locator('[data-testid="review-queue"]')).toBeVisible();
    const first = host.locator(`a[href="/claims/review/${ids.partnerships[0]}"]`);
    await expect(first).toBeVisible();
    await expect(
      host.locator(`a[href="/claims/review/${ids.partnerships[1]}"]`),
    ).toBeVisible();
    await first.click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(host, `/claims/review/${ids.partnerships[0]}`);
    reviewURL = host.url();
    expect(new URL(reviewURL).pathname).toBe(
      `/claims/review/${ids.partnerships[0]}`,
    );
    const review = host.getByTestId("claim-review");
    await expect(
      review.locator('[data-review-status="submitted"]'),
    ).toBeVisible();
    // Text-free: server-approved amount section renders (value proven by DB claimState below).
    await expect(
      review.locator('[data-testid="approved-payable"]'),
    ).toBeVisible();
    const cost = review
      .getByTestId("claim-cost-table")
      .locator(
        'tbody tr[data-transport-profile="train"][data-amount-eur="100.00"]',
      );
    await expect(cost).toBeVisible();
    // Text-free: the allocation share row for the participant renders in the
    // cost row pinned above by transport and amount attributes.
    await expect(
      cost.locator(`[data-testid="allocation-share-${ids.participants[0]}"]`),
    ).toBeVisible();
    // Text-free: proof document linked by stable document id (download proven below).
    await expect(review.locator(`a[href*="${ids.documents[0]}"]`)).toBeVisible();
    // Text-free: journey row for the participant renders (route detail subsumed by DB-seeded legs + allocation proof above).
    await expect(
      review.locator(`[data-testid="review-journey-${ids.participants[0]}"]`),
    ).toBeVisible();
    await expect(review.getByTestId("payout-account-holder")).toBeVisible();
    await expect(review.getByTestId("payout-account-iban")).toHaveAttribute(
      "data-iban",
      `NOT-A-BANK-ACCOUNT-${suffix}`,
    );
    await expect(review.getByTestId("cost-save")).toHaveCount(0);
    const downloadPromise = host.waitForEvent("download");
    await review.locator(`a[href*="${ids.documents[0]}"]`).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(proofNames[0]);
    expect(await download.failure()).toBeNull();
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(
      Buffer.concat(chunks).equals(proofBytes),
      "Hosting downloaded exact linked Proof Document bytes",
    ).toBe(true);
    await download.delete();
    await review.getByTestId("claim-decision-requestCorrection").click();
    const confirm = review.getByTestId(
      "claim-decision-confirm-requestCorrection",
    );
    await expect(confirm).toBeDisabled();
    await review.locator("#decision-reason").fill("   ");
    await expect(confirm).toBeDisabled();
    expect(await events(0)).toHaveLength(1);
    await review.locator("#decision-reason").fill(correctionReason);
    await confirm.click();
    await expect(
      review.locator('[data-review-status="correction_requested"]'),
    ).toBeVisible();
    // Text-free: history event recorded with reason (DB proof), rendered entry (UI proof).
    await expect(
      review
        .getByTestId("claim-history")
        .locator('[data-history-event="correction_requested"]'),
    ).toBeVisible();
    expect(await events(0)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "correction_requested",
          reason: correctionReason,
        }),
      ]),
    );
    expect((await claimState(0))!.status).toBe("correction_requested");
    await host.goto("/claims/review");
    await expect(
      host.locator(`a[href="/claims/review/${ids.partnerships[1]}"]`),
    ).toBeVisible();
    await expect(first).toHaveCount(0);

    const partner = await pageFor(browser, "P", baseURL!);
    await partner.goto(`/partnerships/${ids.partnerships[0]}/claim`);
    // Text-free: correction notice state hook instead of visible copy.
    await expect(
      partner.locator('[data-testid="claim-correction-notice"]'),
    ).toBeVisible();
    await partner
      .locator(`#journey-${ids.participants[0]}`)
      .getByTestId(`correct-journey-${ids.participants[0]}`)
      .click();
    await partner
      .locator(`#journey-${ids.participants[0]} input[id$="-origin"]`)
      .fill("Tallinn");
    await partner.getByTestId("journey-correction-save").click();
    // Text-free: the corrected leg persists (checklist pass + resubmission below prove validity).
    // The leg value itself is setup detail typed two lines above.
    // Text-free hook: stable test id + design-system state only. No visible
    // copy is asserted anywhere here, so rewording never breaks this.
    const checklist = partner.locator('[data-testid="submission-checklist"]');
    // Functional state only: 7 items, each carrying the pass badge variant.
    // No visible copy is asserted, so rewording never breaks this.
    await expect(checklist.getByRole("listitem")).toHaveCount(7);
    await expect(
      checklist.locator('[data-slot="badge"][data-variant="status-pass"]'),
    ).toHaveCount(7);
    await partner.getByTestId("claim-submit").click();
    // Text-free: confirm dialog ready (enabled confirm proves dialog state).
    await expect(partner.getByTestId("claim-submit-confirm")).toBeEnabled();
    await partner.getByTestId("claim-submit-confirm").click();
    await expect(
      partner.locator('[data-draft-status="submitted"]'),
    ).toBeVisible();
    await expect(partner.getByTestId("journey-correction-save")).toHaveCount(0);
    // Text-free: history event hook instead of visible copy.
    await expect(
      partner
        .getByTestId("claim-history")
        .locator('[data-history-event="resubmitted"]'),
    ).toBeVisible();
    expect((await claimState(0))!.status).toBe("submitted");
    expect((await events(0)).map((event) => event.eventType)).toEqual([
      "submitted",
      "correction_requested",
      "journey_updated",
      "resubmitted",
    ]);
  });

  test("25a Proof Document transport preserves Partner isolation and Hosting assignment scope", async ({
    browser,
    baseURL,
  }) => {
    const url = `/api/proof-documents?${new URLSearchParams({ partnershipId: ids.partnerships[0]!, documentId: ids.documents[0]! })}`;
    const partner = await pageFor(browser, "P", baseURL!);
    const own = await partner.request.get(url);
    expect(own.status()).toBe(200);
    expect((await own.body()).equals(proofBytes)).toBe(true);
    const foreign = await pageFor(browser, "F", baseURL!);
    expect((await foreign.request.get(url)).status()).toBe(404);
    const host = await pageFor(browser, "H", baseURL!);
    const mismatch = `/api/proof-documents?${new URLSearchParams({ partnershipId: ids.partnerships[1]!, documentId: ids.documents[0]! })}`;
    expect((await host.request.get(mismatch)).status()).toBe(404);
    // Setup-only scope changes exercise the existing oversight guard, not UI role assignment.
    const membership = and(
      eq(member.userId, actors.H.id),
      eq(member.organizationId, ids.host),
    );
    try {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.Participant })
        .where(membership);
      expect((await host.request.get(url)).status()).toBe(403);
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
        .where(membership);
      expect((await host.request.get(url)).status()).toBe(403);
      await db
        .insert(hostAssignments)
        .values({ projectId: ids.project, userId: actors.H.id });
      const assigned = await host.request.get(url);
      expect(assigned.status()).toBe(200);
      expect((await assigned.body()).equals(proofBytes)).toBe(true);
    } finally {
      await db
        .delete(hostAssignments)
        .where(
          and(
            eq(hostAssignments.projectId, ids.project),
            eq(hostAssignments.userId, actors.H.id),
          ),
        );
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
        .where(membership);
    }
  });

  test("26 Hosting approves unpaid resubmission; rejects and reopens a different Project Partnership", async ({
    browser,
    baseURL,
  }) => {
    expect(reviewURL).toBeTruthy();
    const host = await pageFor(browser, "H", baseURL!);
    await host.goto(reviewURL);
    const review = host.getByTestId("claim-review");
    await expect(
      review.locator('[data-review-status="submitted"]'),
    ).toBeVisible();
    // Text-free: journey row for the participant renders (route detail subsumed by approval below).
    await expect(
      review.locator(`[data-testid="review-journey-${ids.participants[0]}"]`),
    ).toBeVisible();
    await review.getByTestId("claim-decision-approve").click();
    await expect(
      review.getByTestId("claim-decision-confirm-approve"),
    ).toBeVisible();
    await review.getByTestId("claim-decision-confirm-approve").click();
    await expect(review.locator('[data-review-status="approved"]')).toBeVisible();
    // Text-free: history event hook instead of visible copy.
    await expect(
      review
        .getByTestId("claim-history")
        .locator('[data-history-event="approved"]'),
    ).toBeVisible();
    expect(await claimState(0)).toEqual({
      status: "approved",
      approvedAmountEur: "100.00",
    });
    // Mark paid is deliberately never clicked: approval is not a bank transfer.
    expect((await events(0)).map((event) => event.eventType)).toEqual([
      "submitted",
      "correction_requested",
      "journey_updated",
      "resubmitted",
      "approved",
    ]);

    await host.goto("/claims/review");
    await expect(
      host.locator(`a[href="/claims/review/${ids.partnerships[0]}"]`),
    ).toHaveCount(0);
    await host.locator(`a[href="/claims/review/${ids.partnerships[1]}"]`).click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(host, `/claims/review/${ids.partnerships[1]}`);
    await expect(
      review.locator('[data-review-status="submitted"]'),
    ).toBeVisible();
    await review.getByTestId("claim-decision-reject").click();
    await expect(
      review.getByTestId("claim-decision-confirm-reject"),
    ).toBeDisabled();
    await review.locator("#decision-reason").fill(rejectionReason);
    await review.getByTestId("claim-decision-confirm-reject").click();
    await expect(review.locator('[data-review-status="rejected"]')).toBeVisible();
    // Text-free: history event recorded with reason (DB proof), rendered entry (UI proof).
    await expect(
      review
        .getByTestId("claim-history")
        .locator('[data-history-event="rejected"]'),
    ).toBeVisible();
    expect(await events(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "rejected",
          reason: rejectionReason,
        }),
      ]),
    );
    expect((await claimState(1))!.status).toBe("rejected");
    await review.getByTestId("claim-decision-reopen").click();
    // Text-free: reopen dialog ready (enabled confirm proves dialog state).
    await expect(
      review.getByTestId("claim-decision-confirm-reopen"),
    ).toBeEnabled();
    await review.getByTestId("claim-decision-confirm-reopen").click();
    await expect(
      review.locator('[data-review-status="submitted"]'),
    ).toBeVisible();
    // Text-free: history event hook instead of visible copy.
    await expect(
      review
        .getByTestId("claim-history")
        .locator('[data-history-event="reopened"]'),
    ).toBeVisible();
    expect((await claimState(1))!.status).toBe("submitted");
    const partner = await pageFor(browser, "F", baseURL!);
    await partner.goto(`/partnerships/${ids.partnerships[1]}/claim`);
    await expect(
      partner.locator('[data-draft-status="submitted"]'),
    ).toBeVisible();
    await expect(partner.locator('[data-testid="claim-locked"]')).toBeVisible();
    await expect(partner.getByTestId("cost-save")).toHaveCount(0);
    await expect(partner.getByTestId("journey-correction-save")).toHaveCount(0);
    await expect(partner.getByTestId("claim-submit")).toHaveCount(0);
    expect((await events(1)).map((event) => event.eventType)).toEqual([
      "submitted",
      "rejected",
      "reopened",
    ]);
    expect((await claimState(0))!.status).toBe("approved");
  });
});
