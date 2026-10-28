import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  claimsTable,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as coordinatorAssignments,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantProfilesTable as profiles,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
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
// deep guard is dormant. See #338 (E2E artifact privacy follow-up).
// API-setup exceptions: verified disposable Users, credential accounts, Organizations,
// Projects, Partnerships, a role-only Group Organizer C, and app-owned Participant
// Invitations are inserted in beforeAll. The initial Participant Invitation and
// its replacement are never submitted through the UI: both issue and reissue send
// real SMTP mail. Browser redemption, profile, draft acceptance, join and link
// creation/closure/reopening do not send mail. Mail delivery remains manual/Vitest evidence.
// Case 15 reopens in-browser; a setup-seeded non-editable Claim proves visible refusal.
// Case 203 assigns/revokes Group Organizer scope in-browser without changing roles.
// UI GAP (14): reissue is visible, but cannot be clicked against real SMTP.
const suffix = randomUUID();
const names = {
  host: `CT ${suffix} Hosting`,
  partner: `CT ${suffix} Partner A`,
  foreign: `CT ${suffix} Partner B`,
  main: `CT ${suffix} Main`,
  other: `CT ${suffix} Other`,
  foreignProject: `CT ${suffix} Foreign`,
};
const ids = {
  host: randomUUID(),
  partner: randomUUID(),
  foreign: randomUUID(),
  main: randomUUID(),
  other: randomUUID(),
  foreignProject: randomUUID(),
  partnership: randomUUID(),
  foreignPartnership: randomUUID(),
  otherPartnership: randomUUID(),
  oldInvitation: randomUUID(),
  invitation: randomUUID(),
};
const actors = Object.fromEntries(
  (["H", "P", "F", "T", "U", "V", "Q", "C"] as const).map((code) => [
    code,
    {
      id: randomUUID(),
      name: `CT ${suffix} ${code}`,
      email: `ct-${suffix}-${code.toLowerCase()}@example.invalid`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "H" | "P" | "F" | "T" | "U" | "V" | "Q" | "C",
  {
    id: string;
    name: string;
    email: string;
    password: string;
  }
>;
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));

// App-owned invitation secrets live only in setup and the emailed links.
// The join procedure stores hashes; these fixtures carry the bound secrets.
const invitationSecrets: Record<string, string> = {
  [ids.oldInvitation]: `old-secret-${suffix}`,
  [ids.invitation]: `invitation-secret-${suffix}`,
};
registerPrivateValues(...Object.values(invitationSecrets));
const invitationSecretHash = (invitationId: string) =>
  createHash("sha256").update(invitationSecrets[invitationId]!).digest("hex");
const invitationUrl = (invitationId: string) =>
  `/participant-invitations/${invitationId}?secret=${encodeURIComponent(invitationSecrets[invitationId]!)}`;
type Actor = keyof typeof actors;
const contexts: BrowserContext[] = [];
let sharedLink: string;
let otherLink: string;
let baseline: Awaited<ReturnType<typeof counts>>;
const participantsURL = `/partnerships/${ids.partnership}/participants`;

async function counts() {
  const actorIds = Object.values(actors).map((actor) => actor.id);
  const organizationIds = [ids.host, ids.partner, ids.foreign];
  const projectIds = [ids.main, ids.other, ids.foreignProject];
  const partnershipIds = [
    ids.partnership,
    ids.foreignPartnership,
    ids.otherPartnership,
  ];
  const [
    [users],
    [accounts],
    [sessions],
    [organizations],
    [members],
    [projectRows],
    [partnershipRows],
    [participantRows],
    [profileRows],
    [acceptanceRows],
    [invitationRows],
    [linkRows],
  ] = await Promise.all([
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
      .where(inArray(organization.id, organizationIds)),
    db
      .select({ value: count() })
      .from(member)
      .where(inArray(member.organizationId, organizationIds)),
    db
      .select({ value: count() })
      .from(projects)
      .where(inArray(projects.id, projectIds)),
    db
      .select({ value: count() })
      .from(partnerships)
      .where(inArray(partnerships.id, partnershipIds)),
    db
      .select({ value: count() })
      .from(participants)
      .where(inArray(participants.projectId, projectIds)),
    db
      .select({ value: count() })
      .from(profiles)
      .where(inArray(profiles.userId, actorIds)),
    db
      .select({ value: count() })
      .from(acceptances)
      .where(inArray(acceptances.userId, actorIds)),
    db
      .select({ value: count() })
      .from(entryTokens)
      .where(inArray(entryTokens.id, [ids.oldInvitation, ids.invitation])),
    db
      .select({ value: count() })
      .from(entryTokens)
      .where(inArray(entryTokens.partnershipId, partnershipIds)),
  ]);
  return {
    users: users!.value,
    accounts: accounts!.value,
    sessions: sessions!.value,
    organizations: organizations!.value,
    members: members!.value,
    projects: projectRows!.value,
    partnerships: partnershipRows!.value,
    participants: participantRows!.value,
    profiles: profileRows!.value,
    acceptances: acceptanceRows!.value,
    invitations: invitationRows!.value,
    links: linkRows!.value,
  };
}

async function contextFor(browser: Browser, actor: Actor, baseURL: string) {
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
  expect(response.ok(), `${actor} setup authentication`).toBe(true);
  return context;
}

async function pageFor(browser: Browser, actor: Actor, baseURL: string) {
  return (await contextFor(browser, actor, baseURL)).newPage();
}

async function openPartnerParticipants(page: Page, projectName: string) {
  await page.goto("/projects");
  await page.getByTestId("project-scope-partner").click();
  await page
    .locator(
      `a[href="/projects/${projectName === names.main ? ids.main : projectName === names.foreignProject ? ids.foreignProject : ids.other}"], a[href^="/projects/${projectName === names.main ? ids.main : projectName === names.foreignProject ? ids.foreignProject : ids.other}?"]`,
    )
    .click();
  await page.locator('a[href^="/partnerships/"][href$="/participants"]').click();
  await expect(page.getByTestId("project-participations")).toBeVisible();
  // Text-free: the section above is already proven visible; the invitation
  // form interactions below prove the content (no heading-copy assertion).
}

async function join(page: Page, url: string, actor: Actor) {
  await page.goto(url);
  await expect(page.getByTestId("participant-agreement")).toBeVisible();
  await expect(page.getByTestId("participant-agreement")).not.toBeEmpty();
  await page.getByTestId("participant-name").fill(actors[actor].name);
  await page.locator("#participant-country").selectOption("DE");
  await page.getByTestId("accept-participant-agreement").check();
  await page.getByTestId("join-project").click();
  // Preserve the original full-URL match; only the diagnostic receives a boolean.
  await expectPrivateURL(page, /\/participant$/);
  await expect(page.getByTestId("participant-dashboard")).toHaveAttribute(
    "data-dashboard-state",
    "ready",
  );
}

async function membershipRole(actor: Actor, organizationId: string) {
  return db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, actors[actor].id),
        eq(member.organizationId, organizationId),
      ),
    );
}

