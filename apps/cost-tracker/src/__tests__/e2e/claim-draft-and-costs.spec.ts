import { randomBytes, randomUUID } from "node:crypto";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  getTravelFundingRate,
  TRAVEL_FUNDING_RULES,
} from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable,
  claimsTable,
  costAllocationsTable,
  duplicateReviewTasksTable,
  member,
  organization,
  partnerCoordinatorAssignmentsTable,
  participantAgreementAcceptancesTable,
  participantProfilesTable,
  partnershipPayoutAccountsTable,
  payoutAccountsTable,
  projectFundingBandsTable,
  projectFundingSnapshotsTable,
  projectPartnerOrganizationsTable,
  projectParticipantsTable,
  projectsTable,
  proofDocumentsTable,
  session,
  travelCostEntriesTable,
  user,
} from "@greendex/database/schema";
import { type Browser, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq } from "drizzle-orm";

import { env } from "@/env";
import { CURRENT_PARTICIPANT_AGREEMENT_VERSION } from "@/features/authentication/participant-agreement";

import {
  expectPrivateURL,
  expect,
  test,
  registerPrivateValues,
} from "./fixtures/artifact-privacy";
import { postSignInWithRateLimitRetry } from "./fixtures/rate-limit-retry";

async function confirmRemoveParticipation(page: Page) {
  await page.getByRole("dialog").getByTestId("confirm-dialog-execute").click();
}

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: beforeAll seeds a verified Partner coordinator, three
// disposable onboarded Users (profile + current development Participant Agreement),
// Hosting/Partner Organizations, Project and Project Partnership. No mail-producing
// registration/invitation submit is driven by the browser; browser clicks create
// every Claim-owned record and the additional Participation. DB reads assert exact
// cardinality, frozen rules and cleanup, not substitute for UI actions.
// Case 20 removal is browser-driven; reference and Claim-lock refusals are visible.
// Case 20 creates duplicate attempts in-browser, self-assigns Review Tasks, and
// resolves each decision without creating another Project Participation.
// Server authorization/concurrency are AUTOMATED-ONLY: submission.integration.test.ts.
// Proof Document bytes are synthetic; afterAll deletes the uploaded object and rows.
const suffix = randomUUID();
const hostId = randomUUID();
const partnerId = randomUUID();
const projectId = randomUUID();
const partnershipId = randomUUID();
const coordinatorId = randomUUID();
const password = randomUUID();
registerPrivateValues(password);
const coordinatorName = `CT ${suffix} Group Organizer`;
const coordinatorEmail = `ct-${suffix}-coordinator@example.invalid`;
const names = ["T", "U", "V"].map((name) => `CT ${suffix} ${name}`);
const people = names.map((name) => ({
  id: randomUUID(),
  name,
  email: `ct-${randomUUID()}@example.invalid`,
}));
const initialParticipationIds = [randomUUID(), randomUUID()];
const claimURL = `/partnerships/${partnershipId}/claim`;
const participantsURL = `/partnerships/${partnershipId}/participants`;
const proofName = `claim-proof-${suffix}.pdf`;
const distance = "850.25";

// The reserved zero routing code is not assigned to a bank; the randomized
// account digits and computed mod-97 check digits make a syntactically valid
// disposable DE IBAN, never a real payable account.
function disposableIban() {
  const accountDigits = [...randomBytes(10)]
    .map((byte) => String(byte % 10))
    .join("");
  const bban = `00000000${accountDigits}`;
  let remainder = 0;
  for (const digit of `${bban}131400`)
    remainder = (remainder * 10 + Number(digit)) % 97;
  return `DE${String(98 - remainder).padStart(2, "0")}${bban}`;
}

async function participationId(userId: string) {
  const [participation] = await db
    .select({ id: projectParticipantsTable.id })
    .from(projectParticipantsTable)
    .where(
      and(
        eq(projectParticipantsTable.projectId, projectId),
        eq(projectParticipantsTable.userId, userId),
      ),
    );
  expect(participation).toBeDefined();
  return participation!.id;
}

async function participationRow(page: Page, userId: string) {
  return page.getByTestId(`joined-participant-${await participationId(userId)}`);
}

