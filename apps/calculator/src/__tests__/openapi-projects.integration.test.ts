// @vitest-environment node
/** REST contract coverage with live migrated DB rows and fixture authentication. */
import { db } from "@greendex/database";
import { organization, projectsTable } from "@greendex/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

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
          name: "Seed Owner",
          email: "owner@sieh.org",
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
        name: "Seed Organization",
        members: [{ userId: fixture.userId, role: "owner" }],
      }),
      listMembers: async () => ({ members: [] }),
    },
  },
}));

import * as routes from "@/app/api/openapi/[[...rest]]/route";

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Authentication resolves the seeded
 * Hosting Organization and Owner; case Projects below are persistence
 * scaffolding for the REST read/update/delete contract — creation through
 * REST is pinned as unsupported for date inputs (see the date-string test),
 * so direct inserts stand in and are removed afterwards. Canonical seed
 * rows are never deleted.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_OWNER_EMAIL = "owner@sieh.org";

/** Case Project ids created below; removed after each case. */
const caseProjectIds: string[] = [];

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
  const [created] = await db
    .insert(projectsTable)
    .values({
      name: "REST Contract Project",
      startDate: new Date(dates.startDate),
      endDate: new Date(dates.endDate),
      location: "Berlin",
      country: "DE",
      organizationId: fixture.organizationId,
    })
    .returning({ id: projectsTable.id });
  caseProjectIds.push(created.id);
  return created.id;
}

beforeAll(async () => {
  const seedOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_ORG_SLUG),
  });
  if (!seedOrg) throw new Error("Canonical seed Organization is missing");
  const owner = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_OWNER_EMAIL),
  });
  if (!owner) throw new Error("Canonical seed Owner is missing");
  fixture.userId = owner.id;
  fixture.organizationId = seedOrg.id;
  const { randomUUID } = await import("node:crypto");
  fixture.sessionId = randomUUID();
  fixture.permitted = true;
});
afterEach(async () => {
  const ids = caseProjectIds.splice(0);
  if (ids.length) {
    await db.delete(projectsTable).where(inArray(projectsTable.id, ids));
  }
  fixture.permitted = true;
  // Canonical actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
});

it("serves organization details, role, stats and member search shapes", async () => {
  expect(await ok("/organizations/active")).toMatchObject({
    id: fixture.organizationId,
  });
  expect(await ok("/organizations/role")).toBe("owner");
  // The seeded Hosting Organization carries the canonical Projects,
  // Participations, and Shared Travel Legs; the contract pins shapes and
  // baseline presence, not an empty Organization.
  const stats = await ok("/organizations/stats", "POST", {
    organizationId: fixture.organizationId,
  });
  expect(stats).toEqual({
    totalProjects: expect.any(Number),
    totalParticipants: expect.any(Number),
    totalSharedTravelLegs: expect.any(Number),
  });
  expect(stats.totalProjects).toBeGreaterThanOrEqual(10);
  expect(
    await ok("/organizations/members/search", "POST", {
      organizationId: fixture.organizationId,
      filters: { roles: ["owner"] },
    }),
  ).toEqual({ members: [], total: 0 });
});

it("round-trips date-free Project and Shared Travel Leg REST operations", async () => {
  const baseline = await ok("/projects?sort_by=name");
  const baselineIds = new Set(
    (baseline as { id: string }[]).map((project) => project.id),
  );
  const id = await seedProject();
  const path = `/projects/${id}`;
  expect(await ok("/projects?sort_by=name")).toEqual(
    expect.arrayContaining([expect.objectContaining({ id, ...dates })]),
  );
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
  const remaining = await ok("/projects");
  const remainingIds = new Set(
    (remaining as { id: string }[]).map((project) => project.id),
  );
  expect(remainingIds).toEqual(baselineIds);
  expect(
    await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, id),
        eq(projectsTable.organizationId, fixture.organizationId),
      ),
    }),
    "canonical seed rows must not absorb case Project ids",
  ).toBeUndefined();
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