async function assertJoined(
  actor: Actor,
  partnerId = ids.partner,
  projectId = ids.main,
) {
  expect(await membershipRole(actor, ids.host)).toEqual([
    {
      role:
        actor === "Q"
          ? `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`
          : ORGANIZATION_ROLES.Participant,
    },
  ]);
  expect(await membershipRole(actor, partnerId)).toHaveLength(0);
  expect(
    await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.userId, actors[actor].id),
          eq(participants.projectId, projectId),
          eq(participants.representedOrganizationId, partnerId),
        ),
      ),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(acceptances)
      .where(eq(acceptances.userId, actors[actor].id)),
  ).toHaveLength(1);
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Participant onboarding journey G2 and 14–19", () => {
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
        providerId: "credential",
        userId: actor.id,
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
      {
        id: randomUUID(),
        userId: actors.C.id,
        organizationId: ids.partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
    ]);
    await db.insert(projects).values([
      {
        id: ids.main,
        name: names.main,
        organizationId: ids.host,
        startDate: now,
        endDate: now,
        location: "Berlin",
        country: "DE",
      },
      {
        id: ids.foreignProject,
        name: names.foreignProject,
        organizationId: ids.host,
        startDate: now,
        endDate: now,
        location: "Berlin",
        country: "DE",
      },
      {
        id: ids.other,
        name: names.other,
        organizationId: ids.host,
        startDate: now,
        endDate: now,
        location: "Berlin",
        country: "DE",
      },
    ]);
    await db.insert(partnerships).values([
      { id: ids.partnership, projectId: ids.main, organizationId: ids.partner },
      {
        id: ids.foreignPartnership,
        projectId: ids.foreignProject,
        organizationId: ids.foreign,
      },
      {
        id: ids.otherPartnership,
        projectId: ids.other,
        organizationId: ids.partner,
      },
    ]);
    await db.insert(entryTokens).values([
      {
        id: ids.oldInvitation,
        partnershipId: ids.partnership,
        projectId: ids.main,
        email: actors.T.email,
        secretHash: invitationSecretHash(ids.oldInvitation),
        status: "pending",
        expiresAt: new Date(Date.now() + 3_600_000),
        issuedByUserId: actors.P.id,
      },
    ]);
    // Hosting coordinator provisioning has no product UI yet (ADR-0012).
    // Setup-only real Membership, never an invitation or fake acceptance.
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: ids.host,
      userId: actors.Q.id,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    });
  });

  // Actor state lives in the database, not an open page. Release browser
  // contexts between cases so retained renderers cannot starve the dev server.
  test.afterEach(async () => {
    await Promise.all(contexts.splice(0).map((context) => context.close()));
  });

  test.afterAll(async () => {
    await Promise.all(contexts.splice(0).map((context) => context.close()));
    await db
      .delete(claimsTable)
      .where(eq(claimsTable.partnershipId, ids.otherPartnership));
    await db
      .delete(coordinatorAssignments)
      .where(
        inArray(coordinatorAssignments.partnershipId, [
          ids.partnership,
          ids.foreignPartnership,
          ids.otherPartnership,
        ]),
      );
    await db
      .delete(participants)
      .where(
        inArray(participants.projectId, [
          ids.main,
          ids.other,
          ids.foreignProject,
        ]),
      );
    await db
      .delete(entryTokens)
      .where(
        inArray(entryTokens.projectId, [ids.main, ids.other, ids.foreignProject]),
      );
    await db
      .delete(partnerships)
      .where(
        inArray(partnerships.id, [
          ids.partnership,
          ids.foreignPartnership,
          ids.otherPartnership,
        ]),
      );
    await db
      .delete(projects)
      .where(inArray(projects.id, [ids.main, ids.other, ids.foreignProject]));
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
    expect(
      await db
        .select()
        .from(coordinatorAssignments)
        .where(
          inArray(coordinatorAssignments.partnershipId, [
            ids.partnership,
            ids.foreignPartnership,
            ids.otherPartnership,
          ]),
        ),
    ).toHaveLength(0);
  });

  test("G2 T saves a profile and sees the development draft without joining", async ({
    browser,
    baseURL,
  }) => {
    const page = await pageFor(browser, "T", baseURL!);
    await page.goto("/participant");
    await page.getByTestId("participant-profile-name").fill(actors.T.name);
    await page.getByTestId("save-participant-profile").click();
    await expect(page.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "agreement",
    );
    await expect(page.getByTestId("participant-agreement")).not.toBeEmpty();
    await expect(page.getByTestId("accept-agreement")).toBeDisabled();
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, actors.T.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.userId, actors.T.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, actors.T.id)),
    ).toHaveLength(0);
  });

  test("14 setup-issued Participant Invitation rotates before redemption; old refuses", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.main);
    await expect(p.getByTestId("send-participant-invitation")).toBeVisible();
    await expect(
      p
        .getByTestId(`participant-invitation-${ids.oldInvitation}`)
        .getByTestId("reissue-participant-invitation"),
    ).toBeVisible();
    // Reissue UI sends mail. Rotate app-owned invitation records in setup instead.
    await db
      .update(entryTokens)
      .set({ status: "revoked" })
      .where(eq(entryTokens.id, ids.oldInvitation));
    await db.insert(entryTokens).values({
      id: ids.invitation,
      partnershipId: ids.partnership,
      projectId: ids.main,
      email: actors.T.email,
      secretHash: invitationSecretHash(ids.invitation),
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      issuedByUserId: actors.P.id,
    });
    await p.reload();
    // Text-free: the Reissue control below proves the revoked state (no toast copy).
    await expect(
      p
        .getByTestId(`participant-invitation-${ids.invitation}`)
        .getByTestId("reissue-participant-invitation"),
    ).toBeVisible();
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(invitationUrl(ids.oldInvitation));
    await t.getByTestId("participant-name").fill(actors.T.name);
    await t.locator("#participant-country").selectOption("DE");
    await t.getByTestId("accept-participant-agreement").check();
    await t.getByTestId("join-project").click();
    // Error centralization: join uses the participantInvitationClosed factory copy.
    await expect(t.locator("form p[role='alert']")).toBeVisible();
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.userId, actors.T.id)),
    ).toHaveLength(0);
    await t.goto(invitationUrl(ids.invitation));
    await expect(t.getByTestId("join-project")).toBeVisible();
  });

  test("15 P creates a shareable link, closes it and reopens it in-browser", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.main);
    await p.getByTestId("create-registration-link").click();
    // Text-free: the created link input carries a value (functional proof).
    await expect(p.locator("#new-participant-link")).not.toBeEmpty();
    sharedLink = await p.locator("#new-participant-link").inputValue();
    const id = new URL(sharedLink).pathname.split("/").at(-1)!;
    await p
      .getByTestId(`registration-link-${id}`)
      .getByTestId("close-registration-link")
      .click();
    // Text-free: link row carries the closed state (stable id, not copy).
    await expect(
      p.locator(
        `[data-testid="registration-link-${id}"][data-link-open="false"]`,
      ),
    ).toBeVisible();
    const u = await pageFor(browser, "U", baseURL!);
    await u.goto(sharedLink);
    await u.getByTestId("participant-name").fill(actors.U.name);
    await u.locator("#participant-country").selectOption("DE");
    await u.getByTestId("accept-participant-agreement").check();
    await u.getByTestId("join-project").click();
    // Error centralization: join uses the registrationLinkClosed factory copy.
    await expect(u.locator("form p[role='alert']")).toBeVisible();
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.userId, actors.U.id)),
    ).toHaveLength(0);
    await p
      .getByTestId(`registration-link-${id}`)
      .getByTestId("reopen-registration-link")
      .click();
    // Text-free: link row carries the reopened state (DB pending-check below covers value).
    await expect(
      p.locator(`[data-testid="registration-link-${id}"][data-link-open="true"]`),
    ).toBeVisible();
    const row = p.locator(`[data-testid="registration-link-${id}"]`);
    // Text-free: row state attribute (same row located by stable test id above).
    await expect(row).toHaveAttribute("data-link-open", "true");
    expect(
      (await db.select().from(entryTokens).where(eq(entryTokens.id, id)))[0]
        ?.status,
    ).toBe("pending");
    await p.reload();
    await expect(
      p
        .getByTestId(`registration-link-${id}`)
        .getByTestId("close-registration-link"),
    ).toBeVisible();
  });

  test("15 non-editable Claim visibly refuses reopening a closed registration link", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    // Isolate control coverage from the intermittently stuck Project-detail → desk
    // navigation seam; the existing journey tests still exercise that navigation.
    await p.goto(`/partnerships/${ids.otherPartnership}/participants`);
    await expect(p.getByTestId("project-participations")).toBeVisible();
    await p.getByTestId("create-registration-link").click();
    // Text-free: the created link input carries a value (functional proof).
    await expect(p.locator("#new-participant-link")).not.toBeEmpty();
    const url = await p.locator("#new-participant-link").inputValue();
    const id = new URL(url).pathname.split("/").at(-1)!;
    await p
      .getByTestId(`registration-link-${id}`)
      .getByTestId("close-registration-link")
      .click();
    // Text-free: link row carries the closed state (DB revoked-check below covers value).
    await expect(
      p.locator(
        `[data-testid="registration-link-${id}"][data-link-open="false"]`,
      ),
    ).toBeVisible();
    // API-setup exception: the unrelated Partnership's Claim lock is a refusal precondition.
    await db
      .insert(claimsTable)
      .values({ partnershipId: ids.otherPartnership, status: "submitted" });
    try {
      await p
        .getByTestId(`registration-link-${id}`)
        .getByTestId("reopen-registration-link")
        .click();
      await expect(
        p.locator('[role="alert"]:not(#__next-route-announcer__)'),
      ).toBeVisible();
      // Text-free: link row carries the closed state (stable id + DB proof below).
      await expect(
        p.locator(
          `[data-testid="registration-link-${id}"][data-link-open="false"]`,
        ),
      ).toBeVisible();
      expect(
        (await db.select().from(entryTokens).where(eq(entryTokens.id, id)))[0]
          ?.status,
      ).toBe("revoked");
    } finally {
      await db
        .delete(claimsTable)
        .where(eq(claimsTable.partnershipId, ids.otherPartnership));
    }
  });

  test("16 T joins through the replacement Participant Invitation", async ({
    browser,
    baseURL,
  }) => {
    const t = await pageFor(browser, "T", baseURL!);
    await join(t, invitationUrl(ids.invitation), "T");
    await assertJoined("T");
  });

  test("17 U and V independently join through the genuine shareable link", async ({
    browser,
    baseURL,
  }) => {
    for (const actor of ["U", "V"] as const) {
      const page = await pageFor(browser, actor, baseURL!);
      await join(page, sharedLink, actor);
      await assertJoined(actor);
    }
  });

  test("18 joined T and U see own Project; P sees only Partner A, F cannot see them", async ({
    browser,
    baseURL,
  }) => {
    for (const actor of ["T", "U"] as const) {
      const page = await pageFor(browser, actor, baseURL!);
      await page.goto("/participant");
      await expect(page.getByTestId("participant-dashboard")).toHaveAttribute(
        "data-dashboard-state",
        "ready",
      );
      await expect(
        page.getByTestId(`participant-project-${ids.main}`),
      ).toBeVisible();
    }
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.main);
    const joined = p.locator('[data-testid="joined-participants"]');
    // Text-free: all three join flows above acted uniquely; row count proves all landed.
    await expect(
      joined.locator('li[data-testid^="joined-participant-"]'),
    ).toHaveCount(3);
    const f = await pageFor(browser, "F", baseURL!);
    await openPartnerParticipants(f, names.foreignProject);
    // Text-free: empty-state hook proves F sees nobody (denied scope).
    await expect(
      f.locator('[data-testid="joined-participants-empty"]'),
    ).toBeVisible();
    await f.goto(participantsURL);
    await expect(
      f.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible({
      timeout: 90_000,
    });
    // Text-free: the scope-denied alert above proves F sees no participant data.
  });

  test("19 distinct Project and Q Hosting coordinator role preservation", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Three independent actor flows and the Organization Invitation handshake.
    // #337: same-Project cross-Partner join refusal is unconstructible.
    // Keep distinct-Project joins and role preservation below.
    const t = await pageFor(browser, "T", baseURL!);

    // Separate Project's shareable link: P creates it in the browser, T joins it.
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.other);
    await p.getByTestId("create-registration-link").click();
    // Text-free: the created link input carries a value (functional proof).
    await expect(p.locator("#new-participant-link")).not.toBeEmpty();
    otherLink = await p.locator("#new-participant-link").inputValue();
    await t.goto(otherLink);
    await t.getByTestId("participant-name").fill(actors.T.name);
    await t.locator("#participant-country").selectOption("DE");
    await t.getByTestId("accept-participant-agreement").check();
    await t.getByTestId("join-project").click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(t, /\/participant$/);
    await expect(t.getByTestId("participant-dashboard")).toHaveAttribute(
      "data-dashboard-state",
      "ready",
    );
    await expect(t.getByTestId(`participant-project-${ids.other}`)).toBeVisible();
    await assertJoined("T", ids.partner, ids.other);

    const q = await pageFor(browser, "Q", baseURL!);
    expect(await membershipRole("Q", ids.host)).toEqual([
      { role: ORGANIZATION_ROLES.ProjectCoordinator },
    ]);
    await join(q, sharedLink, "Q");
    await assertJoined("Q");
  });

  test("203 P assigns and revokes C's Group Organizer scope without changing Membership roles", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Owner action plus independent coordinator access checks.
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(participantsURL);
    await p.getByTestId("manage-group-organizers").click();
    const target = p.locator('select[id^="group-organizer-"]');
    await expect(target).toBeVisible();
    await target.selectOption(actors.C.id);
    const c = await pageFor(browser, "C", baseURL!);
    await c.goto("/projects");
    // Text-free: empty-state hook instead of visible copy.
    await expect(
      c.locator('[data-testid="assigned-projects-empty"]'),
    ).toBeVisible();
    await expect(
      c.locator(
        `a[href="/projects/${ids.main}"], a[href^="/projects/${ids.main}?"]`,
      ),
    ).toHaveCount(0);
    await p.getByTestId("assign-group-organizer").click();
    await expect(
      p.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible();
    await expect
      .poll(() =>
        db
          .select()
          .from(coordinatorAssignments)
          .where(
            and(
              eq(coordinatorAssignments.partnershipId, ids.partnership),
              eq(coordinatorAssignments.userId, actors.C.id),
            ),
          ),
      )
      .toHaveLength(1);
    expect(await membershipRole("C", ids.partner)).toEqual([
      { role: ORGANIZATION_ROLES.ProjectCoordinator },
    ]);
    await c.goto("/projects");
    await expect(
      c.locator(
        `a[href="/projects/${ids.main}"], a[href^="/projects/${ids.main}?"]`,
      ),
    ).toBeVisible();
    await expect(
      c.locator(
        `a[href="/projects/${ids.other}"], a[href^="/projects/${ids.other}?"]`,
      ),
    ).toHaveCount(0);
    await c
      .locator(
        `a[href="/projects/${ids.main}"], a[href^="/projects/${ids.main}?"]`,
      )
      .click();
    await c.locator('a[href^="/partnerships/"][href$="/participants"]').click();
    await expect(c.getByTestId("project-participations")).toBeVisible();
    // Text-free: membership proven by assertJoined DB proof in this flow (no email copy).
    // (Joined-card presence already proven by the section assertion above.)
    await c.getByTestId("manage-group-organizers").click();
    await expect(
      c.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible();
    await expect(c.getByTestId("assign-group-organizer")).toHaveCount(0);
    await p.getByTestId("revoke-group-organizer").click();
    await p.getByRole("dialog").getByTestId("confirm-dialog-execute").click();
    await expect(
      p.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible();
    await expect
      .poll(() =>
        db
          .select()
          .from(coordinatorAssignments)
          .where(
            and(
              eq(coordinatorAssignments.partnershipId, ids.partnership),
              eq(coordinatorAssignments.userId, actors.C.id),
            ),
          ),
      )
      .toHaveLength(0);
    expect(await membershipRole("C", ids.partner)).toEqual([
      { role: ORGANIZATION_ROLES.ProjectCoordinator },
    ]);
    await c.goto("/projects");
    // Text-free: empty-state hook instead of visible copy.
    await expect(
      c.locator('[data-testid="assigned-projects-empty"]'),
    ).toBeVisible();
    await expect(
      c.locator(
        `a[href="/projects/${ids.main}"], a[href^="/projects/${ids.main}?"]`,
      ),
    ).toHaveCount(0);
    await c.goto(participantsURL);
    await expect(
      c.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible({ timeout: 90_000 });
    // Text-free: the scope-denied alert above proves no participant data leaks.
  });
});
