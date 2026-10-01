import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable,
  claimsTable,
  invitation,
  member,
  organization,
  partnerOrganizationSetupLinksTable as setupLinks,
  participantInvitationBridgesTable as bridges,
  participantRegistrationLinksTable as registrationLinks,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participations,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

// API-setup exceptions: verified disposable Users, credential accounts, Partner
// Organizations and Partnerships are DB preconditions. A's Organization Invitation
// is DB-issued (never submitted through real SMTP); acceptance and Project creation
// are browser actions. N3 seeds T's Hosting participant Membership and Main Project
// Participation, then removes them before N4's no-join checks. No mail-producing
// form is submitted. Browser sessions are isolated. This spec does not explicitly
// persist tokens or credentials; file-level trace: "off" excludes them from traces.
// Shared global setup's Project-list hydration wait is 15s (approved one-line
// exception for slow streamed navigation; no change to test semantics).
// AUTOMATED-ONLY: server authorization in projects.integration.test.ts,
// claims.integration.test.ts and submission.integration.test.ts (N1/N3);
// setup-links.integration.test.ts and participant-onboarding.integration.test.ts
// cover forged/expired/48h/7d links (N4); participations.integration.test.ts
// and projects.integration.test.ts cover coordinator scopes (N6).
// UI GAP: no setup-link closure/list, Participant Invitation reissue sends mail,
// and no assignment UI for a different Project-/Partnership-scoped coordinator.
const suffix = randomUUID();
const ids = {
  host: randomUUID(),
  partner: randomUUID(),
  foreign: randomUUID(),
  partnership: randomUUID(),
  foreignPartnership: randomUUID(),
  invitation: randomUUID(),
  oldParticipantInvitation: randomUUID(),
  newParticipantInvitation: randomUUID(),
  participantMembership: randomUUID(),
  participation: randomUUID(),
};
const names = {
  host: `CT ${suffix} Hosting`,
  partner: `CT ${suffix} Partner A`,
  foreign: `CT ${suffix} Partner B`,
  project: `CT ${suffix} Main`,
};
const actors = Object.fromEntries(
  (["H", "A", "P", "F", "T", "X"] as const).map((code) => [
    code,
    {
      id: randomUUID(),
      name: `CT ${suffix} ${code}`,
      email: `ct-${suffix}-${code.toLowerCase()}@example.invalid`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "H" | "A" | "P" | "F" | "T" | "X",
  { id: string; name: string; email: string; password: string }
>;
type Actor = keyof typeof actors;
const contexts: BrowserContext[] = [];
let projectId: string;
let setupId: string;
let registrationId: string;
let baseline: Awaited<ReturnType<typeof counts>>;

async function counts() {
  const [
    [users],
    [organizations],
    [projects],
    [assigned],
    [links],
    [registrations],
    [claims],
    [participantMemberships],
    [participantRows],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(user)
      .where(
        inArray(
          user.id,
          Object.values(actors).map((actor) => actor.id),
        ),
      ),
    db
      .select({ value: count() })
      .from(organization)
      .where(inArray(organization.id, [ids.host, ids.partner, ids.foreign])),
    db
      .select({ value: count() })
      .from(projectsTable)
      .where(eq(projectsTable.name, names.project)),
    db
      .select({ value: count() })
      .from(partnerships)
      .where(inArray(partnerships.id, [ids.partnership, ids.foreignPartnership])),
    db
      .select({ value: count() })
      .from(setupLinks)
      .where(eq(setupLinks.projectId, projectId ?? "no-project")),
    db
      .select({ value: count() })
      .from(registrationLinks)
      .where(eq(registrationLinks.partnershipId, ids.partnership)),
    db
      .select({ value: count() })
      .from(claimsTable)
      .where(
        inArray(claimsTable.partnershipId, [
          ids.partnership,
          ids.foreignPartnership,
        ]),
      ),
    db
      .select({ value: count() })
      .from(member)
      .where(eq(member.id, ids.participantMembership)),
    db
      .select({ value: count() })
      .from(participations)
      .where(eq(participations.id, ids.participation)),
  ]);
  return {
    users: users!.value,
    organizations: organizations!.value,
    projects: projects!.value,
    partnerships: assigned!.value,
    links: links!.value,
    registrations: registrations!.value,
    claims: claims!.value,
    participantMemberships: participantMemberships!.value,
    participations: participantRows!.value,
  };
}

async function pageFor(browser: Browser, actor: Actor, baseURL: string) {
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

async function denied(page: Page, resource: string) {
  await expect(
    page.getByRole("alert").filter({ hasText: `Unable to load ${resource}` }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
}

async function partnerPage(page: Page) {
  await page.goto("/projects");
  await page.getByRole("tab", { name: "Partner" }).click();
  await page.getByRole("link", { name: names.project, exact: true }).click();
  await expect(page.getByRole("heading", { name: names.project })).toBeVisible({
    timeout: 90_000,
  });
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test.describe.serial("N1 N3 N4 N6 access and links", () => {
  // Warm dev-server application work can take 30–80s per navigation.
  test.setTimeout(420_000);
  test.beforeAll(async () => {
    baseline = await counts();
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
    const now = new Date();
    await db.insert(organization).values([
      { id: ids.host, name: names.host, slug: ids.host, createdAt: now },
      { id: ids.partner, name: names.partner, slug: ids.partner, createdAt: now },
      { id: ids.foreign, name: names.foreign, slug: ids.foreign, createdAt: now },
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: actors.H.id,
        organizationId: ids.host,
        role: "owner",
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actors.P.id,
        organizationId: ids.partner,
        role: "owner",
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actors.F.id,
        organizationId: ids.foreign,
        role: "owner",
        createdAt: now,
      },
    ]);
    await db.insert(invitation).values({
      id: ids.invitation,
      organizationId: ids.host,
      email: actors.A.email,
      role: "admin",
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      inviterId: actors.H.id,
    });
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    const claims = await db
      .select({ id: claimsTable.id })
      .from(claimsTable)
      .where(
        inArray(claimsTable.partnershipId, [
          ids.partnership,
          ids.foreignPartnership,
        ]),
      );
    for (const claim of claims) {
      await db
        .delete(claimHistoryTable)
        .where(eq(claimHistoryTable.claimId, claim.id));
      await db.delete(claimsTable).where(eq(claimsTable.id, claim.id));
    }
    await db
      .delete(registrationLinks)
      .where(eq(registrationLinks.partnershipId, ids.partnership));
    if (projectId)
      await db.delete(setupLinks).where(eq(setupLinks.projectId, projectId));
    await db
      .delete(partnerships)
      .where(inArray(partnerships.id, [ids.partnership, ids.foreignPartnership]));
    if (projectId)
      await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    await db
      .delete(bridges)
      .where(
        inArray(bridges.invitationId, [
          ids.oldParticipantInvitation,
          ids.newParticipantInvitation,
        ]),
      );
    await db
      .delete(invitation)
      .where(
        inArray(invitation.id, [
          ids.invitation,
          ids.oldParticipantInvitation,
          ids.newParticipantInvitation,
        ]),
      );
    await db
      .delete(member)
      .where(
        inArray(member.organizationId, [ids.host, ids.partner, ids.foreign]),
      );
    await db
      .delete(organization)
      .where(inArray(organization.id, [ids.host, ids.partner, ids.foreign]));
    for (const actor of Object.values(actors)) {
      await db.delete(session).where(eq(session.userId, actor.id));
      await db.delete(user).where(eq(user.id, actor.id));
    }
    expect(await counts()).toEqual(baseline);
  });

  test("N6 H creates Main; A accepts Organization Invitation and both see Hosting scope", async ({
    browser,
    baseURL,
  }) => {
    const h = await pageFor(browser, "H", baseURL!);
    await h.goto("/projects");
    await h.getByRole("button", { name: "New project" }).click();
    const dialog = h.getByRole("dialog", { name: "New project" });
    await dialog.getByLabel("Name", { exact: true }).fill(names.project);
    await dialog.getByLabel("Start date").fill("2027-04-01");
    await dialog.getByLabel("End date").fill("2027-04-03");
    await dialog.getByLabel("Location").fill("Berlin");
    await dialog.getByLabel("Country").selectOption("DE");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(h).toHaveURL(/\/projects\/[^/]+$/);
    projectId = new URL(h.url()).pathname.split("/").at(-1)!;
    await expect(h.getByRole("heading", { name: names.project })).toBeVisible({
      timeout: 90_000,
    });
    await db.insert(partnerships).values([
      { id: ids.partnership, projectId, organizationId: ids.partner },
      { id: ids.foreignPartnership, projectId, organizationId: ids.foreign },
    ]);
    const a = await pageFor(browser, "A", baseURL!);
    await a.goto(`/accept-invitation/${ids.invitation}`);
    await expect(
      a.getByRole("heading", { name: "Organization Invitation" }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Accept Organization Invitation" })
      .click();
    await expect(a).toHaveURL(/\/projects$/, { timeout: 90_000 });
    for (const page of [h, a]) {
      await page.goto(`/projects/${projectId}`);
      await expect(
        page.getByRole("heading", { name: names.project }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Review submitted Claims" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /Assign.*(?:Project|Partnership).*Coordinator/i,
        }),
      ).toHaveCount(0);
    }
    const partner = await pageFor(browser, "P", baseURL!);
    await partnerPage(partner);
    await expect(
      partner.getByRole("link", { name: "Coordinate Participants" }),
    ).toBeVisible();
    await expect(
      partner.getByRole("button", {
        name: /Assign.*(?:Project|Partnership).*Coordinator/i,
      }),
    ).toHaveCount(0);
    await h.goto("/organization");
    await expect(
      h.getByRole("row").filter({ hasText: actors.A.email }),
    ).toContainText("admin");
    // A creator and Organization Admin are observable; assignment to another
    // Project-/Partnership-scoped coordinator is UI GAP, not inferred from DB roles.
  });

  test("N1 X and F cannot read foreign Project, Participants, Claim or review routes", async ({
    browser,
    baseURL,
  }) => {
    const x = await pageFor(browser, "X", baseURL!);
    for (const route of [
      `/projects/${projectId}`,
      `/partnerships/${ids.partnership}/participants`,
      `/partnerships/${ids.partnership}/claim`,
      `/claims/review/${ids.partnership}`,
    ]) {
      await x.goto(route);
      await expect(x.getByText(names.project)).toHaveCount(0);
      await expect(x.getByText(names.partner)).toHaveCount(0);
      await expect(
        x.getByRole("button", { name: /Save cost|Approve Claim|Submit Claim/ }),
      ).toHaveCount(0);
    }
    const p = await pageFor(browser, "P", baseURL!);
    await partnerPage(p);
    await expect(
      p.getByRole("link", { name: "Coordinate Participants" }),
    ).toBeVisible();
    const f = await pageFor(browser, "F", baseURL!);
    for (const [route, resource] of [
      [`/partnerships/${ids.partnership}/participants`, "Project Participations"],
      [`/partnerships/${ids.partnership}/claim`, "Claim workspace"],
    ]) {
      await f.goto(route);
      await denied(f, resource);
      await expect(f.getByText(names.partner)).toHaveCount(0);
      await expect(
        f.getByRole("button", { name: /Save cost|Approve Claim/ }),
      ).toHaveCount(0);
    }
  });

  for (const actor of ["F", "P"] as const) {
    test(`${actor === "F" ? "N1" : "N3"} ${actor} direct review route denies access`, async ({
      browser,
      baseURL,
    }) => {
      const page = await pageFor(browser, actor, baseURL!);
      await page.goto(`/claims/review/${ids.partnership}`);
      await denied(page, "Claim review");
      await expect(page.getByText(names.partner)).toHaveCount(0);
    });
  }

  test("N3 Participant and Hosting cannot use Partner financial controls", async ({
    browser,
    baseURL,
  }) => {
    // Isolated setup adaptation, not browser evidence of Participant onboarding.
    // Keep N4's zero-Participation preconditions by removing these rows afterwards.
    try {
      await db.insert(member).values({
        id: ids.participantMembership,
        userId: actors.T.id,
        organizationId: ids.host,
        role: "participant",
        createdAt: new Date(),
      });
      await db.insert(participations).values({
        id: ids.participation,
        userId: actors.T.id,
        projectId,
        representedOrganizationId: ids.partner,
        displayName: actors.T.name,
      });
      expect(
        await db
          .select({ role: member.role, organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, actors.T.id)),
      ).toEqual([{ role: "participant", organizationId: ids.host }]);
      expect(
        await db
          .select({
            userId: participations.userId,
            projectId: participations.projectId,
          })
          .from(participations)
          .where(eq(participations.id, ids.participation)),
      ).toEqual([{ userId: actors.T.id, projectId }]);
      const t = await pageFor(browser, "T", baseURL!);
      await t.goto(`/partnerships/${ids.partnership}/claim`);
      await denied(t, "Claim workspace");
      await expect(t.getByText("No Organization access yet")).toHaveCount(0);
      await expect(
        t.getByRole("button", {
          name: /Save Claim draft|Save cost|Submit Claim/,
        }),
      ).toHaveCount(0);
      const h = await pageFor(browser, "H", baseURL!);
      await h.goto(`/partnerships/${ids.partnership}/claim`);
      await denied(h, "Claim workspace");
      await expect(
        h.getByRole("button", { name: /Save cost|Save Claim draft/ }),
      ).toHaveCount(0);
      expect(
        await db
          .select()
          .from(claimsTable)
          .where(eq(claimsTable.partnershipId, ids.partnership)),
      ).toHaveLength(0);
    } finally {
      await db
        .delete(participations)
        .where(eq(participations.id, ids.participation));
      await db.delete(member).where(eq(member.id, ids.participantMembership));
    }
  });

  test("N4 spare Partner-Organization Setup Link is disabled, replacement is isolated across browsers", async ({
    browser,
    baseURL,
  }) => {
    const h = await pageFor(browser, "H", baseURL!);
    await h.goto("/partner-organizations");
    const creator = h
      .locator("section")
      .filter({ hasText: "Share this recipient-bound link privately" });
    await creator
      .getByRole("button", { name: "Hosted Project", exact: true })
      .click();
    await h
      .getByRole("combobox", { name: "Search Hosted Project by name or ID" })
      .fill(names.project);
    await h.getByRole("option", { name: new RegExp(names.project) }).click();
    await creator.getByLabel("Recipient email").fill(actors.X.email);
    await creator
      .getByRole("button", { name: "Neuer Link", exact: true })
      .click();
    const first = await creator.getByLabel("Recipient setup link").inputValue();
    setupId = new URL(first).pathname.split("/").at(-1)!;
    // No setup-link closure UI: DB revocation is a test-helper precondition,
    // not evidence of a browser revocation control.
    await db
      .update(setupLinks)
      .set({ enabled: false })
      .where(eq(setupLinks.id, setupId));
    const x = await pageFor(browser, "X", baseURL!);
    await x.goto(first);
    await expect(
      x.getByText("Partner Organization setup", { exact: true }),
    ).toBeVisible();
    await x.getByLabel("New Organization name").fill(`CT ${suffix} unused`);
    await x.getByRole("button", { name: "Complete setup" }).click();
    await expect(x.getByText("Disabled setup link")).toBeVisible();
    await creator
      .getByRole("button", { name: "Neuer Link", exact: true })
      .click();
    const replacement = await creator
      .getByLabel("Recipient setup link")
      .inputValue();
    expect(new URL(replacement).pathname).not.toBe(new URL(first).pathname);
    await x.goto(first);
    await x.getByLabel("New Organization name").fill(`CT ${suffix} unused`);
    await x.getByRole("button", { name: "Complete setup" }).click();
    await expect(x.getByText("Disabled setup link")).toBeVisible();
    const fresh = await browser.newContext({
      baseURL: baseURL!,
      storageState: { cookies: [], origins: [] },
    });
    contexts.push(fresh);
    const separate = await fresh.newPage();
    await separate.goto(replacement);
    await expect(separate).toHaveURL(/\/login/);
    await expect(separate.getByText(names.project)).toHaveCount(0);
    await x.goto("/projects");
    await expect(x.getByText("No Organization access yet")).toBeVisible();
    await x.reload();
    await expect(x.getByText("No Organization access yet")).toBeVisible();
    // The no-access screen auto-opens Create Organization; dismiss its portal
    // before using the separate Sign out control.
    await x.keyboard.press("Escape");
    await expect(
      x.getByRole("dialog", { name: "Create Organization" }),
    ).toBeHidden();
    await x.getByRole("button", { name: "Sign out" }).click();
    await expect(x).toHaveURL(new URL("/", baseURL!).toString());
    await x.goto(replacement);
    await expect(x).toHaveURL(/\/login/);
    // Do not redeem replacement: it is a spare link addressed to X.
  });

  test("N4 setup-issued Participant Invitation rotation refuses the old link", async ({
    browser,
    baseURL,
  }) => {
    // Issuing/reissuing through UI sends real SMTP. DB preconditions here are NOT
    // browser evidence for delivery or the reissue affordance.
    await db.insert(invitation).values({
      id: ids.oldParticipantInvitation,
      organizationId: ids.host,
      email: actors.T.email,
      role: "participant",
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      inviterId: actors.P.id,
    });
    await db.insert(bridges).values({
      invitationId: ids.oldParticipantInvitation,
      partnershipId: ids.partnership,
      projectId,
      email: actors.T.email,
      issuedByUserId: actors.P.id,
    });
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(`/partnerships/${ids.partnership}/participants`);
    await expect(
      p.getByRole("button", { name: `Reissue invitation for ${actors.T.email}` }),
    ).toBeVisible();
    await db
      .update(bridges)
      .set({ status: "revoked" })
      .where(eq(bridges.invitationId, ids.oldParticipantInvitation));
    await db
      .update(invitation)
      .set({ status: "canceled" })
      .where(eq(invitation.id, ids.oldParticipantInvitation));
    await db.insert(invitation).values({
      id: ids.newParticipantInvitation,
      organizationId: ids.host,
      email: actors.T.email,
      role: "participant",
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      inviterId: actors.P.id,
    });
    await db.insert(bridges).values({
      invitationId: ids.newParticipantInvitation,
      partnershipId: ids.partnership,
      projectId,
      email: actors.T.email,
      issuedByUserId: actors.P.id,
    });
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(`/participant-invitations/${ids.oldParticipantInvitation}`);
    await t.getByLabel("Full name").fill(actors.T.name);
    await t.getByLabel("I accept the current Participant agreement").check();
    await t.getByRole("button", { name: "Join Project" }).click();
    await expect(t.locator("form p[role='alert']")).toContainText(
      "We could not complete that request.",
    );
    expect(
      await db
        .select()
        .from(participations)
        .where(eq(participations.projectId, projectId)),
    ).toHaveLength(0);
    await t.goto(`/participant-invitations/${ids.newParticipantInvitation}`);
    await expect(t.getByRole("button", { name: "Join Project" })).toBeVisible();
    // Spare replacement is not redeemed; no Participation or Membership created.
  });

  test("N4 spare Participant Registration Link closes without creating a Participation", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(`/partnerships/${ids.partnership}/participants`);
    await expect(
      p.getByRole("button", { name: "Send Participant Invitation" }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Create Participant Registration Link" })
      .click();
    await expect(p.getByText("Registration link created")).toBeVisible();
    const link = await p
      .getByLabel("New registration link (copy now)")
      .inputValue();
    registrationId = new URL(link).pathname.split("/").at(-1)!;
    await p
      .getByRole("button", { name: `Close registration link ${registrationId}` })
      .click();
    await expect(p.getByText("Registration link closed")).toBeVisible();
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(link);
    await expect(t.getByRole("button", { name: "Join Project" })).toBeVisible();
    await t.getByLabel("Full name").fill(actors.T.name);
    await t.getByLabel("I accept the current Participant agreement").check();
    await t.getByRole("button", { name: "Join Project" }).click();
    await expect(t.locator("form p[role='alert']")).toContainText(
      "We could not complete that request.",
    );
    expect(
      await db
        .select()
        .from(participations)
        .where(eq(participations.projectId, projectId)),
    ).toHaveLength(0);
    const anonymous = await browser.newContext({
      baseURL: baseURL!,
      storageState: { cookies: [], origins: [] },
    });
    contexts.push(anonymous);
    const page = await anonymous.newPage();
    await page.goto(link);
    await expect(page).toHaveURL(/\/login/);
  });
});
