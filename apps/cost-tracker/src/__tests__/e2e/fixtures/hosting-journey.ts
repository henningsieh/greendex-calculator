import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  account,
  invitation,
  member,
  organization,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { type Browser, type BrowserContext, expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

import { registerPrivateValues } from "./artifact-privacy";

// Only setup-only auth operations live here. Browser actions remain in the specs.
export class HostingJourneyFixture {
  readonly suffix = randomUUID();
  readonly organizationName = `CT ${this.suffix} Hosting`;
  readonly projectNames = ["Main", "Existing", "Isolation"].map(
    (name) => `CT ${this.suffix} ${name}`,
  );
  readonly actors = Object.fromEntries(
    (["H", "A", "X"] as const).map((actor) => [
      actor,
      {
        id: randomUUID(),
        name: `CT ${this.suffix} ${actor}`,
        email: `ct-${this.suffix}-${actor.toLowerCase()}@example.invalid`,
        password: randomUUID(),
      },
    ]),
  ) as Record<
    "H" | "A" | "X",
    { id: string; name: string; email: string; password: string }
  >;
  readonly invitationId = randomUUID();
  private readonly contexts: BrowserContext[] = [];
  private baseline?: {
    users: number;
    organizations: number;
    projects: number;
    invitations: number;
  };

  private async counts() {
    const [[users], [organizations], [projects], [invitations]] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(user)
          .where(
            inArray(
              user.id,
              Object.values(this.actors).map((actor) => actor.id),
            ),
          ),
        db
          .select({ value: count() })
          .from(organization)
          .where(eq(organization.name, this.organizationName)),
        db
          .select({ value: count() })
          .from(projectsTable)
          .where(inArray(projectsTable.name, this.projectNames)),
        db
          .select({ value: count() })
          .from(invitation)
          .where(eq(invitation.id, this.invitationId)),
      ]);
    return {
      users: users!.value,
      organizations: organizations!.value,
      projects: projects!.value,
      invitations: invitations!.value,
    };
  }

  async setup() {
    registerPrivateValues(
      ...Object.values(this.actors).map((actor) => actor.password),
    );
    this.baseline = await this.counts();
    for (const actor of Object.values(this.actors)) {
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
  }

  async createAdminInvitation() {
    const [host] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, this.organizationName));
    expect(
      host,
      "Hosting Organization must have been created through the UI",
    ).toBeDefined();
    await db.insert(invitation).values({
      id: this.invitationId,
      organizationId: host!.id,
      email: this.actors.A.email,
      role: "admin",
      status: "pending",
      expiresAt: new Date(Date.now() + 3_600_000),
      inviterId: this.actors.H.id,
    });
  }

  async actorContext(browser: Browser, actor: "H" | "A" | "X", baseURL: string) {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    this.contexts.push(context);
    // API authentication does not send mail or submit any browser form with a synthetic address.
    const response = await context.request.post("/api/auth/sign-in/email", {
      data: {
        email: this.actors[actor].email,
        password: this.actors[actor].password,
      },
    });
    expect(response.ok(), `${actor} setup sign-in failed`).toBe(true);
    return context;
  }

  async teardown() {
    await Promise.all(this.contexts.map((context) => context.close()));
    // Project-owned assignments cascade with Projects; remove child records first.
    const [host] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, this.organizationName));
    if (host) {
      await db
        .delete(projectsTable)
        .where(eq(projectsTable.organizationId, host.id));
      await db.delete(invitation).where(eq(invitation.id, this.invitationId));
      await db.delete(member).where(eq(member.organizationId, host.id));
      await db.delete(organization).where(eq(organization.id, host.id));
    }
    for (const actor of Object.values(this.actors)) {
      await db.delete(session).where(eq(session.userId, actor.id));
      await db.delete(user).where(eq(user.id, actor.id));
    }
    if (this.baseline) expect(await this.counts()).toEqual(this.baseline);
  }
}
