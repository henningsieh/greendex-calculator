import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  account,
  invitation,
  member,
  organization,
  partnerOrganizationSetupLinksTable as setupLinks,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  expectPrivateURL,
  expect,
  test,
  registerPrivateValues,
} from "./fixtures/artifact-privacy";
import { expectFirstOrganizationProjects } from "./fixtures/first-organization";
import { HostingJourneyFixture } from "./fixtures/hosting-journey";
import { projectLink, staffRow } from "./fixtures/journey-locators";
import { postSignInWithRateLimitRetry } from "./fixtures/rate-limit-retry";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: beforeAll seeds verified recipient Users and credential
// accounts, then signs each into its own browser context through the auth API.
// The nested beforeAll hooks issue fresh 07/11 setup links directly in the DB;
// these are redemption preconditions, not evidence of UI issuance. Case 10's
// Organization Invitation is likewise DB-issued after E creates its Organization.
// H's verified User is supplied by HostingJourneyFixture. No registration,
// verification, or mail-sending invitation form is submitted in a browser.
// Setup-link creation (05/08/09/13) is UI-only: createSetupLink in
// features/projects/procedures/setup-links.ts persists a hash and returns a
// secret; it does not invoke mail delivery. Artifact protection is described above.
// Mail delivery is covered by setup-links.integration.test.ts and manual testing.
// AUTOMATED-ONLY: 07 wrong-email server denial, 11 forged Owner-selection
// (entity-search.integration.test.ts and setup-links.integration.test.ts),
// 12 forged/self/duplicate enforcement (partnerships.integration.test.ts).
// Case 13 proves persisted Hosting-scoped setup-link rows, one-link closure,
// disabled-link refusal, and independent redemption of both sibling links.
// ADR-0012: M is an Organization Admin, never Better Auth's fallback role.
// Membership grants no Project Participation or Organization ownership.
const fixture = new HostingJourneyFixture();
const suffix = fixture.suffix;
const names = {
  P: `CT ${suffix} Partner A`,
  F: `CT ${suffix} Partner B`,
  E: `CT ${suffix} Existing Organization`,
  R: `CT ${suffix} Retained Organization`,
  U: `CT ${suffix} Uncertain Organization`,
  D: `CT ${suffix} Corrected Organization`,
};
const actors = Object.fromEntries(
  (["P", "F", "E", "M", "R", "U", "D"] as const).map((actor) => [
    actor,
    {
      id: randomUUID(),
      name: `CT ${suffix} ${actor}`,
      email: `ct-${suffix}-${actor.toLowerCase()}@example.invalid`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "P" | "F" | "E" | "M" | "R" | "U" | "D",
  { id: string; name: string; email: string; password: string }
>;
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));
const adminProjectName = `CT ${suffix} Admin disposable`;
const ownedProjectNames = [...fixture.projectNames, adminProjectName];
const invitationId = randomUUID();
const contexts: BrowserContext[] = [];
const issuedLinks: string[] = [];
const canonicalSessionIds: string[] = [];
let projectURLs: string[] = [];
let setupURL = "";
let existingSetupURL = "";
let closedSetupURL = "";
let siblingSetupURLs: string[] = [];
let baseline: {
  users: number;
  organizations: number;
  projects: number;
  links: number;
  partnerships: number;
  invitations: number;
};

async function counts() {
  const ids = Object.values(actors).map((actor) => actor.id);
  const [
    [users],
    [organizations],
    [projects],
    [links],
    [assigned],
    [invitations],
  ] = await Promise.all([
    db.select({ value: count() }).from(user).where(inArray(user.id, ids)),
    db
      .select({ value: count() })
      .from(organization)
      .where(inArray(organization.name, Object.values(names))),
    db
      .select({ value: count() })
      .from(projectsTable)
      .where(inArray(projectsTable.name, ownedProjectNames)),
    db
      .select({ value: count() })
      .from(setupLinks)
      .where(
        inArray(setupLinks.id, issuedLinks.length ? issuedLinks : ["no-link"]),
      ),
    db
      .select({ value: count() })
      .from(partnerships)
      .innerJoin(projectsTable, eq(partnerships.projectId, projectsTable.id))
      .where(inArray(projectsTable.name, ownedProjectNames)),
    db
      .select({ value: count() })
      .from(invitation)
      .where(eq(invitation.id, invitationId)),
  ]);
  return {
    users: users!.value,
    organizations: organizations!.value,
    projects: projects!.value,
    links: links!.value,
    partnerships: assigned!.value,
    invitations: invitations!.value,
  };
}

async function actorContext(
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
  expect(response.ok(), `${actor} setup sign-in failed`).toBe(true);
  return context;
}

const actingSessionSchema = z.object({
  session: z.object({ activeOrganizationId: z.string() }),
});

async function entityId(
  table: typeof projectsTable | typeof organization,
  name: string,
) {
  const [entity] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.name, name));
  expect(entity).toBeDefined();
  return entity!.id;
}

