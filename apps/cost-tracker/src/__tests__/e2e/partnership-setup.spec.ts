import { createHash, randomBytes, randomUUID } from "node:crypto";

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

import {
  expectPrivateURL,
  expect,
  test,
  registerPrivateValues,
} from "./fixtures/artifact-privacy";
import { HostingJourneyFixture } from "./fixtures/hosting-journey";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: beforeAll seeds verified P/F/E/M Users and credential
// accounts, then signs each into its own browser context through the auth API.
// Reauthentication after new-Organization setup picks the new active Membership.
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
// PRODUCT-RESOLUTION-PENDING: member creation follows the existing server grant
// despite denied assigned-list access (#206). The disposable browser observation
// is NOT a requirements PASS; the member permission policy still needs resolution.
const fixture = new HostingJourneyFixture();
const suffix = fixture.suffix;
const names = {
  P: `CT ${suffix} Partner A`,
  F: `CT ${suffix} Partner B`,
  E: `CT ${suffix} Existing Organization`,
};
const actors = Object.fromEntries(
  (["P", "F", "E", "M"] as const).map((actor) => [
    actor,
    {
      id: randomUUID(),
      name: `CT ${suffix} ${actor}`,
      email: `ct-${suffix}-${actor.toLowerCase()}@example.invalid`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "P" | "F" | "E" | "M",
  { id: string; name: string; email: string; password: string }
>;
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));
const memberProjectName = `CT ${suffix} Member Observation`;
const ownedProjectNames = [...fixture.projectNames, memberProjectName];
const invitationId = randomUUID();
const contexts: BrowserContext[] = [];
const issuedLinks: string[] = [];
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
      .where(inArray(organization.name, [names.P, names.F, names.E])),
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
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email: actors[actor].email, password: actors[actor].password },
  });
  expect(response.ok(), `${actor} setup sign-in failed`).toBe(true);
  return context;
}

async function selectEntity(
  page: Page,
  label: string,
  name: string,
  scope: Locator = page.locator("body"),
) {
  await scope.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("combobox", { name: `Search ${label} by name or ID` })
    .fill(name);
  await page.getByRole("option", { name: new RegExp(name, "i") }).click();
  await expect(
    scope.getByRole("button", { name: label, exact: true }),
  ).toContainText(name);
}

async function openOrganizationDialog(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Create Organization" });
  if (!(await dialog.isVisible())) {
    // The portal may open on pointer-down, intercepting Playwright's final click.
    // Only tolerate that click race if the requested dialog is visibly open.
    await page
      .locator("main button")
      .filter({ hasText: "Create Organization" })
      .click({ timeout: 3_000 })
      .catch(async () => {
        await expect(dialog).toBeVisible();
      });
  }
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
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Hosted Project", { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function issueThroughUI(
  page: Page,
  projectName: string,
  recipient: string,
) {
  await page.goto("/partner-organizations");
  await expect(
    page.getByRole("heading", { name: "Partner Organizations" }),
  ).toBeVisible();
  const creator = page.locator("section").filter({
    hasText: "Share this recipient-bound link privately",
  });
  await selectEntity(page, "Hosted Project", projectName, creator);
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
  await expect(page.getByText("Link kopiert.", { exact: false })).toBeVisible();
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
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Partner Project", { exact: true })).toBeVisible();
}

