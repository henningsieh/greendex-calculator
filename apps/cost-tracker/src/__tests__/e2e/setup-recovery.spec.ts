import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  partnerOrganizationSetupLinksTable as setupLinks,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import type { Browser, BrowserContext } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

import { expect, test, registerPrivateValues } from "./fixtures/artifact-privacy";
import { postSignInWithRateLimitRetry } from "./fixtures/rate-limit-retry";

// Focused setup-recovery regression for the setup-copy unification: the shared
// owning presentation renders validated server refusal reasons behind the
// text-free data-setup-reason hook. Fully self-contained: every row is a
// DB-issued precondition and the file removes every row it creates.
// API-setup exceptions: verified disposable Users and credential accounts,
// one hosting Organization with an Owner membership, one hosted Project, and
// three setup links (expired, disabled, valid-but-foreign). No registration,
// verification, or mail-sending form is submitted in a browser.
const suffix = randomUUID().slice(0, 8);
const names = {
  host: `CT ${suffix} Hosting`,
  project: `CT ${suffix} Main`,
};
const actors = {
  H: {
    id: randomUUID(),
    name: `CT ${suffix} H`,
    email: `ct-${suffix}-h@example.invalid`,
    password: randomUUID(),
  },
  R: {
    id: randomUUID(),
    name: `CT ${suffix} R`,
    email: `ct-${suffix}-r@example.invalid`,
    password: randomUUID(),
  },
  S: {
    id: randomUUID(),
    name: `CT ${suffix} S`,
    email: `ct-${suffix}-s@example.invalid`,
    password: randomUUID(),
  },
} as const;
type Actor = keyof typeof actors;
registerPrivateValues(...Object.values(actors).map((actor) => actor.password));
const hostId = randomUUID();
const links: { id: string; secret: string; reason: string }[] = [];
const contexts: BrowserContext[] = [];
let baseline: { users: number; organizations: number; projects: number };

async function counts() {
  const [[users], [organizations], [projects]] = await Promise.all([
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
      .where(eq(organization.id, hostId)),
    db
      .select({ value: count() })
      .from(projectsTable)
      .where(eq(projectsTable.name, names.project)),
  ]);
  return {
    users: users!.value,
    organizations: organizations!.value,
    projects: projects!.value,
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

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("setup recovery refusals", () => {
  test.setTimeout(300_000);
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
    await db.insert(organization).values({
      country: "DE",
      id: hostId,
      name: names.host,
      slug: hostId,
      createdAt: now,
    });
    await db.insert(member).values({
      id: randomUUID(),
      userId: actors.H.id,
      organizationId: hostId,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: now,
    });
    const [project] = await db
      .insert(projectsTable)
      .values({
        name: names.project,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        location: "Berlin",
        country: "DE",
        organizationId: hostId,
      })
      .returning({ id: projectsTable.id });
    const issued = [
      {
        reason: "SETUP_LINK_EXPIRED",
        expiresAt: new Date(0),
        enabled: true,
        recipient: actors.R.email,
      },
      {
        reason: "SETUP_LINK_DISABLED",
        expiresAt: new Date(Date.now() + 3_600_000),
        enabled: false,
        recipient: actors.R.email,
      },
      {
        reason: "SETUP_LINK_WRONG_EMAIL",
        expiresAt: new Date(Date.now() + 3_600_000),
        enabled: true,
        recipient: actors.R.email,
      },
    ].map((spec) => {
      const id = randomUUID();
      const secret = randomBytes(32).toString("base64url");
      return {
        ...spec,
        id,
        secret,
        row: {
          id,
          projectId: project!.id,
          recipientEmail: spec.recipient,
          secretHash: createHash("sha256").update(secret).digest("hex"),
          enabled: spec.enabled,
          expiresAt: spec.expiresAt,
          createdByUserId: actors.H.id,
        },
      };
    });
    await db.insert(setupLinks).values(issued.map(({ row }) => row));
    links.push(
      ...issued.map(({ id, secret, reason }) => ({ id, secret, reason })),
    );
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    if (links.length)
      await db.delete(setupLinks).where(
        inArray(
          setupLinks.id,
          links.map((link) => link.id),
        ),
      );
    await db.delete(projectsTable).where(eq(projectsTable.name, names.project));
    await db.delete(member).where(eq(member.organizationId, hostId));
    await db.delete(organization).where(eq(organization.id, hostId));
    for (const actor of Object.values(actors)) {
      await db.delete(session).where(eq(session.userId, actor.id));
      await db.delete(user).where(eq(user.id, actor.id));
    }
    expect(await counts()).toEqual(baseline);
  });

  test("expired and disabled links refuse the addressed recipient", async ({
    browser,
    baseURL,
  }) => {
    for (const link of links.slice(0, 2)) {
      const page = await pageFor(browser, "R", baseURL!);
      await page.goto(`/setup-links/${link.id}?secret=${link.secret}`);
      // Text-free: the validated-reason hook proves the refusal kind.
      await expect(
        page.locator(`[data-setup-reason="${link.reason}"]`),
      ).toBeVisible();
      await expect(page.getByTestId("inspect-setup")).toBeEnabled();
      await expect(page.locator("#setup-name")).toHaveCount(0);
      const [stored] = await db
        .select({ partnershipId: setupLinks.partnershipId })
        .from(setupLinks)
        .where(eq(setupLinks.id, link.id));
      expect(stored?.partnershipId).toBeNull();
      await page.close();
    }
  });

  test("a valid link refuses a different verified user", async ({
    browser,
    baseURL,
  }) => {
    const link = links[2]!;
    const page = await pageFor(browser, "S", baseURL!);
    await page.goto(`/setup-links/${link.id}?secret=${link.secret}`);
    await expect(
      page.locator(`[data-setup-reason="${link.reason}"]`),
    ).toBeVisible();
    await expect(page.locator("#setup-name")).toHaveCount(0);
    const [stored] = await db
      .select({ partnershipId: setupLinks.partnershipId })
      .from(setupLinks)
      .where(eq(setupLinks.id, link.id));
    expect(stored?.partnershipId).toBeNull();
    await page.close();
  });
});
