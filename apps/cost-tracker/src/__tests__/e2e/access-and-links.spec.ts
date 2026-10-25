import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable,
  claimsTable,
  invitation,
  member,
  organization,
  partnerOrganizationSetupLinksTable as setupLinks,
  participantEntryTokensTable as participantInvitations,
  participantEntryTokensTable as entryTokens,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participations,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { type Browser, type BrowserContext, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray } from "drizzle-orm";

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
// API-setup exceptions: verified disposable Users, credential accounts, Partner
// Organizations and Partnerships are DB preconditions. A's Organization Invitation
// is DB-issued (never submitted through real SMTP); acceptance and Project creation
// are browser actions. N3 seeds T's Hosting participant Membership and Main Project
// Participation, then removes them before N4's no-join checks. No mail-producing
// form is submitted. Browser sessions are isolated; artifact protection is above.
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
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));
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
      .from(entryTokens)
      .where(eq(entryTokens.partnershipId, ids.partnership)),
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
  const response = await postSignInWithRateLimitRetry(
    context.request,
    actors[actor].email,
    actors[actor].password,
  );
  expect(response.ok(), `${actor} setup sign-in`).toBe(true);
  return context.newPage();
}

async function denied(page: Page) {
  await expect(page.getByTestId("data-error-fallback")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId("retry-project-data")).toBeVisible();
}

