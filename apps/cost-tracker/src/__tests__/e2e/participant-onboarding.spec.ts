import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  account,
  claimsTable,
  invitation,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as coordinatorAssignments,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationBridgesTable as bridges,
  participantProfilesTable as profiles,
  participantRegistrationLinksTable as links,
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

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: verified disposable Users, credential accounts, Organizations,
// Projects, Partnerships, a role-only Group Organizer C, and native Participant/Organization Invitations with their
// bridge records are inserted in beforeAll. The initial Participant Invitation and
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
};
const ids = {
  host: randomUUID(),
  partner: randomUUID(),
  foreign: randomUUID(),
  main: randomUUID(),
  other: randomUUID(),
  partnership: randomUUID(),
  foreignPartnership: randomUUID(),
  otherPartnership: randomUUID(),
  oldInvitation: randomUUID(),
  invitation: randomUUID(),
  staffInvitation: randomUUID(),
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
type Actor = keyof typeof actors;
const contexts: BrowserContext[] = [];
let sharedLink: string;
let otherLink: string;
let baseline: Awaited<ReturnType<typeof counts>>;
const participantsURL = `/partnerships/${ids.partnership}/participants`;

async function counts() {
  const actorIds = Object.values(actors).map((actor) => actor.id);
  const organizationIds = [ids.host, ids.partner, ids.foreign];
  const projectIds = [ids.main, ids.other];
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
    [invitations],
    [bridgeRows],
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
      .from(invitation)
      .where(
        inArray(invitation.id, [
          ids.oldInvitation,
          ids.invitation,
          ids.staffInvitation,
        ]),
      ),
    db
      .select({ value: count() })
      .from(bridges)
      .where(inArray(bridges.projectId, projectIds)),
    db
      .select({ value: count() })
      .from(links)
      .where(inArray(links.partnershipId, partnershipIds)),
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
    invitations: invitations!.value,
    bridges: bridgeRows!.value,
    links: linkRows!.value,
  };
}

async function contextFor(browser: Browser, actor: Actor, baseURL: string) {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  contexts.push(context);
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email: actors[actor].email, password: actors[actor].password },
  });
  expect(response.ok(), `${actor} setup authentication`).toBe(true);
  return context;
}

async function pageFor(browser: Browser, actor: Actor, baseURL: string) {
  return (await contextFor(browser, actor, baseURL)).newPage();
}

async function openPartnerParticipants(page: Page, projectName: string) {
  await page.goto("/projects");
  await page.getByRole("tab", { name: "Partner" }).click();
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await page.getByRole("link", { name: "Coordinate Participants" }).click();
  await expect(
    page.locator('section[aria-label="Project Participations"]'),
  ).toBeVisible();
  await expect(
    page.getByText("Participant Invitations and Registration Links", {
      exact: true,
    }),
  ).toBeVisible();
}