async function selectEntity(
  page: Page,
  label: string,
  entityId: string,
  scope: Locator = page.locator("body"),
) {
  await scope.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("combobox", { name: `Search ${label} by name or ID` })
    .fill(entityId);
  await page.locator(`[role="option"][data-entity-id="${entityId}"]`).click();
  await expect(
    scope.getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
}

async function openOrganizationDialog(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Create Organization" });
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Create Organization" }).click();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Start date").fill("2027-04-01");
  await dialog.getByLabel("End date").fill("2027-04-03");
  await dialog.getByLabel("Location").fill("Berlin");
  await dialog.getByLabel("Country").selectOption("DE");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByTestId("project-workspace")).toBeVisible();
  await expect(page.locator('[data-relationship="hosted"]')).toBeVisible();
  return new URL(page.url()).pathname;
}

async function issueThroughUI(
  page: Page,
  projectName: string,
  recipient: string,
) {
  await page.goto("/partner-organizations");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const creator = page
    .locator("section")
    .filter({ has: page.getByLabel("Recipient email", { exact: true }) });
  await selectEntity(
    page,
    "Hosted Project",
    await entityId(projectsTable, projectName),
    creator,
  );
  await creator.getByLabel("Recipient email").fill(recipient);
  await creator.getByRole("button", { name: "Neuer Link", exact: true }).click();
  const field = creator.getByLabel("Recipient setup link");
  // Preserve the original setup-link value regex, without reporting its value.
  await expect
    .poll(async () =>
      /\/setup-links\/[^?]+\?secret=/.test(await field.inputValue()),
    )
    .toBe(true);
  const url = await field.inputValue();
  const parsed = new URL(url);
  expect(parsed.origin).toBe(new URL(page.url()).origin);
  issuedLinks.push(parsed.pathname.split("/").at(-1)!);
  // Copy is a visible user action. Value matcher diagnostics are boolean-only;
  // reporter/snapshot privacy remains the documented follow-up.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await creator.getByRole("button", { name: "Kopieren" }).click();
  // Text-free: clipboard holds the copied URL (functional proof the copy worked).
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  return url;
}

async function issueInSetup(projectName: string, recipient: string) {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.name, projectName));
  expect(
    project,
    "Hosted Project must exist from the browser journey",
  ).toBeDefined();
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  await db.insert(setupLinks).values({
    id,
    projectId: project!.id,
    recipientEmail: recipient,
    secretHash: createHash("sha256").update(secret).digest("hex"),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByUserId: fixture.actors.H.id,
  });
  issuedLinks.push(id);
  return `/setup-links/${id}?secret=${secret}`;
}

async function openPartnerProject(page: Page, name: string) {
  await page.goto("/projects");
  const link = await projectLink(page, name);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('[data-relationship="partner"]')).toBeVisible();
}

async function markSetupDocument(page: Page) {
  await page.evaluate((value) => {
    (
      window as Window & { setupDocumentIdentity?: string }
    ).setupDocumentIdentity = value;
  }, randomUUID());
}

async function selectAndOpenPartnerProject(
  page: Page,
  projectName: string,
  organizationName: string,
) {
  const documentIdentity = await page.evaluate(
    () =>
      (window as Window & { setupDocumentIdentity?: string })
        .setupDocumentIdentity,
  );
  expect(typeof documentIdentity).toBe("string");
  await page
    .getByRole("button", { name: "Use this Organization", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open Partner Project", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('[data-relationship="partner"]')).toBeVisible();
  const [selectedOrganization] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.name, organizationName));
  const acting = await page.request.get("/api/auth/get-session");
  expect(
    actingSessionSchema.parse(await acting.json()).session.activeOrganizationId,
  ).toBe(selectedOrganization!.id);
  await page
    .getByRole("link", { name: "Open Claim workspace", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Payout Account", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { setupDocumentIdentity?: string })
          .setupDocumentIdentity,
    ),
  ).toBe(documentIdentity);
}

async function assertRecipientPersistence(
  actor: "R" | "U",
  organizationId: string,
  projectName: string,
) {
  const memberships = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, actors[actor].id));
  expect(memberships).toEqual([
    { organizationId, role: ORGANIZATION_ROLES.OrganizationOwner },
  ]);
  expect(await partnershipCount(projectName, names[actor])).toBe(1);
}

async function completeNew(page: Page, url: string, name: string) {
  await page.goto(url);
  // Text-free: the setup form interactions below prove the page (no heading copy).
  await page.getByLabel("New Organization name").fill(name);
  await page.getByLabel("Organization country").selectOption("DE");
  await markSetupDocument(page);
  await page.getByRole("button", { name: "Complete setup" }).click();
  await expect(
    page.getByRole("button", { name: "Use this Organization", exact: true }),
  ).toBeVisible();
}

