import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  user,
  verification,
} from "@greendex/database/schema";
import type { Locator, Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { assertExistingIntegrationDatabase } from "../../../../../scripts/existing-integration-environment";
import { EmailInbox } from "../../../scripts/email-inbox";
import { validateMailboxEnvironment } from "../../../scripts/email-run-safety";
import {
  expect,
  expectPrivateURL,
  registerPrivateValues,
  test,
} from "./fixtures/artifact-privacy";
import { expectFirstOrganizationProjects } from "./fixtures/first-organization";
import { HostingJourneyFixture } from "./fixtures/hosting-journey";
import { staffRow } from "./fixtures/journey-locators";

const fixture = new HostingJourneyFixture();
const destination = `/accept-invitation/${fixture.invitationId}`;
let organizationId: string;

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function noCreation(page: Page) {
  await expect(page.getByTestId("create-organization")).toHaveCount(0);
  await expect(page.getByTestId("no-organization-access")).toHaveCount(0);
}

async function signIn(page: Page, actor: "A" | "X") {
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByTestId("google-sign-in").filter({ visible: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const email = page.getByTestId("email").filter({ visible: true });
  await expect(email).toBeFocused();
  await email.fill(fixture.actors[actor].email);
  await page.keyboard.press("Tab");
  const password = page.getByTestId("password").filter({ visible: true });
  await expect(password).toBeFocused();
  await password.fill(fixture.actors[actor].password);
  await page.keyboard.press("Tab");
  await expect(
    page.getByTestId("auth-submit").filter({ visible: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
}

test.describe.serial("guided Organization Invitation", () => {
  test.setTimeout(150_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    console.log("Guided fixture", fixture.suffix);
    const databaseURL = process.env.DATABASE_URL;
    if (!databaseURL) throw new Error("DATABASE_URL required");
    assertExistingIntegrationDatabase(databaseURL);
    await fixture.setup();
    const context = await fixture.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    await page.goto("/projects");
    const setup = page.getByTestId("no-organization-access");
    await expect(setup).toBeVisible();
    await setup.locator("#organization-name").fill(fixture.organizationName);
    await setup.locator("#organization-country").selectOption("DE");
    await setup.getByTestId("create-organization").click();
    await expectFirstOrganizationProjects(page, fixture.organizationName);
    const created = await db.query.organization.findFirst({
      where: eq(organization.name, fixture.organizationName),
    });
    if (!created) throw new Error("Run-owned Hosting Organization missing");
    organizationId = created.id;
    await page.close();
  });
  test.beforeEach(async () => fixture.createAdminInvitation());
  test.afterEach(async () => {
    await db.delete(invitation).where(eq(invitation.id, fixture.invitationId));
    await db
      .delete(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, fixture.actors.A.id),
        ),
      );
  });
  test.afterAll(async () => fixture.teardown());

  test("returning sign-in retains both doors, accepts once and grants access", async ({
    page,
  }) => {
    await page.goto(destination);
    await expectPrivateURL(
      page,
      `/register?next=${encodeURIComponent(destination)}`,
    );
    await expect(
      page.getByTestId("invitation-context").filter({ visible: true }),
    ).toHaveAttribute("data-organization-id", organizationId);
    await noCreation(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    for (const id of [
      "google-sign-in",
      "name",
      "email",
      "password",
      "auth-submit",
      "auth-account-navigation",
    ]) {
      await page.keyboard.press("Tab");
      await expect(page.getByTestId(id).filter({ visible: true })).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expectPrivateURL(
      page,
      `/login?next=${encodeURIComponent(destination)}`,
    );
    await expect(
      page.getByTestId("auth-account-navigation").filter({ visible: true }),
    ).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent(destination)}`,
    );
    await signIn(page, "A");
    await expectPrivateURL(page, destination);
    const accept = page.getByTestId("accept-organization-invitation");
    await expect(accept).toBeEnabled();
    await expect(
      page.locator('[data-step="verify"]').filter({ visible: true }),
    ).toHaveAttribute("data-state", "complete");
    await noCreation(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname ===
        "/api/rpc/organizations/acceptInvitation"
      )
        requests.push(request.method());
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();
    await page.keyboard.press("Enter");
    await expectPrivateURL(page, "/projects");
    await page.goto("/organization");
    await expect(await staffRow(page, fixture.actors.A.id)).toBeVisible();
    expect(requests).toEqual(["POST"]);
    await page.goto(destination);
    await expectPrivateURL(page, "/projects");
    await expect(page.getByTestId("accept-organization-invitation")).toHaveCount(
      0,
    );
  });

  test("blocks independent creation, rejects each invitation, and offers creation only after the last one", async ({
    browser,
    baseURL,
  }) => {
    const otherName = `CT ${fixture.suffix} Other`;
    let otherOrganizationId: string | undefined;
    const otherContext = await fixture.actorContext(browser, "X", baseURL!);
    const other = await otherContext.newPage();
    const recipientContext = await fixture.actorContext(browser, "A", baseURL!);
    const recipient = await recipientContext.newPage();
    try {
      await other.goto("/projects");
      await other.getByTestId("organization-name").fill(otherName);
      await other.getByTestId("organization-country").selectOption("DE");
      await other.getByTestId("create-organization").click();
      await expectFirstOrganizationProjects(other, otherName);
      const stored = await db.query.organization.findFirst({
        where: eq(organization.name, otherName),
      });
      if (!stored) throw new Error("Run-owned Organization missing");
      otherOrganizationId = stored.id;
      const response = await otherContext.request.post(
        "/api/auth/organization/invite-member",
        {
          headers: { Origin: baseURL! },
          data: {
            email: fixture.actors.A.email,
            role: "admin",
            organizationId: stored.id,
          },
        },
      );
      expect(response.ok()).toBe(true);
      await recipient.goto("/projects");
      await expect(
        recipient.getByTestId("organization-creation-blocked"),
      ).toBeVisible();
      await expect(recipient.getByTestId("invitation-context")).toHaveAttribute(
        "data-organization-id",
        organizationId,
      );
      await expect(
        recipient.getByTestId("accept-organization-invitation"),
      ).toBeEnabled();
      await noCreation(recipient);
      await recipient.getByTestId("reject-organization-invitation").click();
      await expect(recipient.getByTestId("invitation-rejected")).toBeVisible();
      await expect(recipient.getByTestId("invitation-context")).toHaveAttribute(
        "data-organization-id",
        stored.id,
      );
      await expect(
        recipient.getByTestId("organization-creation-blocked"),
      ).toBeVisible();
      await noCreation(recipient);
      await recipient.getByTestId("reject-organization-invitation").click();
      await expect(recipient.getByTestId("invitation-next-step")).toBeVisible();
      await recipient.getByTestId("invitation-next-step").click();
      await expect(recipient.getByTestId("create-organization")).toBeVisible();
      await expect(
        recipient.getByTestId("organization-creation-blocked"),
      ).toHaveCount(0);
    } finally {
      await recipient.close();
      await other.close();
      otherOrganizationId ??= (
        await db.query.organization.findFirst({
          where: eq(organization.name, otherName),
          columns: { id: true },
        })
      )?.id;
      if (otherOrganizationId)
        await db
          .delete(organization)
          .where(eq(organization.id, otherOrganizationId));
    }
  });

  test("Google carries the invitation destination without contacting the provider", async ({
    page,
  }) => {
    await page.goto(destination);
    await expect(
      page.getByTestId("invitation-context").filter({ visible: true }),
    ).toBeVisible();
    await page.route("**/api/rpc/authentication/startGoogleSignIn", (route) =>
      route.fulfill({
        json: {
          json: {
            url: new URL(
              `/login?next=${encodeURIComponent(destination)}`,
              page.url(),
            ).href,
          },
        },
      }),
    );
    const request = page.waitForRequest(
      "**/api/rpc/authentication/startGoogleSignIn",
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.getByTestId("google-sign-in").filter({ visible: true }).click();
    expect((await request).postDataJSON()).toEqual({
      json: { returnTo: destination },
    });
    await expectPrivateURL(
      page,
      `/login?next=${encodeURIComponent(destination)}`,
    );
    await noCreation(page);
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 800 },
  ]) {
    for (const fontSize of [16, 24]) {
      for (const theme of ["light", "dark"] as const) {
        test(`named invitation states fit ${viewport.width} ${fontSize}px ${theme}`, async ({
          page,
          browser,
          baseURL,
        }) => {
          await page.setViewportSize(viewport);
          const appearance = async (target: Page) => {
            await target.evaluate(
              ({ fontSize, theme }) => {
                document.documentElement.style.fontSize = `${fontSize}px`;
                document.documentElement.classList.toggle(
                  "dark",
                  theme === "dark",
                );
                window.scrollTo(0, 0);
              },
              { fontSize, theme },
            );
          };
          const aboveFold = async (
            target: Page,
            action: Locator,
            state: string,
          ) => {
            await expect(action).toBeVisible();
            const box = await action.boundingBox();
            console.log("Geometry", state, viewport.width, fontSize, box);
            expect(
              box !== null && box.y >= 0 && box.y + box.height <= viewport.height,
              state,
            ).toBe(true);
            expect(
              await target.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
              state,
            ).toBe(true);
          };
          await page.goto(destination);
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await appearance(page);
          await expect(page.getByTestId("invitation-context")).toHaveAttribute(
            "data-organization-id",
            organizationId,
          );
          await aboveFold(page, page.getByTestId("auth-submit"), "registration");
          const email = `${"a".repeat(64)}@example.org`;
          await page.route("**/api/rpc/authentication/signUp", (route) =>
            route.fulfill({
              json: {
                json: {
                  success: true,
                  decision: {
                    entryContext: "organization-invitation",
                    nextStep: "verify-email",
                    email,
                    invitation: {
                      id: fixture.invitationId,
                      organization: {
                        id: organizationId,
                        name: fixture.organizationName,
                      },
                    },
                    availableActions: [
                      {
                        kind: "authenticate",
                        entry: "login",
                        returnTo: destination,
                      },
                    ],
                  },
                },
              },
            }),
          );
          await page.getByTestId("name").fill("Geometry visitor");
          await page.getByTestId("email").fill(email);
          await page.getByTestId("password").fill("Geometry-password!");
          await page.getByTestId("auth-submit").click();
          await expect(
            page.getByTestId("auth-verification-message"),
          ).toHaveAttribute("role", "status");
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await appearance(page);
          await aboveFold(
            page,
            page.getByTestId("verification-next-action"),
            "check-inbox",
          );
          const contrast = await page
            .getByTestId("verification-next-action")
            .evaluate((element) => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 1;
              const context = canvas.getContext("2d");
              if (!context) throw new Error("Color measurement unavailable");
              const luminance = (color: string) => {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                const channels = [...context.getImageData(0, 0, 1, 1).data]
                  .slice(0, 3)
                  .map((value) => {
                    const channel = value / 255;
                    return channel <= 0.04045
                      ? channel / 12.92
                      : ((channel + 0.055) / 1.055) ** 2.4;
                  });
                return (
                  channels[0]! * 0.2126 +
                  channels[1]! * 0.7152 +
                  channels[2]! * 0.0722
                );
              };
              const alert = element.closest(
                '[data-testid="auth-verification-message"]',
              );
              if (!alert) throw new Error("Verification status missing");
              const foreground = luminance(getComputedStyle(element).color);
              const background = luminance(
                getComputedStyle(alert).backgroundColor,
              );
              return (
                (Math.max(foreground, background) + 0.05) /
                (Math.min(foreground, background) + 0.05)
              );
            });
          console.log(
            "Verification contrast",
            viewport.width,
            fontSize,
            theme,
            contrast,
          );
          expect(contrast).toBeGreaterThanOrEqual(4.5);
          const instruction = await page
            .getByTestId("verification-next-action")
            .boundingBox();
          const address = await page
            .getByTestId("verification-address")
            .boundingBox();
          expect(
            instruction !== null && address !== null && instruction.y < address.y,
          ).toBe(true);
          const context = await fixture.actorContext(browser, "A", baseURL!);
          const ready = await context.newPage();
          await ready.setViewportSize(viewport);
          await ready.goto(destination);
          await expect(ready.getByRole("heading", { level: 1 })).toBeFocused();
          await appearance(ready);
          await aboveFold(
            ready,
            ready.getByTestId("accept-organization-invitation"),
            "ready",
          );
          await noCreation(ready);
          await db
            .update(invitation)
            .set({ expiresAt: new Date(0) })
            .where(eq(invitation.id, fixture.invitationId));
          await ready.reload();
          await expect(
            ready.locator(
              '[data-invitation-recovery="STAFF_INVITATION_EXPIRED"]',
            ),
          ).toBeVisible();
          await expect(ready.getByRole("heading", { level: 1 })).toBeFocused();
          await appearance(ready);
          await aboveFold(
            ready,
            ready.getByTestId("recheck-organization-invitation"),
            "recovery",
          );
          await noCreation(ready);
          await ready.close();
        });
      }
    }
  }

  for (const path of [
    "/accept-invitation",
    "/accept-invitation/bad!",
    "/accept-invitation/bad.token",
    "/accept-invitation/bad/path",
  ]) {
    test(`malformed ${path} stays in recovery through both authentication doors before and after sign-in`, async ({
      page,
    }) => {
      const entries = [
        path,
        `/register?next=${encodeURIComponent(path)}`,
        `/login?next=${encodeURIComponent(path)}`,
      ];
      const checkRecovery = async () => {
        for (const entry of entries) {
          await page.goto(entry);
          await expect(
            page.locator(
              '[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]',
            ),
          ).toHaveAttribute("role", "status");
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await expect(page.getByRole("textbox")).toHaveCount(0);
          await expect(
            page.getByTestId("accept-organization-invitation"),
          ).toHaveCount(0);
          await noCreation(page);
          await page.keyboard.press("Tab");
          await expect(
            page.getByTestId("recheck-organization-invitation"),
          ).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(
            page.getByTestId("recheck-organization-invitation"),
          ).toBeEnabled();
          await expect(
            page.locator(
              '[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]',
            ),
          ).toBeVisible();
        }
      };
      await checkRecovery();
      await page.goto("/login");
      await signIn(page, "A");
      await expectPrivateURL(page, "/projects");
      await checkRecovery();
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("sign-out")).toBeFocused();
      await page.keyboard.press("Enter");
      await expectPrivateURL(page, "/accept-invitation");
      await noCreation(page);
    });
  }

  for (const state of ["wrong-address", "expired", "cancelled"] as const) {
    test(`${state} recovery rechecks current state and retains invitation sign-out`, async ({
      browser,
      baseURL,
    }) => {
      const context = await fixture.actorContext(
        browser,
        state === "wrong-address" ? "X" : "A",
        baseURL!,
      );
      const page = await context.newPage();
      if (state === "expired")
        await db
          .update(invitation)
          .set({ expiresAt: new Date(0) })
          .where(eq(invitation.id, fixture.invitationId));
      if (state === "cancelled") {
        const host = await fixture.actorContext(browser, "H", baseURL!);
        const response = await host.request.post(
          "/api/auth/organization/cancel-invitation",
          {
            headers: { Origin: baseURL! },
            data: { invitationId: fixture.invitationId },
          },
        );
        expect(response.ok()).toBe(true);
      }
      await page.goto(destination);
      const reason =
        state === "wrong-address"
          ? "STAFF_INVITATION_WRONG_EMAIL"
          : state === "expired"
            ? "STAFF_INVITATION_EXPIRED"
            : "STAFF_INVITATION_WITHDRAWN";
      const recovery = page.locator(`[data-invitation-recovery="${reason}"]`);
      await expect(recovery).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await noCreation(page);
      await page.keyboard.press("Tab");
      await expect(
        page.getByTestId("recheck-organization-invitation"),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(recovery).toBeVisible();
      await expect(
        page.getByTestId("recheck-organization-invitation"),
      ).toBeEnabled();
      await page.getByTestId("sign-out").click();
      await expectPrivateURL(
        page,
        `/register?next=${encodeURIComponent(destination)}`,
      );
      if (state === "wrong-address") {
        await page
          .getByTestId("auth-account-navigation")
          .filter({ visible: true })
          .click();
        await signIn(page, "A");
        await expect(
          page.getByTestId("accept-organization-invitation"),
        ).toBeEnabled();
      } else {
        await expect(
          page.locator('[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]'),
        ).toBeVisible();
        await expect(
          page.getByTestId("invitation-recovery-sign-in"),
        ).toHaveAttribute(
          "href",
          `/login?next=${encodeURIComponent(destination)}`,
        );
      }
      await noCreation(page);
      await page.close();
    });
  }

  test("an accepted link can authenticate anonymously, select if needed and continue without another accept", async ({
    page,
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "A", baseURL!);
    const accepted = await context.request.post(
      "/api/auth/organization/accept-invitation",
      {
        headers: { Origin: baseURL! },
        data: { invitationId: fixture.invitationId },
      },
    );
    expect(accepted.ok()).toBe(true);
    await page.goto(destination);
    await expect(
      page.locator('[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]'),
    ).toBeVisible();
    await page.getByTestId("invitation-recovery-sign-in").click();
    await expect(
      page.getByTestId("email").filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("invitation-context").filter({ visible: true }),
    ).toHaveCount(0);
    await signIn(page, "A");
    await expectPrivateURL(page, "/projects");
    const cleared = await page.request.post("/api/auth/organization/set-active", {
      headers: { Origin: baseURL! },
      data: { organizationId: null },
    });
    expect(cleared.ok()).toBe(true);
    await page.goto(destination);
    const select = page.getByTestId(`select-organization-${organizationId}`);
    await expect(select).toBeEnabled();
    await noCreation(page);
    await expect(page.getByTestId("accept-organization-invitation")).toHaveCount(
      0,
    );
    await select.click();
    await expectPrivateURL(page, "/projects");
    await page.goto("/organization");
    await expect(await staffRow(page, fixture.actors.A.id)).toBeVisible();
  });

  test("mistyped signup recovers before verification, rechecks and retains the correct invitation", async ({
    page,
    baseURL,
  }) => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    validateMailboxEnvironment(environment);
    assertExistingIntegrationDatabase(environment.DATABASE_URL);
    const recipient = environment.EMAIL_TEST_RECIPIENT;
    const name = `Mistyped invitation ${randomUUID()}`;
    const password = `Journey-${randomUUID()}!`;
    registerPrivateValues(recipient, password);
    if (await db.query.user.findFirst({ where: eq(user.email, recipient) }))
      throw new Error(
        "Dedicated workflow recipient is not clean; refusing signup",
      );
    const existingVerifications = await db
      .select({ id: verification.id })
      .from(verification);
    try {
      await page.goto(destination);
      const responses: unknown[] = [];
      const accepts: string[] = [];
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname ===
          "/api/rpc/organizations/acceptInvitation"
        )
          accepts.push(request.method());
      });
      const receipt = page.waitForResponse("**/api/rpc/authentication/signUp");
      await page.getByTestId("name").fill(name);
      await page.getByTestId("email").filter({ visible: true }).fill(recipient);
      await page.getByTestId("password").filter({ visible: true }).fill(password);
      await page.getByTestId("auth-submit").filter({ visible: true }).click();
      responses.push(await (await receipt).json());
      const guidance = page.getByTestId("invitation-recovery-guidance");
      await expect(guidance).toHaveAttribute(
        "data-recovery-guidance",
        "wrongEmail",
      );
      await expect(page.getByTestId("auth-verification-message")).toHaveCount(0);
      await expect(
        page.getByTestId("accept-organization-invitation"),
      ).toHaveCount(0);
      await expect(page.getByTestId("verification-address")).toHaveCount(0);
      await noCreation(page);
      expect(JSON.stringify(responses)).not.toContain(fixture.actors.A.email);
      expect(JSON.stringify(responses)).not.toContain(recipient);
      expect(
        await (await page.request.get("/api/auth/get-session")).json(),
      ).toBeNull();
      const created = await db.query.user.findFirst({
        where: and(eq(user.email, recipient), eq(user.name, name)),
      });
      expect(created?.emailVerified).toBe(false);
      await expect(
        page.getByTestId("invitation-recovery-sign-in"),
      ).toHaveAttribute("href", `/login?next=${encodeURIComponent(destination)}`);
      await page.getByTestId("recheck-organization-invitation").click();
      await expectPrivateURL(
        page,
        `/register?next=${encodeURIComponent(destination)}`,
      );
      await expect(
        page.getByTestId("email").filter({ visible: true }),
      ).toHaveValue("");
      await noCreation(page);
      await page
        .getByTestId("auth-account-navigation")
        .filter({ visible: true })
        .click();
      await expectPrivateURL(
        page,
        `/login?next=${encodeURIComponent(destination)}`,
      );
      await signIn(page, "A");
      await expectPrivateURL(page, destination);
      await expect(
        page.getByTestId("accept-organization-invitation"),
      ).toBeEnabled();
      await noCreation(page);
      expect(accepts).toEqual([]);
      expect(
        await db.query.invitation.findFirst({
          where: eq(invitation.id, fixture.invitationId),
        }),
      ).toMatchObject({ status: "pending" });
      expect(new URL(page.url()).origin).toBe(baseURL);
    } finally {
      await page.goto("about:blank");
      const owned = await db.query.user.findFirst({
        where: and(eq(user.email, recipient), eq(user.name, name)),
      });
      if (owned) await db.delete(user).where(eq(user.id, owned.id));
      expect(await db.select({ id: verification.id }).from(verification)).toEqual(
        expect.arrayContaining(existingVerifications),
      );
    }
  });

  test("delivered invitation and verification resume signed in for exactly one accept and resulting access", async ({
    page,
    browser,
    baseURL,
  }) => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    validateMailboxEnvironment(environment);
    assertExistingIntegrationDatabase(environment.DATABASE_URL);
    if (!baseURL) throw new Error("Existing application URL required");
    const recipient = environment.EMAIL_TEST_RECIPIENT;
    const name = `Guided invitation ${randomUUID()}`;
    const password = `Journey-${randomUUID()}!`;
    registerPrivateValues(recipient, password);
    if (await db.query.user.findFirst({ where: eq(user.email, recipient) }))
      throw new Error(
        "Dedicated workflow recipient is not clean; refusing signup",
      );
    const existingVerifications = await db
      .select({ id: verification.id })
      .from(verification);
    const inbox = new EmailInbox({
      ...environment,
      DELETE_TESTMAILS_DURING_TESTRUN: "false",
    });
    let connected = false;
    try {
      await inbox.connect();
      connected = true;
      const boundary = await inbox.boundary();
      const host = await fixture.actorContext(browser, "H", baseURL);
      const owner = await host.newPage();
      await owner.goto("/organization");
      await owner.getByTestId("staff-invite-email").fill(recipient);
      await owner.getByTestId("send-staff-invitation").click();
      const deliveredInvitation = await inbox.deliveredLink(
        boundary,
        `You're invited to join ${fixture.organizationName}`,
        baseURL,
        "/accept-invitation/",
        (_, html) => html.includes(fixture.organizationName),
      );
      registerPrivateValues(deliveredInvitation);
      const invitationPath = new URL(deliveredInvitation).pathname;
      await page.goto(deliveredInvitation);
      await expectPrivateURL(
        page,
        `/register?next=${encodeURIComponent(invitationPath)}`,
      );
      await expect(
        page.getByTestId("invitation-context").filter({ visible: true }),
      ).toHaveAttribute("data-organization-id", organizationId);
      await expect(
        page.getByTestId("email").filter({ visible: true }),
      ).toHaveValue("");
      await noCreation(page);
      const verificationBoundary = await inbox.boundary();
      await page.getByTestId("name").fill(name);
      await page.getByTestId("email").filter({ visible: true }).fill(recipient);
      await page.getByTestId("password").filter({ visible: true }).fill(password);
      await page.getByTestId("auth-submit").filter({ visible: true }).click();
      await expect(page.getByTestId("auth-verification-message")).toHaveAttribute(
        "role",
        "status",
      );
      await expect(
        page.getByTestId("invitation-context").filter({ visible: true }),
      ).toHaveAttribute("data-organization-id", organizationId);
      await expect(page.getByTestId("inbox-sign-in")).toHaveAttribute(
        "href",
        `/login?next=${encodeURIComponent(invitationPath)}`,
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("inbox-sign-in")).toBeFocused();
      const verificationLink = await inbox.deliveredLink(
        verificationBoundary,
        "Verify Your Email Address",
        baseURL,
        "/api/auth/verify-email",
        (_, html) => html.includes(name),
      );
      registerPrivateValues(verificationLink);
      await page.goto(verificationLink);
      await expectPrivateURL(page, invitationPath);
      await expect(
        page.getByTestId("accept-organization-invitation"),
      ).toBeEnabled();
      await expect(page.getByTestId("auth-verification-message")).toHaveCount(0);
      await noCreation(page);
      const requests: string[] = [];
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname ===
          "/api/rpc/organizations/acceptInvitation"
        )
          requests.push(request.method());
      });
      await page.getByTestId("accept-organization-invitation").click();
      await expectPrivateURL(page, "/projects");
      await page.goto("/organization");
      const created = await db.query.user.findFirst({
        where: and(eq(user.email, recipient), eq(user.name, name)),
      });
      if (!created) throw new Error("Run-owned User missing");
      expect(created.emailVerified).toBe(true);
      await expect(await staffRow(page, created.id)).toBeVisible();
      expect(requests).toEqual(["POST"]);
      await page.goto(invitationPath);
      await expectPrivateURL(page, "/projects");
      const replay = await browser.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
      });
      try {
        const replayed = await replay.newPage();
        await replayed.goto(verificationLink);
        await expect(
          replayed.getByTestId("accept-organization-invitation"),
        ).toHaveCount(0);
        const session = await replay.request.get("/api/auth/get-session");
        expect(await session.json()).toBeNull();
      } finally {
        await replay.close();
      }
      await owner.close();
    } finally {
      try {
        await page.goto("about:blank");
        await db
          .delete(invitation)
          .where(
            and(
              eq(invitation.organizationId, organizationId),
              eq(invitation.email, recipient),
            ),
          );
        const owned = await db.query.user.findFirst({
          where: and(eq(user.email, recipient), eq(user.name, name)),
        });
        if (owned) {
          await db.delete(user).where(eq(user.id, owned.id));
        }
        expect(
          await db.query.user.findFirst({
            where: and(eq(user.email, recipient), eq(user.name, name)),
          }),
        ).toBeUndefined();
        const retainedVerifications = await db
          .select({ id: verification.id })
          .from(verification);
        expect(retainedVerifications).toEqual(
          expect.arrayContaining(existingVerifications),
        );
      } finally {
        if (connected) {
          const cleanup = await inbox.cleanup();
          console.log(
            `Guided invitation mail cleanup retained=${cleanup.retained} deleted=${cleanup.deleted}`,
          );
        }
      }
    }
  });
});