async function completeNew(page: Page, url: string, name: string) {
  await page.goto(url);
  await expect(
    page.getByText("Partner Organization setup", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("New Organization name").fill(name);
  await page.getByRole("button", { name: "Complete setup" }).click();
  await expect(page.getByText("Project Partnership created")).toBeVisible();
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
    // Remove link references before deleting the UI-created Projects/Partnerships.
    if (issuedLinks.length)
      await db.delete(setupLinks).where(inArray(setupLinks.id, issuedLinks));
    await db.delete(invitation).where(eq(invitation.id, invitationId));
    for (const name of ownedProjectNames)
      await db.delete(projectsTable).where(eq(projectsTable.name, name));
    for (const name of [names.P, names.F, names.E]) {
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
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    const dialog = await openOrganizationDialog(page);
    await dialog.getByLabel("Organization name").fill(fixture.organizationName);
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(dialog).toBeHidden();
    if (await page.getByText("No Organization access yet").isVisible())
      await page.reload();
    await expect(page.getByRole("button", { name: "New project" })).toBeVisible();
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
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    await completeNew(page, setupURL, names.P);
    expect(await partnershipCount(fixture.projectNames[0]!, names.P)).toBe(1);
    await page.goto(setupURL);
    await expect(page.getByLabel("New Organization name")).toBeVisible();
    await page.getByLabel("New Organization name").fill(names.P);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(page.getByText("Project Partnership created")).toBeVisible();
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
      await expect(
        page.getByText("Partner Organization setup", { exact: true }),
      ).toBeVisible();
      const attemptedName = `CT ${suffix} Wrong Email`;
      await page.getByLabel("New Organization name").fill(attemptedName);
      await page.getByRole("button", { name: "Complete setup" }).click();
      await expect(page.getByText("Wrong email address")).toBeVisible();
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
    // Reauthenticate after setup: the pre-setup session had no active Organization.
    const refreshed = await actorContext(browser, "F", baseURL!);
    const workspace = await refreshed.newPage();
    await openPartnerProject(workspace, fixture.projectNames[0]!);
    await expect(workspace.getByText(names.P)).toHaveCount(0);
  });

  test("09 E creates an Organization and selects it on the Existing Project link", async ({
    browser,
    baseURL,
  }) => {
    const partner = await actorContext(browser, "E", baseURL!);
    const page = await partner.newPage();
    await page.goto("/projects");
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    const dialog = await openOrganizationDialog(page);
    await dialog.getByLabel("Organization name").fill(names.E);
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(dialog).toBeHidden();
    if (await page.getByText("No Organization access yet").isVisible())
      await page.reload();
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    const host = await fixture.actorContext(browser, "H", baseURL!);
    existingSetupURL = await issueThroughUI(
      await host.newPage(),
      fixture.projectNames[1]!,
      actors.E.email,
    );
    await page.goto(existingSetupURL);
    await page.getByRole("radio", { name: "Existing Organization" }).check();
    await selectEntity(page, "Organization", names.E);
    await page.getByRole("button", { name: "Complete setup" }).click();
    await expect(page.getByText("Project Partnership created")).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[1]!, names.E)).toBe(1);
  });

  test.describe("member invitation precondition", () => {
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
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 3_600_000),
        inviterId: actors.E.id,
      });
    });
    test("10 M explicitly accepts E's Organization Invitation as member, not Participant", async ({
      browser,
      baseURL,
    }) => {
      const owner = await actorContext(browser, "E", baseURL!);
      const ownerPage = await owner.newPage();
      await ownerPage.goto("/organization");
      await expect(
        ownerPage.getByRole("row").filter({ hasText: actors.M.email }),
      ).toContainText("member");
      const context = await actorContext(browser, "M", baseURL!);
      const page = await context.newPage();
      await page.goto(`/accept-invitation/${invitationId}`);
      await expect(
        page.getByRole("heading", { name: "Organization Invitation" }),
      ).toBeVisible();
      await expect(page.getByText(names.E)).toBeVisible();
      await page
        .getByRole("button", { name: "Accept Organization Invitation" })
        .click();
      // Preserve the original full-URL match; only the diagnostic receives a boolean.
      await expectPrivateURL(page, /\/projects$/);
      await page.goto("/organization");
      await expect(
        page.getByText(
          "Organization staff management is available to owners and admins.",
        ),
      ).toBeVisible();
      await ownerPage.reload();
      await expect(
        ownerPage.getByRole("row").filter({ hasText: actors.M.email }),
      ).toContainText("member");
      const [participation] = await db
        .select({ id: projectParticipantsTable.id })
        .from(projectParticipantsTable)
        .where(eq(projectParticipantsTable.userId, actors.M.id));
      expect(participation).toBeUndefined();
      expect(await partnershipCount(fixture.projectNames[1]!, names.E)).toBe(1);
    });
  });

  test("member-created Project observation — usable creation, product resolution pending, not a requirements PASS", async ({
    browser,
    baseURL,
  }) => {
    const [membership] = await db
      .select({ role: member.role, organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, actors.M.id));
    expect(membership?.role).toBe("member");
    const context = await actorContext(browser, "M", baseURL!);
    const page = await context.newPage();
    // List denial must not remove the independently authorized creation path.
    // This records server behavior, NOT a requirements PASS.
    await page.goto("/projects");
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    const denial = page
      .getByRole("alert")
      .filter({ hasText: "Unable to load Assigned Projects" });
    await expect(denial).toBeVisible();
    await expect(denial).toContainText(
      "You do not have permission to access this resource.",
    );
    await expect(denial.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New project" })).toBeVisible();
    try {
      await createProject(page, memberProjectName);
      await page.goto("/projects");
      await expect(
        page.getByRole("link", { name: memberProjectName }),
      ).toBeVisible();
      const [created] = await db
        .select({ organizationId: projectsTable.organizationId })
        .from(projectsTable)
        .where(eq(projectsTable.name, memberProjectName));
      expect(created?.organizationId).toBe(membership!.organizationId);
    } finally {
      await db
        .delete(projectsTable)
        .where(eq(projectsTable.name, memberProjectName));
    }
  });

  test.describe("member Owner-selection precondition", () => {
    let memberSetupURL: string;
    test.beforeAll(async () => {
      memberSetupURL = await issueInSetup(
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
      await page.goto(memberSetupURL);
      await page.getByRole("radio", { name: "Existing Organization" }).check();
      await page
        .getByRole("button", { name: "Organization", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Search Organization by name or ID" })
        .fill(names.E);
      await expect(
        page.getByText("No matches — refine or paste full ID"),
      ).toBeVisible();
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
    await expect(page.getByText("Assign an existing Organization")).toBeVisible();
    const section = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Current Project Partnerships" }),
    });
    await selectEntity(page, "Hosted Project", fixture.projectNames[2]!, section);
    await selectEntity(page, "Partner Organization", names.E, section);
    await section.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(
      section.getByText("Project Partnership assigned."),
    ).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[2]!, names.E)).toBe(1);
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
    await expect(closedRow).toContainText(actors.P.email);
    await closedRow
      .getByRole("button", { name: "Close Partner Organization Setup Link" })
      .click();
    await expect(
      closedRow.getByRole("cell", { name: "Closed", exact: true }),
    ).toBeVisible();
    await expect(closedRow.getByRole("button")).toBeDisabled();
    for (const url of siblingSetupURLs)
      await expect(
        list
          .locator(`[data-setup-link-id="${idFrom(url)}"]`)
          .getByRole("cell", { name: "Open", exact: true }),
      ).toBeVisible();
    await page.reload();
    await expect(
      closedRow.getByRole("cell", { name: "Closed", exact: true }),
    ).toBeVisible();
  });

  test("13a closed setup link refuses completion; both siblings redeem independently", async ({
    browser,
    baseURL,
  }) => {
    const partner = await actorContext(browser, "P", baseURL!);
    const recipient = await partner.newPage();
    await recipient.goto(closedSetupURL);
    await recipient.getByRole("radio", { name: "Existing Organization" }).check();
    await selectEntity(recipient, "Organization", names.P);
    await recipient.getByRole("button", { name: "Complete setup" }).click();
    await expect(
      recipient.getByText("Disabled setup link", { exact: true }),
    ).toBeVisible();
    expect(await partnershipCount(fixture.projectNames[2]!, names.P)).toBe(0);
    for (const [index, actor] of (["P", "F"] as const).entries()) {
      const sibling = await actorContext(browser, actor, baseURL!);
      const siblingPage = await sibling.newPage();
      await siblingPage.goto(siblingSetupURLs[index]!);
      await siblingPage
        .getByRole("radio", { name: "Existing Organization" })
        .check();
      await selectEntity(siblingPage, "Organization", names[actor]);
      await siblingPage.getByRole("button", { name: "Complete setup" }).click();
      await expect(
        siblingPage.getByText("Project Partnership created"),
      ).toBeVisible();
      expect(await partnershipCount(fixture.projectNames[2]!, names[actor])).toBe(
        1,
      );
    }
    const otherHosting = await actorContext(browser, "E", baseURL!);
    const otherPage = await otherHosting.newPage();
    await otherPage.goto("/partner-organizations");
    await expect(
      otherPage.getByText("No Partner Organization Setup Links yet."),
    ).toBeVisible();
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
    const assigned = hostPage
      .getByText("Assigned Partner Organizations")
      .locator("..")
      .locator("..");
    await expect(assigned.getByText(names.P)).toHaveCount(1);
    await expect(assigned.getByText(names.F)).toHaveCount(1);
    const workspacePaths: string[] = [];
    for (const [actor, own, other] of [
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
      await expect(page.getByText(other)).toHaveCount(0);
      await page.goto("/projects");
      await expect(
        page.getByRole("link", { name: fixture.projectNames[0]! }),
      ).toBeVisible();
      await expect(page.getByText(other)).toHaveCount(0);
    }
    expect(new Set(workspacePaths).size).toBe(2);
    for (const url of projectURLs.slice(1)) {
      await hostPage.goto(url);
      await expect(hostPage.getByText(names.E)).toHaveCount(1);
    }
    expect(await partnershipCount(fixture.projectNames[0]!, names.E)).toBe(0);
  });
});