async function claimCount() {
  const [row] = await db
    .select({ value: count() })
    .from(claimsTable)
    .where(eq(claimsTable.partnershipId, partnershipId));
  return row!.value;
}

async function openPartnership(
  page: Page,
  destination: "participants" | "claim",
) {
  await page.goto("/projects");
  await expect(page.getByTestId("project-scope-partner")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page
    .locator(
      `a[href="/projects/${projectId}"], a[href^="/projects/${projectId}?"]`,
    )
    .click();
  await page
    .locator(
      `a[href="${destination === "participants" ? participantsURL : claimURL}"]`,
    )
    .click();
  // Preserve the original full-URL match; only the diagnostic receives a boolean.
  await expectPrivateURL(
    page,
    destination === "participants" ? participantsURL : claimURL,
  );
}

async function coordinatorContext(browser: Browser, baseURL: string) {
  const actor = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const response = await postSignInWithRateLimitRetry(
    actor.request,
    coordinatorEmail,
    password,
  );
  expect(response.ok(), "setup sign-in failed").toBe(true);
  return actor;
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Claim draft and costs journey G1, 20–24", () => {
  test.beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values([
      {
        id: coordinatorId,
        name: coordinatorName,
        email: coordinatorEmail,
        emailVerified: true,
      },
      ...people.map((person) => ({ ...person, emailVerified: true })),
    ]);
    await db.insert(account).values({
      id: randomUUID(),
      accountId: coordinatorId,
      userId: coordinatorId,
      providerId: "credential",
      password: await hashPassword(password),
    });
    await db.insert(organization).values([
      {
        country: "DE",
        id: hostId,
        name: `CT ${suffix} Hosting`,
        slug: `ct-${suffix}-host`,
        createdAt: now,
      },
      {
        country: "DE",
        id: partnerId,
        name: `CT ${suffix} Partner`,
        slug: `ct-${suffix}-partner`,
        createdAt: now,
      },
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: coordinatorId,
        organizationId: partnerId,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      ...people.map((person) => ({
        id: randomUUID(),
        userId: person.id,
        organizationId: hostId,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      })),
    ]);
    await db.insert(projectsTable).values({
      id: projectId,
      name: `CT ${suffix} Project`,
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV",
      organizationId: hostId,
    });
    await db.insert(projectPartnerOrganizationsTable).values({
      id: partnershipId,
      projectId,
      organizationId: partnerId,
    });
    await db.insert(partnerCoordinatorAssignmentsTable).values({
      partnershipId,
      userId: coordinatorId,
    });
    await db
      .insert(participantProfilesTable)
      .values(
        people.map((person) => ({ userId: person.id, fullName: person.name })),
      );
    await db.insert(participantAgreementAcceptancesTable).values(
      people.map((person) => ({
        userId: person.id,
        version: CURRENT_PARTICIPANT_AGREEMENT_VERSION.id,
        contentHash: CURRENT_PARTICIPANT_AGREEMENT_VERSION.contentHash,
        answers: JSON.stringify({ accepted: true }),
      })),
    );
    await db.insert(projectParticipantsTable).values(
      initialParticipationIds.map((id, index) => ({
        id,
        projectId,
        representedOrganizationId: partnerId,
        userId: people[index]!.id,
        displayName: people[index]!.name,
        email: people[index]!.email,
      })),
    );
    expect(await claimCount()).toBe(0);
    const [candidate] = await db
      .select({
        id: user.id,
        fullName: participantProfilesTable.fullName,
        version: participantAgreementAcceptancesTable.version,
        role: member.role,
      })
      .from(user)
      .innerJoin(
        participantProfilesTable,
        eq(participantProfilesTable.userId, user.id),
      )
      .innerJoin(
        participantAgreementAcceptancesTable,
        eq(participantAgreementAcceptancesTable.userId, user.id),
      )
      .innerJoin(
        member,
        and(eq(member.userId, user.id), eq(member.organizationId, hostId)),
      )
      .where(eq(user.id, people[2]!.id));
    expect(candidate).toEqual({
      id: people[2]!.id,
      fullName: people[2]!.name,
      version: CURRENT_PARTICIPANT_AGREEMENT_VERSION.id,
      role: ORGANIZATION_ROLES.Participant,
    });
    expect(
      await db
        .select()
        .from(projectParticipantsTable)
        .where(eq(projectParticipantsTable.projectId, projectId)),
    ).toHaveLength(2);
  });

  test.afterAll(async () => {
    const documents = await db
      .select({ fileReference: proofDocumentsTable.fileReference })
      .from(proofDocumentsTable)
      .innerJoin(claimsTable, eq(proofDocumentsTable.claimId, claimsTable.id))
      .where(eq(claimsTable.partnershipId, partnershipId));
    const storage = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    try {
      for (const document of documents)
        await storage.send(
          new DeleteObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: document.fileReference,
          }),
        );
    } finally {
      storage.destroy();
    }
    const [claim] = await db
      .select({ id: claimsTable.id })
      .from(claimsTable)
      .where(eq(claimsTable.partnershipId, partnershipId));
    if (claim) {
      await db
        .delete(claimHistoryTable)
        .where(eq(claimHistoryTable.claimId, claim.id));
      await db.delete(claimsTable).where(eq(claimsTable.id, claim.id));
    }
    await db
      .delete(projectFundingSnapshotsTable)
      .where(eq(projectFundingSnapshotsTable.projectId, projectId));
    await db
      .delete(duplicateReviewTasksTable)
      .where(eq(duplicateReviewTasksTable.partnershipId, partnershipId));
    await db
      .delete(projectParticipantsTable)
      .where(eq(projectParticipantsTable.projectId, projectId));
    await db
      .delete(partnershipPayoutAccountsTable)
      .where(eq(partnershipPayoutAccountsTable.partnershipId, partnershipId));
    await db
      .delete(payoutAccountsTable)
      .where(eq(payoutAccountsTable.organizationId, partnerId));
    await db
      .delete(partnerCoordinatorAssignmentsTable)
      .where(eq(partnerCoordinatorAssignmentsTable.partnershipId, partnershipId));
    await db
      .delete(projectPartnerOrganizationsTable)
      .where(eq(projectPartnerOrganizationsTable.id, partnershipId));
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    await db.delete(member).where(eq(member.organizationId, hostId));
    await db.delete(member).where(eq(member.organizationId, partnerId));
    await db.delete(organization).where(eq(organization.id, partnerId));
    await db.delete(organization).where(eq(organization.id, hostId));
    for (const person of people) {
      await db
        .delete(participantAgreementAcceptancesTable)
        .where(eq(participantAgreementAcceptancesTable.userId, person.id));
      await db
        .delete(participantProfilesTable)
        .where(eq(participantProfilesTable.userId, person.id));
      await db.delete(user).where(eq(user.id, person.id));
    }
    await db.delete(session).where(eq(session.userId, coordinatorId));
    await db.delete(user).where(eq(user.id, coordinatorId));
    expect(await claimCount()).toBe(0);
    const [remaining] = await db
      .select({ value: count() })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    expect(remaining!.value).toBe(0);
    expect(
      await db
        .select()
        .from(duplicateReviewTasksTable)
        .where(eq(duplicateReviewTasksTable.partnershipId, partnershipId)),
    ).toHaveLength(0);
  });

  test("20 pasted search selects and adds registered V, then edits country only", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await openPartnership(page, "participants");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Text-free: the participation-add form below proves the section renders;
      // participant rows are asserted by role right after.
      await expect(await participationRow(page, people[0]!.id)).toBeVisible();
      await expect(await participationRow(page, people[1]!.id)).toBeVisible();
      await page
        .getByTestId("participation-user-picker")
        .getByRole("button")
        .click();
      const search = page.locator('[data-slot="command-input"]');
      const response = page.waitForResponse((result) => {
        const request = result.request();
        return (
          new URL(result.url()).pathname ===
            "/api/rpc/participations/searchOnboarded" &&
          decodeURIComponent(request.url() + (request.postData() ?? "")).includes(
            people[2]!.name,
          )
        );
      });
      await search.fill(people[2]!.name);
      const found = await response;
      expect(found.status()).toBe(200);
      expect(JSON.stringify(await found.json())).toContain(people[2]!.id);
      await expect(
        page.locator(`[role="option"][data-entity-id="${people[2]!.id}"]`),
      ).toBeVisible();
      await page
        .locator(`[role="option"][data-entity-id="${people[2]!.id}"]`)
        .click();
      const added = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/rpc/participations/create",
      );
      await page.getByTestId("participation-add").click();
      expect((await added).ok()).toBe(true);
      // Text-free: the new row + DB length below prove the addition (no toast copy).
      const row = await participationRow(page, people[2]!.id);
      await expect(row).toBeVisible();
      const detailsLink = row.getByRole("link");
      const detailsHref = await detailsLink.getAttribute("href");
      expect(detailsHref).not.toBeNull();
      await detailsLink.click();
      await expectPrivateURL(page, detailsHref!);
      await expect(page.getByTestId("participant-details")).toBeVisible();
      await page.locator("#participation-country").selectOption("DE");
      await page.getByTestId("participation-country-save").click();
      await expect(
        page.locator('[data-feedback-outcome="country-saved"]'),
      ).toBeVisible();
      await expect(page.locator("#participation-country")).toHaveValue("DE");
      await page.reload();
      await expect(page.locator("#participation-country")).toHaveValue("DE");
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.projectId, projectId)),
      ).toHaveLength(3);
      await page.locator(`a[href="${participantsURL}"]`).click();
      await expectPrivateURL(page, participantsURL);
      const [savedCountry] = await db
        .select({ country: projectParticipantsTable.country })
        .from(projectParticipantsTable)
        .where(
          eq(projectParticipantsTable.id, await participationId(people[2]!.id)),
        );
      expect(savedCountry?.country).toBe("DE");
      await expect(row).toBeVisible();
      await expect(page.getByTestId("review-tasks-toggle")).toBeVisible();
    } finally {
      await actor.close();
    }
  });

  test("20 removes an unreferenced Participation, then typed search selects and adds V", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      // Control-only coverage uses direct navigation; the original journey cases
      // retain Project-detail → workspace navigation coverage.
      await page.goto(participantsURL);
      const row = await participationRow(page, people[2]!.id);
      await expect(row).toBeVisible();
      const [original] = await db
        .select({ id: projectParticipantsTable.id })
        .from(projectParticipantsTable)
        .where(
          and(
            eq(projectParticipantsTable.projectId, projectId),
            eq(projectParticipantsTable.userId, people[2]!.id),
          ),
        );
      await row.getByRole("button").click();
      await page.getByRole("dialog").getByTestId("confirm-dialog-cancel").click();
      await expect(row).toBeVisible();
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.id, original!.id)),
      ).toHaveLength(1);
      await row.getByRole("button").click();
      await confirmRemoveParticipation(page);
      // Text-free: vanished row + DB deletion below prove removal (no toast copy).
      await expect(row).toHaveCount(0);
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.id, original!.id)),
      ).toHaveLength(0);
      await page.reload();
      await expect(row).toHaveCount(0);
      await page
        .getByTestId("participation-user-picker")
        .getByRole("button")
        .click();
      const response = page.waitForResponse((result) => {
        const request = result.request();
        return (
          new URL(result.url()).pathname ===
            "/api/rpc/participations/searchOnboarded" &&
          decodeURIComponent(request.url() + (request.postData() ?? "")).includes(
            people[2]!.name,
          )
        );
      });
      await page
        .locator('[data-slot="command-input"]')
        .pressSequentially(people[2]!.name, { delay: 35 });
      const found = await response;
      expect(found.status()).toBe(200);
      expect(JSON.stringify(await found.json())).toContain(people[2]!.id);
      await expect(
        page.locator(`[role="option"][data-entity-id="${people[2]!.id}"]`),
      ).toBeVisible();
      await page
        .locator(`[role="option"][data-entity-id="${people[2]!.id}"]`)
        .click();
      await page.getByTestId("participation-add").click();
      await expect
        .poll(async () =>
          db
            .select()
            .from(projectParticipantsTable)
            .where(eq(projectParticipantsTable.projectId, projectId)),
        )
        .toHaveLength(3);
      const addedId = await participationId(people[2]!.id);
      expect(addedId).not.toBe(original!.id);
      const addedRow = page.getByTestId(`joined-participant-${addedId}`);
      await expect(addedRow).toBeVisible();
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(addedRow).toBeVisible();
      await expect(row).toHaveCount(0);
    } finally {
      await actor.close();
    }
  });

  test("20 duplicate attempts create Review Tasks that self-assign and resolve all decisions", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Three independent duplicate attempts and task lifecycles.
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await page.goto(participantsURL);
      await page.getByTestId("review-tasks-toggle").click();
      const tasks = page.getByTestId("review-tasks");
      // Text-free: the empty tasks region proves the empty state (no copy).
      await expect(tasks.getByRole("listitem")).toHaveCount(0);
      const decisions = [
        { value: "same_person", label: "Same person" },
        { value: "distinct_persons", label: "Distinct persons" },
        { value: "dismiss", label: "Dismiss" },
      ] as const;
      for (const [index, person] of people.entries()) {
        await page
          .getByTestId("participation-user-picker")
          .getByRole("button")
          .click();
        const search = page.locator('[data-slot="command-input"]');
        await search.fill("");
        await search.pressSequentially(person.name, { delay: 35 });
        await page
          .locator(`[role="option"][data-entity-id="${person.id}"]`)
          .click();
        await page.getByTestId("participation-add").click();
        await expect(
          page.locator('[data-feedback-outcome="duplicate-review"]'),
        ).toBeVisible();
        const openRow = tasks.locator('li[data-task-status="open"]');
        await expect(openRow).toHaveCount(1);
        await openRow.getByTestId("review-task-assign").click();
        await expect(openRow).toHaveCount(0);
        const assignedRow = tasks.locator('li[data-task-status="assigned"]');
        await expect(assignedRow).toHaveCount(1);
        await assignedRow
          .locator('select[id^="review-decision-"]')
          .selectOption(decisions[index]!.value);
        await assignedRow.getByTestId("review-task-resolve").click();
        await expect(assignedRow).toHaveCount(0);
        const resolvedRow = tasks.locator(
          `li[data-task-status="resolved"][data-task-decision="${decisions[index]!.value}"]`,
        );
        await expect(resolvedRow).toHaveCount(1);
        await expect(resolvedRow.getByRole("button")).toHaveCount(0);
        const [task] = await db
          .select()
          .from(duplicateReviewTasksTable)
          .where(
            and(
              eq(duplicateReviewTasksTable.partnershipId, partnershipId),
              eq(duplicateReviewTasksTable.candidateUserId, person.id),
            ),
          );
        expect(task).toMatchObject({
          status: "resolved",
          assignedToUserId: coordinatorId,
          decision: decisions[index]!.value,
          survivorParticipationId: task!.existingParticipationId,
        });
      }
      await page.reload();
      await page.getByTestId("review-tasks-toggle").click();
      // Text-free: all resolved rows carry the resolved state (DB proof below covers values).
      await expect(tasks.locator('li[data-task-status="resolved"]')).toHaveCount(
        3,
      );
      // Resolved Review Tasks retain their survivor references; the removal
      // control must surface that refusal rather than deleting the survivor.
      const survivor = await participationRow(page, people[0]!.id);
      await survivor.getByRole("button").click();
      await confirmRemoveParticipation(page);
      await expect(
        page.locator('[data-feedback-outcome="remove-refused"]'),
      ).toBeVisible();
      await expect(survivor).toBeVisible();
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.projectId, projectId)),
      ).toHaveLength(3);
    } finally {
      await actor.close();
    }
  });

  test("G1 and 21 create an account without a Claim then explicitly save one draft", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await openPartnership(page, "claim");
      // Text-free: pre-save draft state hook instead of visible copy.
      await expect(page.locator('[data-draft-status="none"]')).toBeVisible();
      expect(await claimCount()).toBe(0);
      await page
        .locator("#account-holder")
        .fill(`CT ${suffix} disposable holder`);
      await page.locator("#account-iban").fill(disposableIban());
      await page.getByTestId("payout-account-create").click();
      // Text-free: claimCount 0 + disabled Save below prove nothing was created (no toast copy).
      expect(await claimCount()).toBe(0);
      await expect(page.getByTestId("claim-draft-save")).toBeDisabled();
      await page.locator("#claim-payout-select").selectOption({ index: 1 });
      // Text-free: the succeeding Save click below proves the selection applied (no copy).
      expect(await claimCount()).toBe(0);
      await page.getByTestId("claim-draft-save").click();
      await expect(page.locator('[data-draft-status="editable"]')).toBeVisible();
      expect(await claimCount()).toBe(1);
      await page.reload();
      await expect(page.locator('[data-draft-status="editable"]')).toBeVisible();
      await expect(page.getByTestId("claim-draft-save")).toHaveCount(0);
      expect(await claimCount()).toBe(1);
      // A second Save is unavailable after success; concurrent saves are tested in claims.integration.test.ts.
    } finally {
      await actor.close();
    }
  });

  test("22 saves one complete individual Participant Journey per Participation", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await openPartnership(page, "claim");
      await page
        .locator("#journey-person")
        .selectOption(await participationId(people[0]!.id));
      await page.getByTestId("journey-save").click();
      await expect(
        page.locator("#journey-origin").locator("..").getByRole("alert"),
      ).toBeVisible();
      await expect(
        page.locator("#journey-destination").locator("..").getByRole("alert"),
      ).toBeVisible();
      await expect(
        page.locator("#journey-distance").locator("..").getByRole("alert"),
      ).toBeVisible();
      for (const person of people) {
        await page
          .locator("#journey-person")
          .selectOption(await participationId(person.id));
        await page.locator("#journey-origin").fill("Berlin");
        await page.locator("#journey-destination").fill("Riga");
        await page.locator("#journey-type").selectOption("round-trip");
        await page.locator("#journey-distance").fill(distance);
        await page.getByTestId("journey-save").click();
        // Text-free: saved journeys persist (submit + checklist + DB below prove
        // validity); rendered leg echoes are setup detail typed two lines above.
        await expect(
          page
            .locator("#journey-person")
            .locator(`option[value="${await participationId(person.id)}"]`),
        ).toHaveCount(0);
      }
      const [snapshot] = await db
        .select()
        .from(projectFundingSnapshotsTable)
        .where(eq(projectFundingSnapshotsTable.projectId, projectId));
      expect(snapshot).toBeDefined();
      const bands = await db
        .select()
        .from(projectFundingBandsTable)
        .where(eq(projectFundingBandsTable.projectId, projectId));
      expect(bands).toHaveLength(TRAVEL_FUNDING_RULES.bands.length);
      expect(snapshot!.rulesVersion).toBe(TRAVEL_FUNDING_RULES.version);
      expect(snapshot!.participantTransportProfiles).toEqual(
        TRAVEL_FUNDING_RULES.participantTransportProfiles,
      );
      expect(
        bands.find(
          (band) =>
            Number(distance) >= Number(band.minKm) &&
            Number(distance) <= Number(band.maxKm),
        ),
      ).toBeDefined();
      await page.reload();
      // Text-free: reloaded journeys persist (submit below proves validity).
      await expect(page.locator("#journey-person").locator("option")).toHaveCount(
        1,
      );
      // The selector excludes saved Journeys: a second cannot be initiated in the UI.
      // Forged second-Journey rejection is AUTOMATED-ONLY in journeys.integration.test.ts.
    } finally {
      await actor.close();
    }
  });

  test("20 Participant Journey reference visibly refuses Project Participation removal", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await page.goto(participantsURL);
      const row = await participationRow(page, people[0]!.id);
      await expect(row).toBeVisible();
      await row.getByRole("button").click();
      await confirmRemoveParticipation(page);
      await expect(
        page.locator('[data-feedback-outcome="remove-refused"]'),
      ).toBeVisible();
      await expect(row).toBeVisible();
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.id, initialParticipationIds[0]!)),
      ).toHaveLength(1);
    } finally {
      await actor.close();
    }
  });

  test("23 rejects invalid costs, allocates exactly 100.00 EUR and links a synthetic Proof Document", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Storage upload may wait on the dev Garage endpoint.
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await openPartnership(page, "claim");
      await page.locator("#cost-amount").fill("0");
      await page.getByTestId("cost-save").click();
      await expect(
        page.locator("#cost-amount").locator("..").getByRole("alert"),
      ).toBeVisible();
      await expect(page.locator('[data-testid="costs-empty"]')).toBeVisible();
      await page.locator("#cost-amount").fill("100.00");
      await page.locator("#cost-method").selectOption("amount");
      for (const person of people)
        await page
          .getByTestId("cost-participations")
          .getByTestId(`cost-participation-${await participationId(person.id)}`)
          .check();
      for (const person of people)
        await page
          .locator(`#share-${await participationId(person.id)}`)
          .fill("33.33");
      await page.getByTestId("cost-save").click();
      await expect(
        page
          .getByTestId("cost-participations")
          .locator(':scope > [role="alert"]'),
      ).toBeVisible();
      await expect(page.locator('[data-testid="costs-empty"]')).toBeVisible();
      await page.locator("#cost-method").selectOption("equal");
      await page.getByTestId("cost-save").click();
      const cost = page
        .getByTestId("claim-cost-table")
        .locator('tbody tr[data-amount-eur="100.00"]');
      await expect(cost).toBeVisible();
      // Text-free: equal-split method proven by the shares DB assertions below (all null = equal).
      const [claim] = await db
        .select({ id: claimsTable.id })
        .from(claimsTable)
        .where(eq(claimsTable.partnershipId, partnershipId));
      const [entry] = await db
        .select()
        .from(travelCostEntriesTable)
        .where(eq(travelCostEntriesTable.claimId, claim!.id));
      const shares = await db
        .select()
        .from(costAllocationsTable)
        .where(eq(costAllocationsTable.travelCostEntryId, entry!.id));
      expect(shares).toHaveLength(3);
      expect(
        shares.every(
          (share) => share.amountEur === null && share.percentage === null,
        ),
      ).toBe(true);
      const displayedShares = await page
        .locator(`#cost-${entry!.id} li[data-amount-eur]`)
        .evaluateAll((shares) =>
          shares.map((share) => share.getAttribute("data-amount-eur")),
        );
      const cents = displayedShares.map((share) => {
        const amount = share?.match(/^(\d+)\.(\d{2})$/);
        expect(amount, `exact EUR allocation missing: ${share}`).not.toBeNull();
        return Number(amount![1]) * 100 + Number(amount![2]);
      });
      expect(cents).toHaveLength(3);
      expect(cents.reduce((sum, share) => sum + share, 0)).toBe(10000);
      expect(Math.max(...cents) - Math.min(...cents)).toBe(1);
      await page.locator("#proof-file").setInputFiles({
        name: proofName,
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\n",
        ),
      });
      const uploadResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/proof-documents" &&
          response.request().method() === "POST",
        { timeout: 60_000 },
      );
      await page.getByTestId("proof-upload").click();
      expect((await uploadResponse).status()).toBe(201);
      // Text-free: 201 + working selectOption below prove upload+linkage (no toast copy).
      const [document] = await db
        .select({ id: proofDocumentsTable.id })
        .from(proofDocumentsTable)
        .where(eq(proofDocumentsTable.claimId, claim!.id));
      expect(document).toBeDefined();
      const linkResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/rpc/costs/linkDocument" &&
          response.request().method() === "POST",
      );
      await page.locator(`#link-${entry!.id}`).selectOption(document!.id);
      expect((await linkResponse).status()).toBe(200);
      await expect(
        page.locator(`#link-${entry!.id} option[value="${document!.id}"]`),
      ).toHaveCount(0);
    } finally {
      await actor.close();
    }
  });

  test("24 verifies checklist and lower-of payable, submits and cannot reopen", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await openPartnership(page, "claim");
      // Text-free hook: stable test id + design-system state only. No visible
      // copy is asserted anywhere here, so rewording never breaks this.
      const checklist = page.locator('[data-testid="submission-checklist"]');
      await expect(checklist.getByRole("listitem")).toHaveCount(7);
      // Functional state only: each item carries the pass badge variant.
      // No visible copy is asserted, so rewording never breaks this.
      await expect(
        checklist.locator('[data-slot="badge"][data-variant="status-pass"]'),
      ).toHaveCount(7);
      const band = getTravelFundingRate(Number(distance));
      expect(band).not.toBeNull();
      const [entry] = await db
        .select({ transportProfile: travelCostEntriesTable.transportProfile })
        .from(travelCostEntriesTable)
        .innerJoin(
          claimsTable,
          eq(travelCostEntriesTable.claimId, claimsTable.id),
        )
        .where(eq(claimsTable.partnershipId, partnershipId));
      const rate =
        entry!.transportProfile === "plane" ? band!.standardEur : band!.greenEur;
      const expectedPayable = Math.min(100, 3 * rate).toFixed(2);
      // Text-free: exact payable value as machine state (reword-proof), numeric compare.
      expect(
        Number(
          await page
            .locator('[data-testid="calculated-payable"]')
            .getAttribute("data-payable"),
        ),
      ).toBe(Number(expectedPayable));
      await page.getByTestId("claim-submit").click();
      // Text-free: confirm dialog ready (enabled confirm proves dialog state).
      await expect(page.getByTestId("claim-submit-confirm")).toBeEnabled();
      await page.getByTestId("claim-submit-confirm").click();
      await expect(page.locator('[data-draft-status="submitted"]')).toBeVisible();
      await expect(page.locator('[data-testid="claim-locked"]')).toBeVisible();
      await expect(page.getByTestId("cost-save")).toHaveCount(0);
      await expect(page.getByTestId("journey-save")).toHaveCount(0);
      await expect(page.getByTestId("claim-submit")).toHaveCount(0);
      await expect(
        page
          .getByTestId("claim-history")
          .locator('[data-history-event="submitted"]'),
      ).toBeVisible();
      await page.goBack();
      await expectPrivateURL(page, `/projects/${projectId}?returnTo=%2Fprojects`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(`a[href="${claimURL}"]`)).toBeVisible();
      // Text-free: readiness card carries the submitted claim state (no copy).
      await expect(
        page.locator('[data-slot="card"]').filter({
          has: page.locator('[data-claim-status="submitted"]'),
        }),
      ).toBeVisible();
      await page.goForward();
      await expectPrivateURL(page, claimURL);
      await expect(page.locator('[data-draft-status="submitted"]')).toBeVisible();
      await expect(page.locator('[data-testid="claim-locked"]')).toBeVisible();
      await expect(
        page.locator(
          '[data-testid="cost-save"], [data-testid="journey-save"], [data-testid="claim-submit"], [data-testid="claim-draft-save"]',
        ),
      ).toHaveCount(0);
      expect(await claimCount()).toBe(1);
      const [submitted] = await db
        .select({ id: claimsTable.id, status: claimsTable.status })
        .from(claimsTable)
        .where(eq(claimsTable.partnershipId, partnershipId));
      expect(submitted!.status).toBe("submitted");
      expect(
        await db
          .select({ type: claimHistoryTable.eventType })
          .from(claimHistoryTable)
          .where(eq(claimHistoryTable.claimId, submitted!.id)),
      ).toEqual([{ type: "submitted" }]);
      await page.reload();
      await expect(page.locator('[data-draft-status="submitted"]')).toBeVisible();
      await expect(page.getByTestId("cost-save")).toHaveCount(0);
      const [claim] = await db
        .select()
        .from(claimsTable)
        .where(eq(claimsTable.partnershipId, partnershipId));
      expect(claim!.status).toBe("submitted");
      expect(claim!.approvedAmountEur).toBe(expectedPayable);
      const events = await db
        .select()
        .from(claimHistoryTable)
        .where(
          and(
            eq(claimHistoryTable.claimId, claim!.id),
            eq(claimHistoryTable.eventType, "submitted"),
          ),
        );
      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.actorUserId).toBe(coordinatorId);
      expect(event.occurredAt).toBeInstanceOf(Date);
      // A locked Claim refuses the new removal control without deleting the row.
      await page.goto(participantsURL);
      const row = await participationRow(page, people[0]!.id);
      await expect(row).toBeVisible();
      await row.getByRole("button").click();
      await confirmRemoveParticipation(page);
      await expect(
        page.locator('[data-feedback-outcome="remove-refused"]'),
      ).toBeVisible();
      await expect(row).toBeVisible();
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.id, initialParticipationIds[0]!)),
      ).toHaveLength(1);
    } finally {
      await actor.close();
    }
  });
});