async function join(page: Page, url: string, actor: Actor) {
  await page.goto(url);
  await expect(
    page.getByText("Join as a Project Participant", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /EU–Erasmus Participant agreement \(eu-erasmus-dev-v1\)/,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Participant agreement text")).not.toBeEmpty();
  await page.getByLabel("Full name").fill(actors[actor].name);
  await page.getByLabel("I accept the current Participant agreement").check();
  await page.getByRole("button", { name: "Join Project" }).click();
  // Preserve the original full-URL match; only the diagnostic receives a boolean.
  await expectPrivateURL(page, /\/participant$/);
  await expect(page.getByText(names.main, { exact: true })).toBeVisible();
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
    { role: actor === "Q" ? "member,participant" : "participant" },
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
      {
        id: randomUUID(),
        userId: actors.C.id,
        organizationId: ids.partner,
        role: "project-coordinator",
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
        projectId: ids.main,
        organizationId: ids.foreign,
      },
      {
        id: ids.otherPartnership,
        projectId: ids.other,
        organizationId: ids.partner,
      },
    ]);
    await db.insert(invitation).values([
      {
        id: ids.oldInvitation,
        organizationId: ids.host,
        email: actors.T.email,
        role: "participant",
        status: "pending",
        expiresAt: new Date(Date.now() + 3_600_000),
        inviterId: actors.P.id,
      },
      {
        id: ids.staffInvitation,
        organizationId: ids.host,
        email: actors.Q.email,
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 3_600_000),
        inviterId: actors.H.id,
      },
    ]);
    await db.insert(bridges).values({
      invitationId: ids.oldInvitation,
      partnershipId: ids.partnership,
      projectId: ids.main,
      email: actors.T.email,
      issuedByUserId: actors.P.id,
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
      .where(inArray(participants.projectId, [ids.main, ids.other]));
    await db
      .delete(bridges)
      .where(inArray(bridges.projectId, [ids.main, ids.other]));
    await db
      .delete(links)
      .where(
        inArray(links.partnershipId, [
          ids.partnership,
          ids.foreignPartnership,
          ids.otherPartnership,
        ]),
      );
    await db
      .delete(invitation)
      .where(
        inArray(invitation.id, [
          ids.oldInvitation,
          ids.invitation,
          ids.staffInvitation,
        ]),
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
    await db.delete(projects).where(inArray(projects.id, [ids.main, ids.other]));
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
    await expect(
      page.getByText(
        "Complete your profile before Participant actions are available.",
      ),
    ).toBeVisible();
    await page.getByLabel("Full name").fill(actors.T.name);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByRole("heading", {
        name: /EU–Erasmus Participant agreement \(eu-erasmus-dev-v1\)/,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Participant agreement text")).not.toBeEmpty();
    await expect(
      page.getByRole("button", { name: "Accept agreement" }),
    ).toBeDisabled();
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
    await expect(
      p.getByRole("button", { name: "Send Participant Invitation" }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: `Reissue invitation for ${actors.T.email}` }),
    ).toBeVisible();
    // Reissue UI sends mail. Rotate native and bridge records in setup instead.
    await db
      .update(bridges)
      .set({ status: "revoked" })
      .where(eq(bridges.invitationId, ids.oldInvitation));
    await db
      .update(invitation)
      .set({ status: "canceled" })
      .where(eq(invitation.id, ids.oldInvitation));
    await db.insert(invitation).values({
      id: ids.invitation,
      organizationId: ids.host,
      email: actors.T.email,
      role: "participant",
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      inviterId: actors.P.id,
    });
    await db.insert(bridges).values({
      invitationId: ids.invitation,
      partnershipId: ids.partnership,
      projectId: ids.main,
      email: actors.T.email,
      issuedByUserId: actors.P.id,
    });
    await p.reload();
    await expect(p.getByText("Invitation revoked")).toBeVisible();
    await expect(
      p.getByRole("button", { name: `Reissue invitation for ${actors.T.email}` }),
    ).toBeVisible();
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(`/participant-invitations/${ids.oldInvitation}`);
    await t.getByLabel("Full name").fill(actors.T.name);
    await t.getByLabel("I accept the current Participant agreement").check();
    await t.getByRole("button", { name: "Join Project" }).click();
    await expect(t.locator("form p[role='alert']")).toContainText(
      "We could not complete that request.",
    );
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.userId, actors.T.id)),
    ).toHaveLength(0);
    await t.goto(`/participant-invitations/${ids.invitation}`);
    await expect(t.getByRole("button", { name: "Join Project" })).toBeVisible();
  });

  test("15 P creates a shareable link, closes it and reopens it in-browser", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.main);
    await p
      .getByRole("button", { name: "Create Participant Registration Link" })
      .click();
    await expect(p.getByText("Registration link created")).toBeVisible();
    sharedLink = await p
      .getByLabel("New registration link (copy now)")
      .inputValue();
    const id = new URL(sharedLink).pathname.split("/").at(-1)!;
    await p
      .getByRole("button", { name: `Close registration link ${id}` })
      .click();
    await expect(p.getByText("Registration link closed")).toBeVisible();
    const u = await pageFor(browser, "U", baseURL!);
    await u.goto(sharedLink);
    await u.getByLabel("Full name").fill(actors.U.name);
    await u.getByLabel("I accept the current Participant agreement").check();
    await u.getByRole("button", { name: "Join Project" }).click();
    await expect(u.locator("form p[role='alert']")).toContainText(
      "We could not complete that request.",
    );
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.userId, actors.U.id)),
    ).toHaveLength(0);
    await p
      .getByRole("button", { name: `Reopen registration link ${id}` })
      .click();
    await expect(
      p.getByText("Registration link reopened", { exact: true }),
    ).toBeVisible();
    const row = p.getByRole("listitem").filter({ hasText: `Link ${id}` });
    await expect(row.getByText("Open", { exact: true })).toBeVisible();
    expect(
      (await db.select().from(links).where(eq(links.id, id)))[0]?.enabled,
    ).toBe(true);
    await p.reload();
    await expect(
      p.getByRole("button", { name: `Close registration link ${id}` }),
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
    await expect(
      p.locator('section[aria-label="Project Participations"]'),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Create Participant Registration Link" })
      .click();
    await expect(
      p.getByText("Registration link created", { exact: true }),
    ).toBeVisible();
    const url = await p
      .getByLabel("New registration link (copy now)")
      .inputValue();
    const id = new URL(url).pathname.split("/").at(-1)!;
    await p
      .getByRole("button", { name: `Close registration link ${id}` })
      .click();
    await expect(
      p.getByText("Registration link closed", { exact: true }),
    ).toBeVisible();
    // API-setup exception: the unrelated Partnership's Claim lock is a refusal precondition.
    await db
      .insert(claimsTable)
      .values({ partnershipId: ids.otherPartnership, status: "submitted" });
    try {
      await p
        .getByRole("button", { name: `Reopen registration link ${id}` })
        .click();
      await expect(
        p
          .getByRole("alert")
          .filter({ hasText: "Registration link cannot be reopened" }),
      ).toContainText("A non-editable Claim prevents reopening registration.");
      await expect(
        p
          .getByRole("listitem")
          .filter({ hasText: `Link ${id}` })
          .getByText("Closed", { exact: true }),
      ).toBeVisible();
      expect(
        (await db.select().from(links).where(eq(links.id, id)))[0]?.enabled,
      ).toBe(false);
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
    await join(t, `/participant-invitations/${ids.invitation}`, "T");
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
      await expect(page.getByText(names.main, { exact: true })).toBeVisible();
      await expect(
        page.getByText(`Representing: ${names.partner}`),
      ).toBeVisible();
    }
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.main);
    const joined = p.locator('[data-slot="card"]').filter({
      has: p.getByText("Joined Participants", { exact: true }),
    });
    await expect(
      joined.getByText(`3 Participants in ${names.main}`),
    ).toBeVisible();
    for (const actor of ["T", "U", "V"] as const)
      await expect(joined.getByText(actors[actor].email)).toBeVisible();
    const f = await pageFor(browser, "F", baseURL!);
    await openPartnerParticipants(f, names.main);
    await expect(
      f.getByText("No Participants have joined this Partnership yet."),
    ).toBeVisible();
    for (const actor of ["T", "U", "V"] as const)
      await expect(f.getByText(actors[actor].email)).toHaveCount(0);
    await f.goto(participantsURL);
    await expect(f.getByText(actors.T.email)).toHaveCount(0);
  });

  test("19 cross-Partnership refusal, distinct Project, and Q Hosting member role preservation", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000); // Three independent actor flows and the Organization Invitation handshake.
    const f = await pageFor(browser, "F", baseURL!);
    await openPartnerParticipants(f, names.main);
    await f
      .getByRole("button", { name: "Create Participant Registration Link" })
      .click();
    await expect(f.getByText("Registration link created")).toBeVisible();
    const foreignLink = await f
      .getByLabel("New registration link (copy now)")
      .inputValue();
    const t = await pageFor(browser, "T", baseURL!);
    await t.goto(foreignLink);
    await t.getByLabel("Full name").fill(actors.T.name);
    await t.getByLabel("I accept the current Participant agreement").check();
    await t.getByRole("button", { name: "Join Project" }).click();
    await expect(t.locator("form p[role='alert']")).toContainText(
      "We could not complete that request.",
    );
    expect(
      await db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.userId, actors.T.id),
            eq(participants.projectId, ids.main),
            eq(participants.representedOrganizationId, ids.partner),
          ),
        ),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.userId, actors.T.id),
            eq(participants.representedOrganizationId, ids.foreign),
          ),
        ),
    ).toHaveLength(0);

    // Separate Project's shareable link: P creates it in the browser, T joins it.
    const p = await pageFor(browser, "P", baseURL!);
    await openPartnerParticipants(p, names.other);
    await p
      .getByRole("button", { name: "Create Participant Registration Link" })
      .click();
    await expect(p.getByText("Registration link created")).toBeVisible();
    otherLink = await p
      .getByLabel("New registration link (copy now)")
      .inputValue();
    await t.goto(otherLink);
    await t.getByLabel("Full name").fill(actors.T.name);
    await t.getByLabel("I accept the current Participant agreement").check();
    await t.getByRole("button", { name: "Join Project" }).click();
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(t, /\/participant$/);
    await expect(t.getByText(names.other, { exact: true })).toBeVisible();
    await assertJoined("T", ids.partner, ids.other);

    const q = await pageFor(browser, "Q", baseURL!);
    await q.goto(`/accept-invitation/${ids.staffInvitation}`);
    await expect(
      q.getByRole("heading", { name: "Organization Invitation" }),
    ).toBeVisible();
    await q
      .getByRole("button", { name: "Accept Organization Invitation" })
      .click();
    await expect(q.locator('section p[role="alert"]')).toHaveCount(0);
    // Preserve the original full-URL match; only the diagnostic receives a boolean.
    await expectPrivateURL(q, /\/projects$/);
    expect(await membershipRole("Q", ids.host)).toEqual([{ role: "member" }]);
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
    await p
      .getByRole("button", { name: "Manage Group Organizers", exact: true })
      .click();
    const target = p.getByLabel(
      "Registered User for Group Organizer assignment",
      { exact: true },
    );
    await expect(target).toBeVisible();
    await target.selectOption(actors.C.id);
    const c = await pageFor(browser, "C", baseURL!);
    await c.goto("/projects");
    await expect(
      c.getByRole("link", { name: names.main, exact: true }),
    ).toHaveCount(0);
    await p
      .getByRole("button", { name: "Assign Group Organizer", exact: true })
      .click();
    await expect(
      p.getByRole("alert").filter({ hasText: "Group Organizer update" }),
    ).toContainText("Group Organizer assigned to this Project Partnership.");
    expect(
      await db
        .select()
        .from(coordinatorAssignments)
        .where(
          and(
            eq(coordinatorAssignments.partnershipId, ids.partnership),
            eq(coordinatorAssignments.userId, actors.C.id),
          ),
        ),
    ).toHaveLength(1);
    expect(await membershipRole("C", ids.partner)).toEqual([
      { role: "project-coordinator" },
    ]);
    await c.goto("/projects");
    await expect(
      c.getByRole("link", { name: names.main, exact: true }),
    ).toBeVisible();
    await expect(
      c.getByRole("link", { name: names.other, exact: true }),
    ).toHaveCount(0);
    await c.getByRole("link", { name: names.main, exact: true }).click();
    await c
      .getByRole("link", { name: "Coordinate Participants", exact: true })
      .click();
    await expect(
      c.locator('section[aria-label="Project Participations"]'),
    ).toBeVisible();
    const joined = c.locator('[data-slot="card"]').filter({
      has: c.getByText("Joined Participants", { exact: true }),
    });
    await expect(joined.getByText(actors.T.email, { exact: true })).toBeVisible();
    await c
      .getByRole("button", { name: "Manage Group Organizers", exact: true })
      .click();
    await expect(
      c
        .getByRole("alert")
        .filter({ hasText: "Group Organizer management unavailable" }),
    ).toContainText(
      "You need Organization Owner or Admin access to manage this Organization.",
    );
    await expect(
      c.getByRole("button", { name: "Assign Group Organizer", exact: true }),
    ).toHaveCount(0);
    await p
      .getByRole("button", {
        name: "Revoke Group Organizer assignment",
        exact: true,
      })
      .click();
    await expect(
      p.getByRole("alert").filter({ hasText: "Group Organizer update" }),
    ).toContainText(
      "Group Organizer assignment revoked for this Project Partnership.",
    );
    expect(
      await db
        .select()
        .from(coordinatorAssignments)
        .where(
          and(
            eq(coordinatorAssignments.partnershipId, ids.partnership),
            eq(coordinatorAssignments.userId, actors.C.id),
          ),
        ),
    ).toHaveLength(0);
    expect(await membershipRole("C", ids.partner)).toEqual([
      { role: "project-coordinator" },
    ]);
    await c.goto("/projects");
    await expect(
      c.getByRole("link", { name: names.main, exact: true }),
    ).toHaveCount(0);
    await c.goto(participantsURL);
    await expect(
      c
        .getByRole("alert")
        .filter({ hasText: "Unable to load Project Participations" }),
    ).toContainText(
      "You need Partner Organization staff access or an assignment to this Project Partnership.",
    );
    await expect(c.getByText(actors.T.email, { exact: true })).toHaveCount(0);
  });
});
