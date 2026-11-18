// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  projectsTable,
  session,
  user,
  hostProjectAssignmentsTable,
  projectPartnerOrganizationsTable,
  partnerCoordinatorAssignmentsTable,
  costTrackerProjectArchiveEventsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ emailSender: {} }));

import {
  archiveProject,
  reopenProject,
} from "@/features/projects/procedures/archive";
import { auth } from "@/lib/auth";

const organizationId = randomUUID();
const projectId = randomUUID();
const password = randomUUID();
const actors = [
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.OrganizationOwner,
    assigned: false,
    archive: true,
    reopen: true,
  },
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.OrganizationAdmin,
    assigned: false,
    archive: true,
    reopen: true,
  },
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: true,
    archive: true,
    reopen: false,
  },
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: false,
    archive: false,
    reopen: false,
  },
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.Participant,
    assigned: true,
    archive: false,
    reopen: false,
  },
  {
    id: randomUUID(),
    role: "participant,coordinator",
    assigned: true,
    archive: true,
    reopen: false,
  },
  {
    id: randomUUID(),
    role: "participant,admin",
    assigned: false,
    archive: true,
    reopen: true,
  },
  {
    id: randomUUID(),
    role: "owner,coordinator",
    assigned: false,
    archive: true,
    reopen: true,
  },
  {
    id: randomUUID(),
    role: "unknown",
    assigned: true,
    archive: false,
    reopen: false,
  },
];
const foreignOrganizationId = randomUUID();
const otherProjectId = randomUUID();
const email = (id: string) => `${id}@example.invalid`;

beforeAll(async () => {
  await db.insert(organization).values({
    id: organizationId,
    name: "Reopen permission test",
    slug: `reopen-${organizationId}`,
    country: "DE",
    createdAt: new Date(),
  });
  await db.insert(organization).values({
    id: foreignOrganizationId,
    name: "Other lifecycle organization",
    slug: `other-${foreignOrganizationId}`,
    country: "DE",
    createdAt: new Date(),
  });
  await db.insert(user).values(
    actors.map(({ id }) => ({
      id,
      name: "Test user",
      email: email(id),
      emailVerified: true,
    })),
  );
  const hashed = await hashPassword(password);
  await db.insert(account).values(
    actors.map(({ id }) => ({
      id: randomUUID(),
      accountId: id,
      userId: id,
      providerId: "credential",
      password: hashed,
    })),
  );
  await db.insert(member).values(
    actors.map(({ id, role }) => ({
      id: randomUUID(),
      userId: id,
      organizationId,
      role,
      createdAt: new Date(),
    })),
  );
  await db.insert(projectsTable).values({
    id: projectId,
    organizationId,
    name: "Reopen test",
    location: "Berlin",
    country: "DE",
    startDate: new Date(),
    endDate: new Date(),
  });
  await db.insert(projectsTable).values({
    id: otherProjectId,
    organizationId,
    name: "Other assignment",
    country: "DE",
    location: "Berlin",
    startDate: new Date(),
    endDate: new Date(),
  });
  await db
    .insert(hostProjectAssignmentsTable)
    .values(
      actors
        .filter(({ assigned }) => assigned)
        .map(({ id }) => ({ projectId, userId: id })),
    );
});

