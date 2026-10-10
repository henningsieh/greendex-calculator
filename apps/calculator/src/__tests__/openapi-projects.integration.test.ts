// @vitest-environment node
/** REST contract coverage with live migrated DB rows and fixture authentication. */
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  vi.resetModules();
  return { userId: "", organizationId: "", sessionId: "", permitted: true };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: {
          id: fixture.userId,
          name: "REST Contract User",
          email: "rest@example.com",
        },
        session: {
          id: fixture.sessionId,
          activeOrganizationId: fixture.organizationId,
        },
      }),
      hasPermission: async () => ({ success: fixture.permitted }),
      getActiveMemberRole: async () => ({ role: "owner" }),
      getFullOrganization: async () => ({
        id: fixture.organizationId,
        name: "REST Contract Organization",
        members: [{ userId: fixture.userId, role: "owner" }],
      }),
      listMembers: async () => ({ members: [] }),
    },
  },
}));

import * as routes from "@/app/api/openapi/[[...rest]]/route";

async function request(path: string, method = "GET", body?: unknown) {
  return routes[method as keyof typeof routes](
    new Request(`http://localhost/api/openapi${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function ok(path: string, method = "GET", body?: unknown) {
  const response = await request(path, method, body);
  expect(response.status, `${method} ${path}: ${response.status}`).toBe(200);
  return response.json();
}
const dates = {
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-12-31T00:00:00.000Z",
};
async function seedProject() {
  const id = randomUUID();
  await db.insert(projectsTable).values({
    id,
    name: "REST Contract Project",
    startDate: new Date(dates.startDate),
    endDate: new Date(dates.endDate),
    location: "Berlin",
    country: "DE",
    organizationId: fixture.organizationId,
  });
  return id;
}

beforeEach(async () => {
  fixture.userId = randomUUID();
  fixture.organizationId = randomUUID();
  fixture.sessionId = randomUUID();
  fixture.permitted = true;
  await db.insert(user).values({
    id: fixture.userId,
    name: "REST Contract User",
    email: `rest-${fixture.userId}@example.com`,
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: fixture.organizationId,
    name: "REST Contract Organization",
    slug: `rest-${fixture.organizationId}`,
    createdAt: new Date(),
    country: "DE",
  });
  await db.insert(session).values({
    id: fixture.sessionId,
    userId: fixture.userId,
    token: randomUUID(),
    expiresAt: new Date("2030-01-01"),
    activeOrganizationId: fixture.organizationId,
  });
});
afterEach(async () => {
  await db
    .delete(projectsTable)
    .where(eq(projectsTable.organizationId, fixture.organizationId));
  await db.delete(session).where(eq(session.id, fixture.sessionId));
  await db
    .delete(organization)
    .where(eq(organization.id, fixture.organizationId));
  await db.delete(user).where(eq(user.id, fixture.userId));
});
afterAll(() => {
  vi.doUnmock("@/lib/better-auth");
  vi.doUnmock("next/headers");
  vi.resetModules();
});

it("serves organization details, role, stats and member search shapes", async () => {
  expect(await ok("/organizations/active")).toMatchObject({
    id: fixture.organizationId,
  });
  expect(await ok("/organizations/role")).toBe("owner");
  expect(
    await ok("/organizations/stats", "POST", {
      organizationId: fixture.organizationId,
    }),
  ).toEqual({ totalProjects: 0, totalParticipants: 0, totalSharedTravelLegs: 0 });
  expect(
    await ok("/organizations/members/search", "POST", {
      organizationId: fixture.organizationId,
      filters: { roles: ["owner"] },
    }),
  ).toEqual({ members: [], total: 0 });
});

it("round-trips date-free Project and Shared Travel Leg REST operations", async () => {
  const id = await seedProject();
  const path = `/projects/${id}`;
  expect(await ok("/projects?sort_by=name")).toEqual([
    expect.objectContaining({ id, ...dates }),
  ]);
  expect(await ok(path)).toMatchObject({
    id,
    organization: { id: fixture.organizationId },
  });
  expect(await ok(`${path}/participants`)).toEqual([]);
  expect(await ok(`${path}/participate`)).toMatchObject({
    id,
    name: "REST Contract Project",
  });
  expect(await ok("/projects/active", "POST", { projectId: id })).toEqual({
    success: true,
  });

  const legs = `${path}/shared-travel-legs`;
  const created = await ok(legs, "POST", {
    transportEmissionProfile: "train",
    distanceKm: 80,
  });
  expect(created).toMatchObject({
    success: true,
    sharedTravelLeg: {
      id: expect.any(String),
      projectId: id,
      transportEmissionProfile: "train",
      distanceKm: 80,
    },
  });
  expect(await ok(legs)).toEqual([
    expect.objectContaining({ id: created.sharedTravelLeg.id, projectId: id }),
  ]);
  expect(
    await ok(`${legs}/${created.sharedTravelLeg.id}`, "PATCH", {
      data: { transportEmissionProfile: "bus", distanceKm: 81.2 },
    }),
  ).toMatchObject({
    success: true,
    sharedTravelLeg: { distanceKm: 81.2, transportEmissionProfile: "bus" },
  });
  expect(await ok(`${legs}/${created.sharedTravelLeg.id}`, "DELETE", {})).toEqual(
    { success: true },
  );
  expect(await ok(legs)).toEqual([]);

  expect(await ok(`${path}/archive`, "PATCH", { archived: true })).toMatchObject({
    success: true,
    project: { id, archived: true },
  });
  expect(await ok(path, "DELETE", {})).toEqual({ success: true });
  const second = await seedProject();
  expect(await ok("/projects/batch", "DELETE", { projectIds: [second] })).toEqual(
    { success: true, deletedCount: 1 },
  );
  expect(await ok("/projects")).toEqual([]);
});

it.each([
  ["GET", "/projects?sort_by=invalid", undefined],
  // Like Date inputs, query booleans currently have no REST smart coercion.
  ["GET", "/projects?archived=false", undefined],
  ["GET", "/projects?archived=true", undefined],
  ["POST", "/projects", {}],
  ["PATCH", "/projects/missing", { data: {} }],
  ["PATCH", "/projects/missing/archive", { archived: "yes" }],
  ["DELETE", "/projects/batch", { projectIds: [] }],
  ["POST", "/projects/active", { projectId: 42 }],
  ["POST", "/organizations/stats", {}],
  [
    "POST",
    "/organizations/members/search",
    { organizationId: "fixture", filters: { roles: ["unknown"] } },
  ],
  [
    "POST",
    "/projects/missing/shared-travel-legs",
    { transportEmissionProfile: "plane", distanceKm: 0 },
  ],
  [
    "PATCH",
    "/projects/missing/shared-travel-legs/leg",
    { data: { distanceKm: -1 } },
  ],
])("validates the documented input for %s %s", async (method, path, body) => {
  const response = await request(path as string, method as string, body);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "BAD_REQUEST",
    message: "Input validation failed",
  });
});

it.each([
  ["GET", "/projects/missing", undefined, 404],
  ["DELETE", "/projects/missing", {}, 404],
  ["PATCH", "/projects/missing/archive", { archived: true }, 404],
  ["POST", "/projects/active", { projectId: "missing" }, 404],
  ["DELETE", "/projects/batch", { projectIds: ["missing"] }, 403],
  ["GET", "/projects/missing/participants", undefined, 403],
  ["GET", "/projects/missing/shared-travel-legs", undefined, 403],
  [
    "POST",
    "/projects/missing/shared-travel-legs",
    { transportEmissionProfile: "train", distanceKm: 80 },
    403,
  ],
  [
    "PATCH",
    "/projects/missing/shared-travel-legs/leg",
    { data: { distanceKm: 80 } },
    404,
  ],
  ["DELETE", "/projects/missing/shared-travel-legs/leg", {}, 404],
])(
  "keeps missing-resource status for %s %s",
  async (method, path, body, status) => {
    const response = await request(path as string, method as string, body);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      code: status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      message: expect.any(String),
    });
  },
);

it("rejects authenticated callers without Project permissions before exposing data", async () => {
  fixture.permitted = false;
  const response = await request("/projects");
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    code: "FORBIDDEN",
    message: "Missing required permissions: read",
  });
});

// Pre-existing spec/handler limitation: date-time strings are documented, but
// these Date schemas have no REST smart coercion. Do not silently change transport behavior.
it.each([
  [
    "POST",
    "/projects",
    {
      name: "Date Contract",
      ...dates,
      location: "Berlin",
      country: "DE",
      organizationId: "fixture",
    },
  ],
  ["PATCH", "/projects/missing", { data: { name: "Date Contract", ...dates } }],
  [
    "POST",
    "/projects/missing/shared-travel-legs",
    {
      transportEmissionProfile: "train",
      distanceKm: 80,
      travelDate: dates.startDate,
    },
  ],
  [
    "PATCH",
    "/projects/missing/shared-travel-legs/leg",
    { data: { travelDate: dates.startDate } },
  ],
])(
  "pins the existing date-string rejection for %s %s",
  async (method, path, body) => {
    const response = await request(path as string, method as string, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
  },
);