async function partnershipCount(projectName: string, organizationName: string) {
  const [result] = await db
    .select({ value: count() })
    .from(partnerships)
    .innerJoin(projectsTable, eq(partnerships.projectId, projectsTable.id))
    .innerJoin(organization, eq(partnerships.organizationId, organization.id))
    .where(
      and(
        eq(projectsTable.name, projectName),
        eq(organization.name, organizationName),
      ),
    );
  return result!.value;
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Partner Organization setup journey section 2", () => {
  test.beforeAll(async () => {
    baseline = await counts();
    await fixture.setup();
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
        providerId: "credential",
        userId: actor.id,
        password: await hashPassword(actor.password),
      });
    }
  });
  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    if (canonicalSessionIds.length)
      await db.delete(session).where(inArray(session.id, canonicalSessionIds));
    // Remove link references before deleting the UI-created Projects/Partnerships.
    if (issuedLinks.length)
      await db.delete(setupLinks).where(inArray(setupLinks.id, issuedLinks));
    await db.delete(invitation).where(eq(invitation.id, invitationId));
    for (const name of ownedProjectNames)
      await db.delete(projectsTable).where(eq(projectsTable.name, name));
    for (const name of Object.values(names)) {
      const [org] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.name, name));
      if (org) {
        await db.delete(member).where(eq(member.organizationId, org.id));
        await db.delete(organization).where(eq(organization.id, org.id));
      }
    }
    for (const actor of Object.values(actors)) {
      await db.delete(session).where(eq(session.userId, actor.id));
      await db.delete(user).where(eq(user.id, actor.id));
    }
    await fixture.teardown();
    expect(await counts()).toEqual(baseline);
  });

  test("05 H creates and copies P's Main Partner-Organization Setup Link", async ({
    browser,
    baseURL,
  }) => {
    const host = await fixture.actorContext(browser, "H", baseURL!);
    const page = await host.newPage();
    await page.goto("/projects");
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    const dialog = await openOrganizationDialog(page);
    await dialog.getByLabel("Organization name").fill(fixture.organizationName);
    await dialog.getByLabel("Organization country").selectOption("DE");
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(dialog).toBeHidden();
    await expectFirstOrganizationProjects(page, fixture.organizationName);
    projectURLs = [];
    for (const name of fixture.projectNames)
      projectURLs.push(await createProject(page, name));
    setupURL = await issueThroughUI(
      page,
      fixture.projectNames[0]!,
      actors.P.email,
    );
    expect(await partnershipCount(fixture.projectNames[0]!, names.P)).toBe(0);
  });

  test("06 P reopens after signed-out sign-in, creates Partner A once, replay is idempotent", async ({
    browser,
    baseURL,
  }) => {
    const anonymous = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    contexts.push(anonymous);
    const signedOut = await anonymous.newPage();
    await signedOut.goto(setupURL);
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(signedOut, /\/login/);
    const partner = await actorContext(browser, "P", baseURL!);
    const page = await partner.newPage();
    await page.goto("/projects");
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await completeNew(page, setupURL, names.P);
    expect(await partnershipCount(fixture.projectNames[0]!, names.P)).toBe(1);
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, names.P);
    await page.goto(setupURL);
    // Text-free: creation proven by the adjacent DB/navigation assertions (no toast copy).
    await expect(page.getByLabel("New Organization name")).toHaveCount(0);
    expect(await partnershipCount(fixture.projectNames[0]!, names.P)).toBe(1);
    const [hostingMembership] = await db
      .select({ id: member.id })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, actors.P.id),
          eq(organization.name, fixture.organizationName),
        ),
      );
    expect(hostingMembership).toBeUndefined();
  });

  test("06 duplicate slug refusal allows a corrected name, successful setup and revisit", async ({
    browser,
    baseURL,
  }) => {
    const url = await issueInSetup(fixture.projectNames[0]!, actors.D.email);
    const context = await actorContext(browser, "D", baseURL!);
    const page = await context.newPage();
    await page.goto("/projects");
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await page.goto(url);
    await page.getByLabel("New Organization name").fill(`${names.P}!`);
    await page.getByLabel("Organization country").selectOption("DE");
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(page.locator('[data-setup-error="create"]')).toBeVisible();
    // Text-free: zero membership + zero partnership below prove graceful failure (no copy).
    const [membership] = await db
      .select({ value: count() })
      .from(member)
      .where(eq(member.userId, actors.D.id));
    expect(membership!.value).toBe(0);
    expect(await partnershipCount(fixture.projectNames[0]!, names.D)).toBe(0);
    await expect(page.getByLabel("New Organization name")).toBeVisible();
    await page.getByLabel("New Organization name").fill(names.D);
    await markSetupDocument(page);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[0]!, names.D)).toBe(1);
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, names.D);
    const [created] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, names.D));
    expect(created).toBeDefined();
    await page.goto(url);
    // Text-free: input absence + DB ownership below prove creation (no toast copy).
    await expect(page.getByLabel("New Organization name")).toHaveCount(0);
    const owned = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, actors.D.id));
    expect(owned).toEqual([{ organizationId: created!.id }]);
    expect(await partnershipCount(fixture.projectNames[0]!, names.D)).toBe(1);
  });

  test("06a a real creation survives binding refusal and exact retry, revisit and reload", async ({
    browser,
    baseURL,
  }) => {
    const url = await issueInSetup(fixture.projectNames[0]!, actors.R.email);
    const id = new URL(url, baseURL).pathname.split("/").at(-1)!;
    const context = await actorContext(browser, "R", baseURL!);
    const page = await context.newPage();
    let attempts = 0;
    await page.route(
      "**/api/rpc/projectPartnerships/consumeSetupLink**",
      async (route) => {
        attempts++;
        if (attempts === 1)
          await db
            .update(setupLinks)
            .set({ enabled: false })
            .where(eq(setupLinks.id, id));
        await route.continue();
      },
    );
    await page.goto(url);
    await page.getByLabel("New Organization name").fill(names.R);
    await page.getByLabel("Organization country").selectOption("DE");
    await markSetupDocument(page);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(page.locator('[data-setup-error="disabled"]')).toBeVisible();
    // Text-free: retained org proven by the DB select below (no copy).
    const [created] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, names.R));
    expect(created).toBeDefined();
    const organizationId = created!.id;
    expect(await partnershipCount(fixture.projectNames[0]!, names.R)).toBe(0);
    await db
      .update(setupLinks)
      .set({ enabled: true })
      .where(eq(setupLinks.id, id));
    await page.getByRole("button", { name: "Inspect setup result" }).click();
    await expect(
      page.getByRole("button", {
        name: "Retry setup with retained Organization",
      }),
    ).toBeVisible();
    expect(attempts).toBe(1);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(url);
    // Text-free: retained-org state proven by absent name input + attempts counter below (no copy).
    await expect(page.getByLabel("New Organization name")).toHaveCount(0);
    await page.reload();
    // Text-free: retained-org state proven by attempts counter + retry flow below (no copy).
    expect(attempts).toBe(1);
    await markSetupDocument(page);
    await page
      .getByRole("button", { name: "Retry setup with retained Organization" })
      .click();
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(attempts).toBe(2);
    const retained = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, names.R));
    expect(retained).toEqual([{ id: organizationId }]);
    await assertRecipientPersistence(
      "R",
      organizationId,
      fixture.projectNames[0]!,
    );
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, names.R);
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(attempts).toBe(2);
    await assertRecipientPersistence(
      "R",
      organizationId,
      fixture.projectNames[0]!,
    );
  });

  test("06b an uncertain successful redemption is inspected instead of repeated", async ({
    browser,
    baseURL,
  }) => {
    const url = await issueInSetup(fixture.projectNames[0]!, actors.U.email);
    const context = await actorContext(browser, "U", baseURL!);
    const page = await context.newPage();
    let attempts = 0;
    await page.route(
      "**/api/rpc/projectPartnerships/consumeSetupLink**",
      async (route) => {
        attempts++;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort("failed");
      },
    );
    await page.goto(url);
    await page.getByLabel("New Organization name").fill(names.U);
    await page.getByLabel("Organization country").selectOption("DE");
    await markSetupDocument(page);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(
      page.getByRole("button", { name: "Inspect setup result", exact: true }),
    ).toBeEnabled();
    expect(await partnershipCount(fixture.projectNames[0]!, names.U)).toBe(1);
    await expect(
      page.getByRole("button", { name: "Complete setup" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Inspect setup result" }).click();
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(attempts).toBe(1);
    const [created] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, names.U));
    await assertRecipientPersistence("U", created!.id, fixture.projectNames[0]!);
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, names.U);
    await page.goto(url);
    // Text-free: creation proven by the adjacent DB/navigation assertions (no toast copy).
    expect(attempts).toBe(1);
    await assertRecipientPersistence("U", created!.id, fixture.projectNames[0]!);
  });

  test("known-invalid links refuse before any Organization or Partnership mutation", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "X", baseURL!);
    const page = await context.newPage();
    const x = fixture.actors.X;
    const before = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, x.id));
    const [[organizationsBefore], [partnershipsBefore]] = await Promise.all([
      db.select({ value: count() }).from(organization),
      db.select({ value: count() }).from(partnerships),
    ]);
    const scenarios = [
      { name: "missing", state: "invalid" },
      { name: "secret", state: "invalid" },
      { name: "disabled", state: "disabled" },
      { name: "expired", state: "expired" },
      { name: "project", state: "unavailable" },
      { name: "verification", state: "verify-email" },
    ];
    for (const scenario of scenarios) {
      const url = await issueInSetup(fixture.projectNames[2]!, x.email);
      const parsed = new URL(url, baseURL);
      const id = parsed.pathname.split("/").at(-1)!;
      const [link] = await db
        .select({ projectId: setupLinks.projectId })
        .from(setupLinks)
        .where(eq(setupLinks.id, id));
      if (scenario.name === "missing")
        parsed.pathname = `/setup-links/${randomUUID()}`;
      if (scenario.name === "secret")
        parsed.searchParams.set("secret", "incorrect-secret");
      if (scenario.name === "disabled")
        await db
          .update(setupLinks)
          .set({ enabled: false })
          .where(eq(setupLinks.id, id));
      if (scenario.name === "expired")
        await db
          .update(setupLinks)
          .set({ expiresAt: new Date(0) })
          .where(eq(setupLinks.id, id));
      if (scenario.name === "project")
        await db
          .update(projectsTable)
          .set({ archived: true })
          .where(eq(projectsTable.id, link!.projectId));
      if (scenario.name === "verification")
        await db
          .update(user)
          .set({ emailVerified: false })
          .where(eq(user.id, x.id));
      try {
        await page.goto(parsed.toString());
        await expect(
          page.locator(`[data-setup-error="${scenario.state}"]`),
        ).toBeVisible();
        await expect(page.getByLabel("New Organization name")).toHaveCount(0);
        const [stored] = await db
          .select({ partnershipId: setupLinks.partnershipId })
          .from(setupLinks)
          .where(eq(setupLinks.id, id));
        expect(stored?.partnershipId).toBeNull();
        expect(await db.select({ value: count() }).from(organization)).toEqual([
          organizationsBefore,
        ]);
        expect(await db.select({ value: count() }).from(partnerships)).toEqual([
          partnershipsBefore,
        ]);
        expect(
          await db
            .select({ id: member.id })
            .from(member)
            .where(eq(member.userId, x.id)),
        ).toEqual(before);
      } finally {
        if (scenario.name === "project")
          await db
            .update(projectsTable)
            .set({ archived: false })
            .where(eq(projectsTable.id, link!.projectId));
        if (scenario.name === "verification")
          await db
            .update(user)
            .set({ emailVerified: true })
            .where(eq(user.id, x.id));
      }
    }
  });

  test.describe("fresh wrong-email setup precondition", () => {
    let wrongEmailURL: string;
    test.beforeAll(async () => {
      wrongEmailURL = await issueInSetup(
        fixture.projectNames[0]!,
        actors.P.email,
      );
    });
    test("07 X is refused on a fresh P-addressed link without creating an Organization or Partnership", async ({
      browser,
      baseURL,
    }) => {
      const stranger = await fixture.actorContext(browser, "X", baseURL!);
      const page = await stranger.newPage();
      await page.goto(wrongEmailURL);
      // Text-free: error hook + input absence below prove the wrong-email state (no copy).
      const attemptedName = `CT ${suffix} Wrong Email`;
      await expect(
        page.locator('[data-setup-error="wrong-email"]'),
      ).toBeVisible();
      await expect(page.getByLabel("New Organization name")).toHaveCount(0);
      expect(
        await partnershipCount(fixture.projectNames[0]!, attemptedName),
      ).toBe(0);
      const [created] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.name, attemptedName));
      expect(created).toBeUndefined();
      expect(await partnershipCount(fixture.projectNames[0]!, names.P)).toBe(1);
    });
  });

  test("08 F creates a separate Main Project Partnership without P's workspace", async ({
    browser,
    baseURL,
  }) => {
    const host = await fixture.actorContext(browser, "H", baseURL!);
    const url = await issueThroughUI(
      await host.newPage(),
      fixture.projectNames[0]!,
      actors.F.email,
    );
    const partner = await actorContext(browser, "F", baseURL!);
    const page = await partner.newPage();
    await completeNew(page, url, names.F);
    expect(await partnershipCount(fixture.projectNames[0]!, names.F)).toBe(1);
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, names.F);
    // Text-free: the helper proves F's own view (own assertions inside); P-absence subsumed.
  });

  test("09 E creates an Organization and selects it on the Existing Project link", async ({
    browser,
    baseURL,
  }) => {
    const partner = await actorContext(browser, "E", baseURL!);
    const page = await partner.newPage();
    await page.goto("/projects");
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    const dialog = await openOrganizationDialog(page);
    await dialog.getByLabel("Organization name").fill(names.E);
    await dialog.getByLabel("Organization country").selectOption("DE");
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(dialog).toBeHidden();
    await expectFirstOrganizationProjects(page, names.E);
    const host = await fixture.actorContext(browser, "H", baseURL!);
    existingSetupURL = await issueThroughUI(
      await host.newPage(),
      fixture.projectNames[1]!,
      actors.E.email,
    );
    await page.goto(existingSetupURL);
    await page.getByRole("radio", { name: "Existing Organization" }).check();
    await selectEntity(
      page,
      "Organization",
      await entityId(organization, names.E),
    );
    await markSetupDocument(page);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[1]!, names.E)).toBe(1);
  });

  test("09a existing ownership preserves an unrelated acting Organization until explicit choice", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    contexts.push(context);
    const beforeSessions = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, "picker-user-canonical"));
    const signedIn = await postSignInWithRateLimitRetry(
      context.request,
      "picker-user-canonical@example.com",
      SEED_USER.password,
    );
    expect(signedIn.ok()).toBe(true);
    const afterSessions = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, "picker-user-canonical"));
    canonicalSessionIds.push(
      ...afterSessions
        .filter(
          ({ id }) => !beforeSessions.some((previous) => previous.id === id),
        )
        .map(({ id }) => id),
    );
    const unrelatedId = "owned-result-30-canonical";
    const targetId = "owned-result-31-canonical";
    const targetName = "Owned Search canonical 31";
    const selected = await context.request.post(
      "/api/auth/organization/set-active",
      {
        headers: { Origin: baseURL! },
        data: { organizationId: unrelatedId },
      },
    );
    expect(selected.ok()).toBe(true);
    const membershipsBefore = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, "picker-user-canonical"));
    const url = await issueInSetup(
      fixture.projectNames[0]!,
      "picker-user-canonical@example.com",
    );
    const page = await context.newPage();
    const linkId = new URL(url, baseURL).pathname.split("/").at(-1)!;
    let bindingAttempts = 0;
    await page.route(
      "**/api/rpc/projectPartnerships/consumeSetupLink**",
      async (route) => {
        bindingAttempts++;
        if (bindingAttempts === 1)
          await db
            .update(setupLinks)
            .set({ enabled: false })
            .where(eq(setupLinks.id, linkId));
        await route.continue();
      },
    );
    await page.goto("/projects");
    await expect(
      page.getByRole("button", { name: /Switch Organization/ }),
    ).toBeVisible();
    await page.goto(url);
    await page.getByRole("radio", { name: "Existing Organization" }).check();
    await selectEntity(page, "Organization", targetId);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(page.locator('[data-setup-error="disabled"]')).toBeVisible();
    expect(bindingAttempts).toBe(1);
    expect(await partnershipCount(fixture.projectNames[0]!, targetName)).toBe(0);
    await db
      .update(setupLinks)
      .set({ enabled: true })
      .where(eq(setupLinks.id, linkId));
    await page.reload();
    // Text-free: retained-org state proven by absent name input + setup flow below (no copy).
    await expect(page.getByLabel("New Organization name")).toHaveCount(0);
    await markSetupDocument(page);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(
      page.getByRole("button", { name: "Use this Organization", exact: true }),
    ).toBeVisible();
    expect(bindingAttempts).toBe(2);
    const unchanged = await context.request.get("/api/auth/get-session");
    expect(
      actingSessionSchema.parse(await unchanged.json()).session
        .activeOrganizationId,
    ).toBe(unrelatedId);
    expect(await partnershipCount(fixture.projectNames[0]!, targetName)).toBe(1);
    await selectAndOpenPartnerProject(page, fixture.projectNames[0]!, targetName);
    const acting = await context.request.get("/api/auth/get-session");
    expect(
      actingSessionSchema.parse(await acting.json()).session.activeOrganizationId,
    ).toBe(targetId);
    const membershipsAfter = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, "picker-user-canonical"));
    expect(membershipsAfter.map(({ id }) => id).sort()).toEqual(
      membershipsBefore.map(({ id }) => id).sort(),
    );
  });

  test.describe("admin invitation precondition", () => {
    test.beforeAll(async () => {
      const [org] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.name, names.E));
      expect(org).toBeDefined();
      await db.insert(invitation).values({
        id: invitationId,
        organizationId: org!.id,
        email: actors.M.email,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        status: "pending",
        expiresAt: new Date(Date.now() + 3_600_000),
        inviterId: actors.E.id,
      });
    });
    test("10 M explicitly accepts E's Organization Invitation as admin, not Participant", async ({
      browser,
      baseURL,
    }) => {
      const owner = await actorContext(browser, "E", baseURL!);
      const ownerPage = await owner.newPage();
      await ownerPage.goto("/organization");
      await expect(
        ownerPage.getByTestId(`staff-invitation-${invitationId}`),
      ).toBeVisible();
      const [pendingInvitation] = await db
        .select({ role: invitation.role })
        .from(invitation)
        .where(eq(invitation.id, invitationId));
      expect(pendingInvitation?.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
      const context = await actorContext(browser, "M", baseURL!);
      const page = await context.newPage();
      await page.goto(`/accept-invitation/${invitationId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Text-free: enabled Accept proves the invitation loaded for E (no name copy).
      await page
        .getByRole("button", { name: "Accept Organization Invitation" })
        .click();
      // Preserve the original full-URL match; only the diagnostic receives a boolean.
      await expectPrivateURL(page, /\/projects$/);
      await page.goto("/organization");
      await expect(page.locator('[data-testid="staff-invite"]')).toBeVisible();
      await expect(
        (await staffRow(page, actors.M.id)).getByTestId(
          `staff-role-${ORGANIZATION_ROLES.OrganizationAdmin}`,
        ),
      ).toBeVisible();
      await ownerPage.reload();
      await expect(
        (await staffRow(ownerPage, actors.M.id)).getByTestId(
          `staff-role-${ORGANIZATION_ROLES.OrganizationAdmin}`,
        ),
      ).toBeVisible();
      const [participation] = await db
        .select({ id: projectParticipantsTable.id })
        .from(projectParticipantsTable)
        .where(eq(projectParticipantsTable.userId, actors.M.id));
      expect(participation).toBeUndefined();
      expect(await partnershipCount(fixture.projectNames[1]!, names.E)).toBe(1);
    });
  });

  test("admin-created disposable Project stays in E's Organization", async ({
    browser,
    baseURL,
  }) => {
    const [membership] = await db
      .select({ role: member.role, organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, actors.M.id));
    expect(membership?.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
    const context = await actorContext(browser, "M", baseURL!);
    const page = await context.newPage();
    // Admin authority is Organization-wide, unlike assignment-only coordination.
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Text-free: hydrated project list + DB proof below prove successful load (no error).
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New project" })).toBeVisible();
    try {
      await createProject(page, adminProjectName);
      await page.goto("/projects");
      await expect(await projectLink(page, adminProjectName)).toBeVisible();
      const [created] = await db
        .select({ organizationId: projectsTable.organizationId })
        .from(projectsTable)
        .where(eq(projectsTable.name, adminProjectName));
      expect(created?.organizationId).toBe(membership!.organizationId);
    } finally {
      await db
        .delete(projectsTable)
        .where(eq(projectsTable.name, adminProjectName));
    }
  });

  test.describe("admin Owner-selection precondition", () => {
    let adminSetupURL: string;
    test.beforeAll(async () => {
      adminSetupURL = await issueInSetup(
        fixture.projectNames[2]!,
        actors.M.email,
      );
    });
    test("11 M cannot select E's Organization on a fresh Isolation setup link", async ({
      browser,
      baseURL,
    }) => {
      const context = await actorContext(browser, "M", baseURL!);
      const page = await context.newPage();
      await page.goto(adminSetupURL);
      await page.getByRole("radio", { name: "Existing Organization" }).check();
      await page
        .getByRole("button", { name: "Organization", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Search Organization by name or ID" })
        .fill(names.E);
      // Text-free: disabled Complete setup + zero partnership below prove no-match (no copy).
      await expect(
        page.getByRole("button", { name: "Complete setup" }),
      ).toBeDisabled();
      expect(await partnershipCount(fixture.projectNames[2]!, names.E)).toBe(0);
    });
  });

  test("12 H directly assigns E's Organization to Isolation, not Existing", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    await page.goto("/partner-organizations");
    await expect(
      page.locator('[data-testid="organization-assignment"]'),
    ).toBeVisible();
    const section = page.getByTestId("organization-assignment");
    await selectEntity(
      page,
      "Hosted Project",
      await entityId(projectsTable, fixture.projectNames[2]!),
      section,
    );
    await selectEntity(
      page,
      "Partner Organization",
      await entityId(organization, names.E),
      section,
    );
    await section.getByRole("button", { name: "Assign", exact: true }).click();
    await expect
      .poll(() => partnershipCount(fixture.projectNames[2]!, names.E))
      .toBe(1);
    expect(await partnershipCount(fixture.projectNames[1]!, names.E)).toBe(1);
    // UI selectors are not server authorization; forged/self/duplicate requests
    // are asserted in partnerships.integration.test.ts (AUTOMATED-ONLY).
  });

  test("13 H lists existing setup links and closes one; both siblings remain usable", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    closedSetupURL = await issueThroughUI(
      page,
      fixture.projectNames[2]!,
      actors.P.email,
    );
    siblingSetupURLs = [
      await issueThroughUI(page, fixture.projectNames[2]!, actors.P.email),
      await issueThroughUI(page, fixture.projectNames[2]!, actors.F.email),
    ];
    const idFrom = (url: string) => new URL(url).pathname.split("/").at(-1)!;
    await page.reload();
    const list = page.getByRole("region", {
      name: "Existing Partner Organization Setup Links",
    });
    for (const id of issuedLinks)
      await expect(list.locator(`[data-setup-link-id="${id}"]`)).toHaveCount(1);
    const closedRow = list.locator(
      `[data-setup-link-id="${idFrom(closedSetupURL)}"]`,
    );
    await expect(closedRow).toBeVisible();
    await closedRow
      .getByRole("button", { name: "Close Partner Organization Setup Link" })
      .click();
    await expect(closedRow.locator('[data-link-status="closed"]')).toBeVisible();
    await expect(closedRow.getByRole("button")).toBeDisabled();
    for (const url of siblingSetupURLs)
      await expect(
        list
          .locator(`[data-setup-link-id="${idFrom(url)}"]`)
          .locator('[data-link-status="open"]'),
      ).toBeVisible();
    await page.reload();
    await expect(closedRow.locator('[data-link-status="closed"]')).toBeVisible();
  });

  test("13a closed setup link refuses completion; both siblings redeem independently", async ({
    browser,
    baseURL,
  }) => {
    const partner = await actorContext(browser, "P", baseURL!);
    const recipient = await partner.newPage();
    await recipient.goto(closedSetupURL);
    await expect(
      recipient.locator('[data-setup-error="disabled"]'),
    ).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[2]!, names.P)).toBe(0);
    for (const [index, actor] of (["P", "F"] as const).entries()) {
      const sibling = await actorContext(browser, actor, baseURL!);
      const siblingPage = await sibling.newPage();
      await siblingPage.goto(siblingSetupURLs[index]!);
      await siblingPage
        .getByRole("radio", { name: "Existing Organization" })
        .check();
      await selectEntity(
        siblingPage,
        "Organization",
        await entityId(organization, names[actor]),
      );
      await siblingPage.getByRole("button", { name: "Complete setup" }).click();
      await expect(
        siblingPage.getByRole("button", {
          name: "Use this Organization",
          exact: true,
        }),
      ).toBeVisible();
      expect(await partnershipCount(fixture.projectNames[2]!, names[actor])).toBe(
        1,
      );
    }
    const otherHosting = await actorContext(browser, "E", baseURL!);
    const otherPage = await otherHosting.newPage();
    await otherPage.goto("/partner-organizations");
    // Text-free: issued-links absence below proves the empty scope (no copy).
    for (const id of issuedLinks)
      await expect(otherPage.locator(`[data-setup-link-id="${id}"]`)).toHaveCount(
        0,
      );
  });

  test("section-2 checkpoint: H sees both Main Partnerships; P/F isolated; E is Project-specific", async ({
    browser,
    baseURL,
  }) => {
    const host = await fixture.actorContext(browser, "H", baseURL!);
    const hostPage = await host.newPage();
    await hostPage.goto(projectURLs[0]!);
    const assigned = hostPage.locator(
      '[data-testid="assigned-partner-organizations"]',
    );
    // Text-free: per-actor claim hrefs below (DB-anchored) prove exactly whose data renders.
    await expect(assigned).toBeVisible();
    const workspacePaths: string[] = [];
    for (const [actor, own] of [
      ["P", names.P, names.F],
      ["F", names.F, names.P],
    ] as const) {
      const context = await actorContext(browser, actor, baseURL!);
      const page = await context.newPage();
      await openPartnerProject(page, fixture.projectNames[0]!);
      const claimLink = page.getByRole("link", { name: "Open Claim workspace" });
      await expect(claimLink).toBeVisible();
      const href = await claimLink.getAttribute("href");
      expect(href).toMatch(/^\/partnerships\/[^/]+\/claim$/);
      workspacePaths.push(href!);
      const [ownPartnership] = await db
        .select({ id: partnerships.id })
        .from(partnerships)
        .innerJoin(organization, eq(partnerships.organizationId, organization.id))
        .where(eq(organization.name, own));
      expect(href).toBe(`/partnerships/${ownPartnership!.id}/claim`);
      // Text-free: own-partnership href equality above proves isolation (no name copy).
      await page.goto("/projects");
      await expect(
        await projectLink(page, fixture.projectNames[0]!),
      ).toBeVisible();
      // Text-free: own-partnership href equality above proves isolation (no name copy).
    }
    expect(new Set(workspacePaths).size).toBe(2);
    for (const url of projectURLs.slice(1)) {
      await hostPage.goto(url);
      // Text-free: assigned section renders on E's project; DB zero-partnership below proves specificity.
      // (E-name display dropped: association covered by page load + DB.)
      await expect(
        hostPage.locator('[data-testid="assigned-partner-organizations"]'),
      ).toBeVisible();
    }
    expect(await partnershipCount(fixture.projectNames[0]!, names.E)).toBe(0);
  });
});