afterAll(async () => {
  const ids = actors.map(({ id }) => id);
  await db
    .delete(projectsTable)
    .where(inArray(projectsTable.id, [projectId, otherProjectId]));
  await db.delete(session).where(inArray(session.userId, ids));
  await db.delete(member).where(eq(member.organizationId, organizationId));
  await db.delete(account).where(inArray(account.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(organization).where(eq(organization.id, foreignOrganizationId));
});

describe("Project reopen permission through Better Auth", () => {
  it.each([actors[3]!, actors[4]!])(
    "does not disclose Project existence to $role without scope",
    async ({ id, role }) => {
      const response = await auth.api.signInEmail({
        body: { email: email(id), password },
        asResponse: true,
      });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Sign-in did not return a session cookie");
      const headers = new Headers({ cookie });
      await auth.api.setActiveOrganization({ headers, body: { organizationId } });
      const client = createRouterClient(
        { archiveProject, reopenProject },
        { context: async () => ({ headers }) },
      );
      for (const target of [projectId, randomUUID()]) {
        await expect(
          client.archiveProject({ projectId: target }),
        ).rejects.toMatchObject({
          code: "FORBIDDEN",
          data: {
            reason:
              role === "coordinator"
                ? "HOST_COORDINATION_REQUIRED"
                : "ACCESS_DENIED",
          },
        });
        await expect(
          client.reopenProject({ projectId: target, reason: "Test" }),
        ).rejects.toMatchObject({
          code: "FORBIDDEN",
          data: { reason: "ACCESS_DENIED" },
        });
      }
    },
  );

  it.each(actors)(
    "checks $role assigned=$assigned through native grants and both commands",
    async ({ id, role, archive, reopen }) => {
      const response = await auth.api.signInEmail({
        body: { email: email(id), password },
        asResponse: true,
      });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Sign-in did not return a session cookie");
      const headers = new Headers({ cookie });
      await auth.api.setActiveOrganization({ headers, body: { organizationId } });
      const client = createRouterClient(
        { archiveProject, reopenProject },
        { context: async () => ({ headers }) },
      );
      for (const action of ["archive", "reopen"] as const) {
        const allowed = action === "archive" ? archive : reopen;
        const grant = role
          .split(",")
          .some(
            (r) =>
              r === "owner" ||
              r === "admin" ||
              (r === "coordinator" && action === "archive"),
          );
        expect(
          await auth.api.hasPermission({
            headers,
            body: { permissions: { costTrackerProjectLifecycle: [action] } },
          }),
        ).toMatchObject({ success: grant });
        expect(
          await auth.api.hasPermission({
            headers,
            body: { permissions: { calculatorProjectLifecycle: [action] } },
          }),
        ).toMatchObject({ success: false });
        await db
          .update(projectsTable)
          .set({ archived: true, costTrackerArchived: action === "reopen" })
          .where(eq(projectsTable.id, projectId));
        const beforeEvents = await db
          .select()
          .from(costTrackerProjectArchiveEventsTable)
          .where(eq(costTrackerProjectArchiveEventsTable.projectId, projectId));
        const request =
          action === "archive"
            ? client.archiveProject({ projectId })
            : client.reopenProject({
                projectId,
                reason: "Correct administration",
              });
        if (allowed) {
          expect(await request).toEqual({
            projectId,
            archived: action === "archive",
          });
          await expect(
            action === "archive"
              ? client.archiveProject({ projectId })
              : client.reopenProject({ projectId, reason: "Repeat" }),
          ).rejects.toMatchObject({ code: "CONFLICT" });
        } else await expect(request).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(
          await db.query.projectsTable.findFirst({
            where: eq(projectsTable.id, projectId),
          }),
        ).toMatchObject({
          archived: true,
          costTrackerArchived: allowed
            ? action === "archive"
            : action === "reopen",
        });
        const events = await db
          .select()
          .from(costTrackerProjectArchiveEventsTable)
          .where(eq(costTrackerProjectArchiveEventsTable.projectId, projectId));
        expect(events.length).toBe(beforeEvents.length + (allowed ? 1 : 0));
        if (allowed)
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                userId: id,
                action,
                reason: action === "reopen" ? "Correct administration" : null,
              }),
            ]),
          );
      }
    },
  );

  it("allows the owner through the real archive and reopen procedure boundary", async () => {
    const owner = actors[0]!;
    const response = await auth.api.signInEmail({
      body: { email: email(owner.id), password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not return a session cookie");
    const headers = new Headers({ cookie });
    await auth.api.setActiveOrganization({ headers, body: { organizationId } });
    const client = createRouterClient(
      { archiveProject, reopenProject },
      { context: async () => ({ headers }) },
    );
    await db
      .update(projectsTable)
      .set({ costTrackerArchived: false })
      .where(eq(projectsTable.id, projectId));
    expect(await client.archiveProject({ projectId })).toEqual({
      projectId,
      archived: true,
    });
    expect(
      await client.reopenProject({ projectId, reason: "Correct administration" }),
    ).toEqual({ projectId, archived: false });
  });

  it("denies Coordinator reopen without an action grant", async () => {
    const response = await auth.api.signInEmail({
      body: { email: email(actors[2]!.id), password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not return a session cookie");
    const headers = new Headers({ cookie });
    await auth.api.setActiveOrganization({ headers, body: { organizationId } });
    expect(
      await auth.api.hasPermission({
        headers,
        body: { permissions: { costTrackerProjectLifecycle: ["reopen"] } },
      }),
    ).toMatchObject({ success: false });
    const client = createRouterClient(
      { reopenProject },
      { context: async () => ({ headers }) },
    );
    await expect(
      client.reopenProject({ projectId, reason: "No reopen grant" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "ACCESS_DENIED" },
    });
  });

  it("reevaluates revoked assignments, Memberships, active Organization and Partner-only assignments", async () => {
    const actor = actors[2]!;
    const response = await auth.api.signInEmail({
      body: { email: email(actor.id), password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not return a session cookie");
    const headers = new Headers({ cookie });
    await auth.api.setActiveOrganization({ headers, body: { organizationId } });
    const client = createRouterClient(
      { archiveProject, reopenProject },
      { context: async () => ({ headers }) },
    );
    await db
      .update(projectsTable)
      .set({ costTrackerArchived: false })
      .where(eq(projectsTable.id, projectId));
    await client.archiveProject({ projectId });
    await db
      .update(projectsTable)
      .set({ costTrackerArchived: false })
      .where(eq(projectsTable.id, projectId));
    await db
      .delete(hostProjectAssignmentsTable)
      .where(
        and(
          eq(hostProjectAssignmentsTable.projectId, projectId),
          eq(hostProjectAssignmentsTable.userId, actor.id),
        ),
      );
    await db
      .insert(hostProjectAssignmentsTable)
      .values({ projectId: otherProjectId, userId: actor.id });
    await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await db
      .delete(hostProjectAssignmentsTable)
      .where(eq(hostProjectAssignmentsTable.userId, actor.id));
    const partnershipId = randomUUID();
    await db.insert(projectPartnerOrganizationsTable).values({
      id: partnershipId,
      projectId,
      organizationId: foreignOrganizationId,
    });
    await db
      .insert(partnerCoordinatorAssignmentsTable)
      .values({ partnershipId, userId: actor.id });
    expect(
      await auth.api.hasPermission({
        headers,
        body: { permissions: { costTrackerProjectLifecycle: ["archive"] } },
      }),
    ).toMatchObject({ success: true });
    await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "HOST_COORDINATION_REQUIRED" },
    });
    await db.insert(member).values({
      id: randomUUID(),
      userId: actor.id,
      organizationId: foreignOrganizationId,
      role: "owner",
      createdAt: new Date(),
    });
    await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await db
      .insert(hostProjectAssignmentsTable)
      .values({ projectId, userId: actor.id });
    await db
      .delete(member)
      .where(
        and(
          eq(member.userId, actor.id),
          eq(member.organizationId, organizationId),
        ),
      );
    await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: foreignOrganizationId },
    });
    await db
      .delete(hostProjectAssignmentsTable)
      .where(
        and(
          eq(hostProjectAssignmentsTable.projectId, projectId),
          eq(hostProjectAssignmentsTable.userId, actor.id),
        ),
      );
    for (const role of ["owner", "admin", "coordinator"]) {
      await db
        .update(member)
        .set({ role })
        .where(
          and(
            eq(member.userId, actor.id),
            eq(member.organizationId, foreignOrganizationId),
          ),
        );
      await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
        code: role === "coordinator" ? "FORBIDDEN" : "NOT_FOUND",
      });
      await expect(
        client.reopenProject({ projectId, reason: "Foreign" }),
      ).rejects.toMatchObject({
        code: role === "coordinator" ? "FORBIDDEN" : "NOT_FOUND",
      });
    }
    await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: null },
    });
    await expect(client.archiveProject({ projectId })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const anonymous = createRouterClient(
      { archiveProject, reopenProject },
      { context: async () => ({ headers: new Headers() }) },
    );
    await expect(anonymous.archiveProject({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