async function partnerPage(page: Page) {
  await page.goto("/projects");
  await page.getByTestId("partner-projects-tab").click();
  await page
    .locator(
      `a[href="/projects/${projectId}"], a[href^="/projects/${projectId}?"]`,
    )
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 90_000,
  });
}

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

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
      {
        country: "DE",
        id: ids.host,
        name: names.host,
        slug: ids.host,
        createdAt: now,
      },
      {
        country: "DE",
        id: ids.partner,
        name: names.partner,
        slug: ids.partner,
        createdAt: now,
      },
      {
        country: "DE",
        id: ids.foreign,
        name: names.foreign,
        slug: ids.foreign,
        createdAt: now,
      },
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: actors.H.id,
        organizationId: ids.host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actors.P.id,
        organizationId: ids.partner,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actors.F.id,
        organizationId: ids.foreign,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
    ]);
    await db.insert(invitation).values({
      id: ids.invitation,
      organizationId: ids.host,
      email: actors.A.email,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
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
      .delete(entryTokens)
      .where(eq(entryTokens.partnershipId, ids.partnership));
    if (projectId)
      await db.delete(setupLinks).where(eq(setupLinks.projectId, projectId));
    await db
      .delete(partnerships)
      .where(inArray(partnerships.id, [ids.partnership, ids.foreignPartnership]));
    if (projectId)
      await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    await db
      .delete(participantInvitations)
      .where(
        inArray(participantInvitations.id, [
          ids.oldParticipantInvitation,
          ids.newParticipantInvitation,
        ]),
      );
    await db.delete(invitation).where(eq(invitation.id, ids.invitation));
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
    await h.getByTestId("new-project").click();
    const dialog = h.getByTestId("create-project-dialog");
    await dialog.locator("#new-project-name").fill(names.project);
    await dialog.locator("#new-project-start").fill("2027-04-01");
    await dialog.locator("#new-project-end").fill("2027-04-03");
    await dialog.locator("#new-project-location").fill("Berlin");
    await dialog.locator("#new-project-country").selectOption("DE");
    await dialog.getByTestId("create-project").click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(h, /\/projects\/[^/]+$/, { timeout: 90_000 });
    projectId = new URL(h.url()).pathname.split("/").at(-1)!;
    await expect(h.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 90_000,
    });
    await db.insert(partnerships).values([
      { id: ids.partnership, projectId, organizationId: ids.partner },
      { id: ids.foreignPartnership, projectId, organizationId: ids.foreign },
    ]);
    const a = await pageFor(browser, "A", baseURL!);
    await a.goto(`/accept-invitation/${ids.invitation}`);
    await expect(a.getByRole("heading", { level: 1 })).toBeVisible();
    await a.getByTestId("accept-organization-invitation").click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(a, /\/projects$/, { timeout: 90_000 });
    for (const page of [h, a]) {
      await page.goto(`/projects/${projectId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('a[href="/claims/review"]')).toBeVisible();
      await expect(page.getByTestId("organization-assignment")).toHaveCount(0);
    }
    const partner = await pageFor(browser, "P", baseURL!);
    await partnerPage(partner);
    await expect(
      partner.locator('a[href^="/partnerships/"][href$="/participants"]'),
    ).toBeVisible();
    await expect(partner.getByTestId("organization-assignment")).toHaveCount(0);
    await h.goto("/organization");
    const [adminMembership] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(eq(member.userId, actors.A.id), eq(member.organizationId, ids.host)),
      );
    expect(adminMembership).toBeDefined();
    await expect(
      h
        .getByTestId(`staff-member-${adminMembership!.id}`)
        .getByTestId(`staff-role-${ORGANIZATION_ROLES.OrganizationAdmin}`),
    ).toBeVisible();
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
      // Text-free: access-denied state hook instead of visible copy.
      await expect(
        x.locator('[data-testid="no-organization-access"]'),
      ).toBeVisible();
      await expect(x.getByTestId("no-organization-access")).toHaveRole("main");
      await expect(x.locator("#organization-name")).toBeEditable();
      // Text-free: no links to the protected entities leak (stable ids, not copy).
      await expect(x.locator(`a[href*="${projectId}"]`)).toHaveCount(0);
      await expect(x.locator(`a[href*="${ids.partnership}"]`)).toHaveCount(0);
      await expect(
        x.locator(
          '[data-testid="save-cost"], [data-testid="claim-review-approve"], [data-testid="submit-claim"]',
        ),
      ).toHaveCount(0);
    }
    const p = await pageFor(browser, "P", baseURL!);
    await partnerPage(p);
    await expect(
      p.locator('a[href^="/partnerships/"][href$="/participants"]'),
    ).toBeVisible();
    const f = await pageFor(browser, "F", baseURL!);
    for (const [route, _resource] of [
      [`/partnerships/${ids.partnership}/participants`, "Project Participations"],
      [`/partnerships/${ids.partnership}/claim`, "Claim workspace"],
    ]) {
      await f.goto(route);
      await denied(f);
      // Text-free: no link to the protected partnership leaks.
      await expect(f.locator(`a[href*="${ids.partnership}"]`)).toHaveCount(0);
      await expect(
        f.locator(
          '[data-testid="save-cost"], [data-testid="claim-review-approve"]',
        ),
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
      await denied(page);
      if (actor === "P") {
        await expect(page.getByTestId("organization-switcher")).toBeVisible();
      }
      // Text-free: no link to the protected partnership leaks.
      await expect(
        page.getByRole("main").locator(`a[href*="${ids.partnership}"]`),
      ).toHaveCount(0);
      await expect(
        page.locator(
          '[data-testid="claim-review-approve"], [data-testid="claim-review-confirm-approve"], [data-testid="claim-review-reject"]',
        ),
      ).toHaveCount(0);
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
        role: ORGANIZATION_ROLES.Participant,
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
      ).toEqual([
        { role: ORGANIZATION_ROLES.Participant, organizationId: ids.host },
      ]);
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
      await denied(t);
      // Text-free: the authorized user is not access-denied (state hook, not copy).
      await expect(
        t.locator('[data-testid="no-organization-access"]'),
      ).toHaveCount(0);
      await expect(
        t.locator(
          '[data-testid="save-claim-draft"], [data-testid="save-cost"], [data-testid="submit-claim"]',
        ),
      ).toHaveCount(0);
      const h = await pageFor(browser, "H", baseURL!);
      await h.goto(`/partnerships/${ids.partnership}/claim`);
      await denied(h);
      await expect(
        h.locator('[data-testid="save-cost"], [data-testid="save-claim-draft"]'),
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
    const creator = h.getByTestId("setup-link-creator");
    await creator
      .getByTestId("hosted-project-picker")
      .getByTestId("entity-trigger")
      .click();
    await h.getByTestId("entity-search").fill(names.project);
    await h.locator(`[role="option"][data-entity-id="${projectId}"]`).click();
    await creator.locator("#setup-email").fill(actors.X.email);
    await creator.getByTestId("create-setup-link").click();
    const first = await creator.locator("#recipient-link").inputValue();
    setupId = new URL(first).pathname.split("/").at(-1)!;
    // No setup-link closure UI: DB revocation is a test-helper precondition,
    // not evidence of a browser revocation control.
    await db
      .update(setupLinks)
      .set({ enabled: false })
      .where(eq(setupLinks.id, setupId));
    const x = await pageFor(browser, "X", baseURL!);
    await x.goto(first);
    // Text-free: setup-error state hook proves the disabled page (subsumes page identity).
    await expect(x.locator('[data-setup-error="disabled"]')).toBeVisible();
    await creator.getByTestId("create-setup-link").click();
    const replacement = await creator.locator("#recipient-link").inputValue();
    // Preserve the original pathname inequality without printing either private ID.
    expect(new URL(replacement).pathname !== new URL(first).pathname).toBe(true);
    await x.goto(first);
    await expect(x.locator('[data-setup-error="disabled"]')).toBeVisible();
    const fresh = await browser.newContext({
      baseURL: baseURL!,
      storageState: { cookies: [], origins: [] },
    });
    contexts.push(fresh);
    const separate = await fresh.newPage();
    await separate.goto(replacement);
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(separate, /\/login/);
    // The /login redirect above already proves no project data renders here.
    await x.goto("/projects");
    await expect(
      x.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await x.reload();
    await expect(
      x.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await expect(x.getByTestId("no-organization-access")).toHaveRole("main");
    await x.getByTestId("sign-out").click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(x, new URL("/", baseURL!).toString());
    await x.goto(replacement);
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(x, /\/login/);
    // Do not redeem replacement: it is a spare link addressed to X.
  });

  test("N4 setup-issued Participant Invitation rotation refuses the old link", async ({
    browser,
    baseURL,
  }) => {
    // Issuing/reissuing through UI sends real SMTP. DB preconditions here are NOT
    // browser evidence for delivery or the reissue affordance.
    const oldSecret = `old-secret-${suffix}`;
    const newSecret = `new-secret-${suffix}`;
    registerPrivateValues(oldSecret, newSecret);
    const secretHash = (secret: string) =>
      createHash("sha256").update(secret).digest("hex");
    await db.insert(participantInvitations).values({
      id: ids.oldParticipantInvitation,
      partnershipId: ids.partnership,
      projectId,
      email: actors.T.email,
      secretHash: secretHash(oldSecret),
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      issuedByUserId: actors.P.id,
    });
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(`/partnerships/${ids.partnership}/participants`);
    await expect(
      p
        .getByTestId(`participant-invitation-${ids.oldParticipantInvitation}`)
        .getByTestId("reissue-participant-invitation"),
    ).toBeVisible();
    await db
      .update(participantInvitations)
      .set({ status: "revoked" })
      .where(eq(participantInvitations.id, ids.oldParticipantInvitation));
    await db.insert(participantInvitations).values({
      id: ids.newParticipantInvitation,
      partnershipId: ids.partnership,
      projectId,
      email: actors.T.email,
      secretHash: secretHash(newSecret),
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      issuedByUserId: actors.P.id,
    });
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(
      `/participant-invitations/${ids.oldParticipantInvitation}?secret=${encodeURIComponent(oldSecret)}`,
    );
    await t.getByTestId("participant-name").fill(actors.T.name);
    await t.locator("#participant-country").selectOption("DE");
    await t.getByTestId("accept-participant-agreement").check();
    await t.getByTestId("join-project").click();
    // Error centralization: join uses the participantInvitationClosed factory copy.
    await expect(t.locator("form p[role='alert']")).toBeVisible();
    expect(
      await db
        .select()
        .from(participations)
        .where(eq(participations.projectId, projectId)),
    ).toHaveLength(0);
    await t.goto(
      `/participant-invitations/${ids.newParticipantInvitation}?secret=${encodeURIComponent(newSecret)}`,
    );
    await expect(t.getByTestId("join-project")).toBeVisible();
    // Spare replacement is not redeemed; no Participation or Membership created.
  });

  test("N4 spare Participant Registration Link closes without creating a Participation", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(`/partnerships/${ids.partnership}/participants`);
    await expect(p.getByTestId("send-participant-invitation")).toBeVisible();
    await p.getByTestId("create-registration-link").click();
    // Text-free: the created link input carries a value (functional proof).
    await expect(p.locator("#new-participant-link")).not.toBeEmpty();
    const link = await p.locator("#new-participant-link").inputValue();
    registrationId = new URL(link).pathname.split("/").at(-1)!;
    await p
      .getByTestId(`registration-link-${registrationId}`)
      .getByTestId("close-registration-link")
      .click();
    // Text-free: closing clears the transient link input (functional proof).
    await expect(p.locator("#new-participant-link")).toHaveCount(0);
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(link);
    await expect(t.getByTestId("join-project")).toBeVisible();
    await t.getByTestId("participant-name").fill(actors.T.name);
    await t.locator("#participant-country").selectOption("DE");
    await t.getByTestId("accept-participant-agreement").check();
    await t.getByTestId("join-project").click();
    // Error centralization: join uses the registrationLinkClosed factory copy.
    await expect(t.locator("form p[role='alert']")).toBeVisible();
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
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(page, /\/login/);
  });
});
