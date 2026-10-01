import { randomBytes, randomUUID } from "node:crypto";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  await expect(page.getByRole("tab", { name: "Partner" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("link", { name: `CT ${suffix} Project` }).click();
  await page
    .getByRole("link", {
      name:
        destination === "participants"
          ? "Coordinate Participants"
          : "Open Claim workspace",
    })
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
  const response = await actor.request.post("/api/auth/sign-in/email", {
    data: { email: coordinatorEmail, password },
  });
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
        id: hostId,
        name: `CT ${suffix} Hosting`,
        slug: `ct-${suffix}-host`,
        createdAt: now,
      },
      {
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
        role: "project-coordinator",
        createdAt: now,
      },
      ...people.map((person) => ({
        id: randomUUID(),
        userId: person.id,
        organizationId: hostId,
        role: "participant" as const,
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
      role: "participant",
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

  test("20 adds registered V via selector and edits country only", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      const searchResponses: Promise<{
        status: number;
        foundCandidate: boolean;
      }>[] = [];
      page.on("response", (response) => {
        if (!response.url().includes("participations/searchOnboarded")) return;
        searchResponses.push(
          response.json().then((body: unknown) => ({
            status: response.status(),
            foundCandidate: JSON.stringify(body).includes(people[2]!.id),
          })),
        );
      });
      await openPartnership(page, "participants");
      await expect(
        page.getByRole("heading", { name: "Project Participations" }),
      ).toBeVisible();
      await expect(
        page.getByText("Add a registered user to this project", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(`2 Participants in CT ${suffix} Project`),
      ).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: people[0]!.name }),
      ).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: people[1]!.name }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Registered User" }).click();
      const search = page.getByRole("combobox", {
        name: /Search Registered User/,
      });
      await search.fill(people[2]!.name);
      // Discriminator: a fill-triggered debounced search may be cancelled by a
      // rerender; pressing keys individually exercises the same browser UI.
      const fillResponse = await page
        .waitForResponse(
          (response) => response.url().includes("participations/searchOnboarded"),
          { timeout: 2_000 },
        )
        .catch(() => null);
      if (!fillResponse) {
        await search.fill("");
        await search.pressSequentially(people[2]!.name, { delay: 35 });
      }
      await expect(
        page.getByRole("option", { name: new RegExp(people[2]!.name) }),
      ).toBeVisible();
      expect(
        searchResponses.length,
        "selector must send a search request",
      ).toBeGreaterThan(0);
      const received = await Promise.all(searchResponses);
      console.info("Case 20 selector evidence", {
        fillReturnedResponse: fillResponse !== null,
        sequentialTypingUsed: fillResponse === null,
        responses: received,
      });
      expect(
        received.some(
          (response) => response.status === 200 && response.foundCandidate,
        ),
        `search response status and candidate presence: ${JSON.stringify(received)}`,
      ).toBe(true);
      await page
        .getByRole("option", { name: new RegExp(people[2]!.name) })
        .click();
      await page.getByRole("button", { name: "Add Participation" }).click();
      await expect(page.getByText("Participation added")).toBeVisible();
      const row = page.getByRole("listitem").filter({ hasText: people[2]!.name });
      await expect(row).toBeVisible();
      await row.getByLabel(`Country for ${people[2]!.name}`).selectOption("DE");
      await row
        .getByRole("button", { name: `Save country for ${people[2]!.name}` })
        .click();
      await page.reload();
      await expect(page.getByLabel(`Country for ${people[2]!.name}`)).toHaveValue(
        "DE",
      );
      expect(
        await db
          .select()
          .from(projectParticipantsTable)
          .where(eq(projectParticipantsTable.projectId, projectId)),
      ).toHaveLength(3);
      await expect(
        page.getByRole("button", { name: "Show Review Tasks", exact: true }),
      ).toBeVisible();
    } finally {
      await actor.close();
    }
  });

  test("20 removes an unreferenced Project Participation and restores V through the selector", async ({
    browser,
    baseURL,
  }) => {
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      // Control-only coverage uses direct navigation; the original journey cases
      // retain Project-detail → workspace navigation coverage.
      await page.goto(participantsURL);
      const row = page.getByRole("listitem").filter({ hasText: people[2]!.name });
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
      page.once("dialog", (dialog) => dialog.accept());
      await row
        .getByRole("button", {
          name: `Remove Project Participation for ${people[2]!.name}`,
        })
        .click();
      await expect(
        page.getByText("Project Participation removed", { exact: true }),
      ).toBeVisible();
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
        .getByRole("button", { name: "Registered User", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: /Search Registered User/ })
        .pressSequentially(people[2]!.name, { delay: 35 });
      await page
        .getByRole("option", { name: new RegExp(people[2]!.name) })
        .click();
      await page.getByRole("button", { name: "Add Participation" }).click();
      await expect(
        page.getByText("Participation added", { exact: true }),
      ).toBeVisible();
      await expect(row).toBeVisible();
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

  test("20 duplicate attempts create Review Tasks that self-assign and resolve all decisions", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Three independent duplicate attempts and task lifecycles.
    const actor = await coordinatorContext(browser, baseURL!);
    try {
      const page = await actor.newPage();
      await page.goto(participantsURL);
      await page
        .getByRole("button", { name: "Show Review Tasks", exact: true })
        .click();
      const tasks = page.getByRole("region", {
        name: "Review Tasks",
        exact: true,
      });
      await expect(
        tasks.getByText(
          "No Review Tasks are recorded for this Project Partnership.",
        ),
      ).toBeVisible();
      const decisions = [
        { value: "same_person", label: "Same person" },
        { value: "distinct_persons", label: "Distinct persons" },
        { value: "dismiss", label: "Dismiss" },
      ] as const;
      for (const [index, person] of people.entries()) {
        await page
          .getByRole("button", { name: "Registered User", exact: true })
          .click();
        const search = page.getByRole("combobox", {
          name: /Search Registered User/,
        });
        await search.fill("");
        await search.pressSequentially(person.name, { delay: 35 });
        await page.getByRole("option", { name: new RegExp(person.name) }).click();
        await page
          .getByRole("button", { name: "Add Participation", exact: true })
          .click();
        await expect(
          page.getByRole("alert").filter({ hasText: "Review request" }),
        ).toContainText("No new Project Participation was added.");
        const row = tasks.getByRole("listitem").filter({ hasText: person.email });
        await expect(
          row.getByText("Review Task open", { exact: true }),
        ).toBeVisible();
        await row
          .getByRole("button", { name: "Assign Review Task to me", exact: true })
          .click();
        await expect(
          row.getByText("Review Task assigned", { exact: true }),
        ).toBeVisible();
        await expect(
          row.getByText(`Assigned Registered User: ${coordinatorId}`, {
            exact: true,
          }),
        ).toBeVisible();
        await row
          .getByLabel("Review Task decision", { exact: true })
          .selectOption(decisions[index]!.value);
        await row
          .getByRole("button", { name: "Resolve Review Task", exact: true })
          .click();
        await expect(
          row.getByText("Review Task resolved", { exact: true }),
        ).toBeVisible();
        await expect(
          row.getByText(`Decision: ${decisions[index]!.label}`, { exact: true }),
        ).toBeVisible();
        await expect(row.getByRole("button")).toHaveCount(0);
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
      await page
        .getByRole("button", { name: "Show Review Tasks", exact: true })
        .click();
      await expect(
        tasks.getByText("Review Task resolved", { exact: true }),
      ).toHaveCount(3);
      // Resolved Review Tasks retain their survivor references; the removal
      // control must surface that refusal rather than deleting the survivor.
      const survivor = page
        .getByRole("listitem")
        .filter({ hasText: people[0]!.name });
      page.once("dialog", (dialog) => dialog.accept());
      await survivor
        .getByRole("button", {
          name: `Remove Project Participation for ${people[0]!.name}`,
        })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Unable to remove Project Participation" }),
      ).toContainText(
        "This Project Participation is referenced by other records. Request review instead.",
      );
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
      await expect(
        page.getByText(
          "No Claim has been created. Opening this workspace saves nothing.",
        ),
      ).toBeVisible();
      expect(await claimCount()).toBe(0);
      await page
        .getByLabel("Account holder")
        .fill(`CT ${suffix} disposable holder`);
      await page.getByLabel("IBAN").fill(disposableIban());
      await page.getByRole("button", { name: "Create Payout Account" }).click();
      await expect(
        page.getByText(
          "Payout Account created. Select it to use it for this Claim.",
        ),
      ).toBeVisible();
      expect(await claimCount()).toBe(0);
      await expect(
        page.getByRole("button", { name: "Save Claim draft" }),
      ).toBeDisabled();
      await page
        .getByLabel("Payout Account", { exact: true })
        .selectOption({ index: 1 });
      await expect(page.getByText(/Selected Payout Account:/)).toBeVisible();
      expect(await claimCount()).toBe(0);
      await page.getByRole("button", { name: "Save Claim draft" }).click();
      await expect(page.getByText("Claim editable · saved")).toBeVisible();
      expect(await claimCount()).toBe(1);
      await page.reload();
      await expect(page.getByText("Claim editable · saved")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save Claim draft" }),
      ).toHaveCount(0);
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
        .getByLabel("Participation", { exact: true })
        .selectOption({ label: people[0]!.name });
      await page.getByRole("button", { name: "Save journey" }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: /Too small: expected string/ }),
      ).toHaveCount(2);
      await expect(
        page.getByRole("alert").filter({ hasText: /distance/i }),
      ).toBeVisible();
      for (const person of people) {
        await page
          .getByLabel("Participation", { exact: true })
          .selectOption({ label: person.name });
        await page.getByLabel("Origin", { exact: true }).fill("Berlin");
        await page.getByLabel("Destination", { exact: true }).fill("Riga");
        await page
          .getByLabel("Trip type", { exact: true })
          .selectOption("round-trip");
        await page
          .getByLabel("Erasmus Distance-Calculator distance (km)", {
            exact: true,
          })
          .fill(distance);
        await page.getByRole("button", { name: "Save journey" }).click();
        await expect(
          page
            .getByRole("listitem")
            .filter({ hasText: `${person.name}: Berlin → Riga` }),
        ).toBeVisible();
        await expect(
          page
            .getByLabel("Participation", { exact: true })
            .locator("option", { hasText: person.name }),
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
      await expect(
        page
          .getByRole("listitem")
          .filter({ hasText: `${people[0]!.name}: Berlin → Riga` }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Participation", { exact: true }).locator("option"),
      ).toHaveCount(1);
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
      const row = page.getByRole("listitem").filter({ hasText: people[0]!.name });
      await expect(row).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await row
        .getByRole("button", {
          name: `Remove Project Participation for ${people[0]!.name}`,
        })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Unable to remove Project Participation" }),
      ).toContainText(
        "This Project Participation is referenced by a Participant Journey, Claim or merge data. Request review instead.",
      );
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
      await page.getByLabel("Exact total (EUR)").fill("0");
      await page.getByRole("button", { name: "Save cost" }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: /positive|greater|amount/i }),
      ).toBeVisible();
      await expect(page.getByText("No costs saved yet.")).toBeVisible();
      await page.getByLabel("Exact total (EUR)").fill("100.00");
      await page.getByLabel("Allocation method").selectOption("amount");
      for (const person of people)
        await page
          .getByRole("group", { name: "Covered Participations" })
          .getByLabel(person.name)
          .check();
      for (const person of people)
        await page.getByLabel(`${person.name} EUR share`).fill("33.33");
      await page.getByRole("button", { name: "Save cost" }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: /total|share|allocation/i }),
      ).toBeVisible();
      await expect(page.getByText("No costs saved yet.")).toBeVisible();
      await page.getByLabel("Allocation method").selectOption("equal");
      await page.getByRole("button", { name: "Save cost" }).click();
      await expect(page.getByText(/100\.00 EUR · equal/)).toBeVisible();
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
        .locator(`#cost-${entry!.id}`)
        .getByRole("listitem")
        .allTextContents();
      const cents = displayedShares.map((share) => {
        const amount = share.match(/: (\d+)\.(\d{2}) EUR \(computed\)/);
        expect(amount, `exact EUR allocation missing: ${share}`).not.toBeNull();
        return Number(amount![1]) * 100 + Number(amount![2]);
      });
      expect(cents).toHaveLength(3);
      expect(cents.reduce((sum, share) => sum + share, 0)).toBe(10000);
      expect(Math.max(...cents) - Math.min(...cents)).toBe(1);
      await page.getByLabel(/Upload Proof Document/).setInputFiles({
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
      await page.getByRole("button", { name: "Upload document" }).click();
      expect((await uploadResponse).status()).toBe(201);
      await expect(page.getByText("Proof Document uploaded.")).toBeVisible();
      await expect(
        page.getByText(new RegExp(proofName, "i")).first(),
      ).toBeVisible();
      await page
        .getByLabel("Link a Proof Document to this cost")
        .selectOption({ label: proofName });
      await expect(page.getByText("Proof Document linked.")).toBeVisible();
      await expect(page.getByText(`Linked: ${proofName}`)).toBeVisible();
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
      const checklist = page.getByRole("list", { name: "Submission checklist" });
      await expect(checklist.getByRole("listitem")).toHaveCount(7);
      await expect(checklist.getByText(/^Pass:/)).toHaveCount(7);
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
      await expect(
        page.getByText(`Calculated payable: ${expectedPayable} EUR`, {
          exact: false,
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Submit Claim" }).click();
      await expect(
        page.getByText(/Confirm submission: submission locks/),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm submission" }).click();
      await expect(page.getByText("Claim submitted · saved")).toBeVisible();
      await expect(
        page.getByText(/This Claim is locked for Partner editing/),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Save cost" })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("button", { name: "Save journey" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Submit Claim" }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("region", { name: "Claim history" })
          .getByRole("listitem")
          .filter({ hasText: coordinatorId }),
      ).toContainText("Submitted");
      await page.goBack();
      await page.goto(claimURL);
      await page.reload();
      await expect(page.getByText("Claim submitted · saved")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save cost" })).toHaveCount(
        0,
      );
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
      const row = page.getByRole("listitem").filter({ hasText: people[0]!.name });
      await expect(row).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await row
        .getByRole("button", {
          name: `Remove Project Participation for ${people[0]!.name}`,
        })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Unable to remove Project Participation" }),
      ).toContainText(
        "A locked Claim prevents removal of this Project Participation.",
      );
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
