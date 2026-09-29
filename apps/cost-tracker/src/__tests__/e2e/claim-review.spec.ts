import { randomUUID } from "node:crypto";

import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
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
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

import { CURRENT_PARTICIPANT_AGREEMENT_VERSION } from "@/features/authentication/participant-agreement";

// API-setup exceptions: beforeAll inserts verified disposable Users and credentials,
// Hosting/Partner Organizations and memberships, one Project, two Project Partnerships,
// joined Project Participations, frozen funding rules, Participant Journeys, Payout
// Account references, submitted Claims, exact Travel Cost Entries/Cost Allocations,
// synthetic Proof Document metadata and submission history. These are prerequisites,
// not browser evidence for cases 20–24. No browser mail-producing form is submitted.
// Proof metadata points to no storage object; review download remains a UI GAP.
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
const projectName = `CT ${suffix} Main`;
const partnerNames = [`CT ${suffix} Partner A`, `CT ${suffix} Partner B`];
const personNames = [`CT ${suffix} Participant A`, `CT ${suffix} Participant B`];
const proofNames = [`proof-${suffix}-a.pdf`, `proof-${suffix}-b.pdf`];
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
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email: actors[actor].email, password: actors[actor].password },
  });
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

test.describe.serial("Claim review journey 25–26", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
        id: ids.host,
        name: `CT ${suffix} Hosting`,
        slug: ids.host,
        createdAt: now,
      },
      ...ids.partners.map((id, index) => ({
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
        role: "owner",
        createdAt: now,
      },
      ...ids.partners.map((id, index) => ({
        id: randomUUID(),
        userId: actors[index === 0 ? "P" : "F"].id,
        organizationId: id,
        role: "owner",
        createdAt: now,
      })),
      ...ids.participantUsers.map((id) => ({
        id: randomUUID(),
        userId: id,
        organizationId: ids.host,
        role: "participant",
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
    await db.insert(documents).values(
      ids.documents.map((id, index) => ({
        id,
        claimId: ids.claims[index]!,
        fileReference: `test-only/no-object/${id}`,
        originalFileName: proofNames[index]!,
        mediaType: "application/pdf",
        byteSize: 1,
        checksum: "test-only",
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
  });

  test("25 Hosting requests a required correction; Partner corrects its Participant Journey and resubmits", async ({
    browser,
    baseURL,
  }) => {
    const host = await pageFor(browser, "H", baseURL!);
    await host.goto("/claims/review");
    await expect(
      host.getByText("Submitted Claims awaiting review"),
    ).toBeVisible();
    const first = host.getByRole("link", {
      name: `${projectName} · ${partnerNames[0]}`,
    });
    await expect(first).toBeVisible();
    await expect(
      host.getByRole("link", { name: `${projectName} · ${partnerNames[1]}` }),
    ).toBeVisible();
    await first.click();
    await expect(host).toHaveURL(`/claims/review/${ids.partnerships[0]}`);
    reviewURL = host.url();
    expect(new URL(reviewURL).pathname).toBe(
      `/claims/review/${ids.partnerships[0]}`,
    );
    const review = host.getByRole("region", { name: "Claim review" });
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    await expect(
      review.getByText(`Calculated payable: 100.00 EUR (server-approved amount)`),
    ).toBeVisible();
    await expect(review.getByText(`train · 100.00 EUR · equal`)).toBeVisible();
    await expect(
      review.getByText(`${personNames[0]}: Equal share (computed on submission)`),
    ).toBeVisible();
    await expect(
      review.getByText(new RegExp(proofNames[0]!.replaceAll(".", "\\."))),
    ).toBeVisible();
    await expect(
      review.getByText(
        `${personNames[0]}: Berlin → Riga · round-trip · 850.25 km`,
      ),
    ).toBeVisible();
    await expect(review.getByText(/Selected payout: CT/)).toBeVisible();
    await expect(review.getByRole("button", { name: "Save cost" })).toHaveCount(
      0,
    );
    await expect(review.getByRole("link", { name: /Download/ })).toHaveCount(0); // UI GAP: no review download.
    await review.getByRole("button", { name: "Request correction" }).click();
    const confirm = review.getByRole("button", {
      name: "Confirm correction request",
    });
    await expect(confirm).toBeDisabled();
    await review.getByRole("textbox", { name: "Correction reason" }).fill("   ");
    await expect(confirm).toBeDisabled();
    expect(await events(0)).toHaveLength(1);
    await review
      .getByRole("textbox", { name: "Correction reason" })
      .fill(correctionReason);
    await confirm.click();
    await expect(
      review.getByText("Correction requested · Partner action required"),
    ).toBeVisible();
    await expect(
      review
        .getByRole("region", { name: "Claim history" })
        .getByText(correctionReason),
    ).toBeVisible();
    expect((await claimState(0))!.status).toBe("correction_requested");
    await host.goto("/claims/review");
    await expect(first).toHaveCount(0);

    const partner = await pageFor(browser, "P", baseURL!);
    await partner.goto(`/partnerships/${ids.partnerships[0]}/claim`);
    await expect(
      partner.getByText(`Correction requested: ${correctionReason}`),
    ).toBeVisible();
    await partner
      .getByRole("button", { name: `Correct ${personNames[0]}'s journey` })
      .click();
    await partner.getByLabel(`Origin for ${personNames[0]}`).fill("Tallinn");
    await partner.getByRole("button", { name: "Save correction" }).click();
    await expect(
      partner.getByText(new RegExp(`${personNames[0]}: Tallinn → Riga`)),
    ).toBeVisible();
    const checklist = partner.getByRole("list", { name: "Submission checklist" });
    await expect(checklist.getByText(/^Pass:/)).toHaveCount(7);
    await partner.getByRole("button", { name: "Submit Claim" }).click();
    await expect(
      partner.getByText(/Confirm submission: submission locks/),
    ).toBeVisible();
    await partner.getByRole("button", { name: "Confirm submission" }).click();
    await expect(partner.getByText("Claim submitted · saved")).toBeVisible();
    await expect(
      partner.getByRole("button", { name: "Save correction" }),
    ).toHaveCount(0);
    await expect(
      partner
        .getByRole("region", { name: "Claim history" })
        .getByText("Resubmitted"),
    ).toBeVisible();
    expect((await claimState(0))!.status).toBe("submitted");
    expect((await events(0)).map((event) => event.eventType)).toEqual([
      "submitted",
      "correction_requested",
      "journey_updated",
      "resubmitted",
    ]);
  });

  test("26 Hosting approves unpaid resubmission; rejects and reopens a different Project Partnership", async ({
    browser,
    baseURL,
  }) => {
    expect(reviewURL).toBeTruthy();
    const host = await pageFor(browser, "H", baseURL!);
    await host.goto(reviewURL);
    const review = host.getByRole("region", { name: "Claim review" });
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    await expect(
      review.getByText(
        `${personNames[0]}: Tallinn → Riga · round-trip · 850.25 km`,
      ),
    ).toBeVisible();
    await review.getByRole("button", { name: "Approve Claim" }).click();
    await expect(
      review.getByRole("button", { name: "Confirm approval" }),
    ).toBeVisible();
    await review.getByRole("button", { name: "Confirm approval" }).click();
    await expect(review.getByText("Approved · unpaid")).toBeVisible();
    await expect(
      review
        .getByRole("region", { name: "Claim history" })
        .getByText("Approved", { exact: true }),
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
      host.getByRole("link", { name: `${projectName} · ${partnerNames[0]}` }),
    ).toHaveCount(0);
    await host
      .getByRole("link", { name: `${projectName} · ${partnerNames[1]}` })
      .click();
    await expect(host).toHaveURL(`/claims/review/${ids.partnerships[1]}`);
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    await review.getByRole("button", { name: "Reject Claim" }).click();
    await expect(
      review.getByRole("button", { name: "Confirm rejection" }),
    ).toBeDisabled();
    await review
      .getByRole("textbox", { name: "Rejection reason" })
      .fill(rejectionReason);
    await review.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(review.getByText("Rejected · unpaid")).toBeVisible();
    await expect(
      review
        .getByRole("region", { name: "Claim history" })
        .getByText(rejectionReason),
    ).toBeVisible();
    expect((await claimState(1))!.status).toBe("rejected");
    await review.getByRole("button", { name: "Reopen Claim" }).click();
    await expect(
      review.getByText(
        /Reopening returns the Claim to Hosting review and keeps Partner editing locked/,
      ),
    ).toBeVisible();
    await review.getByRole("button", { name: "Confirm reopening" }).click();
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    await expect(
      review
        .getByRole("region", { name: "Claim history" })
        .getByText("Reopened", { exact: true }),
    ).toBeVisible();
    expect((await claimState(1))!.status).toBe("submitted");
    const partner = await pageFor(browser, "F", baseURL!);
    await partner.goto(`/partnerships/${ids.partnerships[1]}/claim`);
    await expect(partner.getByText("Claim submitted · saved")).toBeVisible();
    await expect(
      partner.getByText(/This Claim is locked for Partner editing/),
    ).toBeVisible();
    await expect(partner.getByRole("button", { name: "Save cost" })).toHaveCount(
      0,
    );
    await expect(
      partner.getByRole("button", { name: "Save correction" }),
    ).toHaveCount(0);
    await expect(
      partner.getByRole("button", { name: "Submit Claim" }),
    ).toHaveCount(0);
    expect((await events(1)).map((event) => event.eventType)).toEqual([
      "submitted",
      "rejected",
      "reopened",
    ]);
    expect((await claimState(0))!.status).toBe("approved");
  });
});
