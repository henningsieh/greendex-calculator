// @vitest-environment node

import { randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  organization,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Router } from "@/lib/orpc/router";

import { assertExistingHttpTarget } from "../../../../scripts/existing-integration-environment";

const baseURL = process.env.COST_TRACKER_TEST_BASE_URL ?? "";
const suffix = randomUUID();
let host = "";
let other = "";
const actorEmails = [
  SEED_USER.email,
  "seed-participant@example.org",
  "seed-cost-tracker-partner-owner@example.org",
];
const password = SEED_USER.password;
const sessionIds: string[] = [];
const cookies: string[] = [];
const projectIds: string[] = [];

function fetchWithTimeout(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

async function post(path: string, body: unknown, cookie?: string) {
  return fetchWithTimeout(`${baseURL}/api/openapi/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseURL,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function expectError(
  response: Response,
  status: number,
  code: string,
  reason?: string,
) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body).toMatchObject({ code, ...(reason ? { data: { reason } } : {}) });
  expect(body).not.toHaveProperty("status");
  expect(body).not.toHaveProperty("stack");
}

const projectInput = {
  name: `HTTP Project ${suffix}`,
  startDate: "2026-10-01T00:00:00.000Z",
  endDate: "2026-10-03T00:00:00.000Z",
  location: "Berlin",
  country: "DE",
};

describe("Cost Tracker OpenAPI over real HTTP", () => {
  beforeAll(async () => {
    assertExistingHttpTarget(process.env);
    const seededHost = await db.query.organization.findFirst({
      where: eq(organization.slug, "seed-org"),
    });
    const seededOther = await db.query.organization.findFirst({
      where: eq(organization.slug, "seed-partner-org"),
    });
    if (!seededHost || !seededOther)
      throw new Error("Required existing seed Organizations are missing.");
    host = seededHost.id;
    other = seededOther.id;
    await fetchWithTimeout(`${baseURL}/api/docs`, {
      signal: AbortSignal.timeout(5000),
    });
    for (const [index, email] of actorEmails.entries()) {
      const actor = await db.query.user.findFirst({
        where: eq(user.email, email),
      });
      if (!actor) throw new Error("Canonical HTTP actor missing.");
      const response = await post("authentication/signIn", { email, password });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).toContain("session_token=");
      cookies.push(cookie);
      const identityResponse = await fetchWithTimeout(`${baseURL}/api/auth/get-session`, {
        headers: { cookie, origin: baseURL },
      });
      expect(identityResponse.status).toBe(200);
      const identity = await identityResponse.json();
      const observed = await db.query.session.findFirst({
        where: eq(session.id, identity.session.id),
      });
      expect(Boolean(observed && observed.userId === actor.id && identity.user.id === actor.id)).toBe(true);
      if (!observed) throw new Error("HTTP application database consistency could not be established.");
      sessionIds.push(observed.id);
      const selected = await fetchWithTimeout(
        `${baseURL}/api/auth/organization/set-active`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: baseURL,
            cookie,
          },
          body: JSON.stringify({ organizationId: index === 2 ? other : host }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      expect(selected.status).toBe(200);
    }
  }, 30000);

  afterAll(async () => {
    let cleanupFailed = false;
    for (const cookie of cookies) {
      try {
        const response = await fetchWithTimeout(`${baseURL}/api/auth/sign-out`, {
          method: "POST", headers: { cookie, origin: baseURL, "content-type": "application/json" },
          body: "{}",
        });
        if (!response.ok) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    try {
      if (projectIds.length)
        await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
    } finally {
      if (sessionIds.length)
        await db.delete(session).where(inArray(session.id, sessionIds));
    }
    if (cleanupFailed) throw new Error("HTTP fixture session cleanup failed.");
  }, 45_000);

  it("gates both explicit docs paths as unmatched and serves pinned Scalar and the newest spec to sessions", async () => {
    for (const path of ["/api/docs", "/api/openapi-spec"]) {
      expect((await fetchWithTimeout(`${baseURL}${path}`)).status).toBe(404);
      expect(
        (
          await fetchWithTimeout(`${baseURL}${path}`, {
            headers: { cookie: "better-auth.session_token=invalid" },
          })
        ).status,
      ).toBe(404);
    }
    const docs = await fetchWithTimeout(`${baseURL}/api/docs`, {
      headers: { cookie: cookies[0]! },
    });
    expect(docs.status).toBe(200);
    const html = await docs.text();
    expect(html).toContain(
      "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.0/dist/browser/standalone.js",
    );
    // The v2 plugin embeds the generated spec rather than fetching specPath in the viewer.
    expect(html).toContain("Cost Tracker API");
    expect(html).not.toContain("@latest");
    const response = await fetchWithTimeout(`${baseURL}/api/openapi-spec`, {
      headers: { cookie: cookies[0]! },
    });
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.2.0");
    expect(spec.servers).toEqual([{ url: `${baseURL}/api/openapi` }]);
    expect(new URL(spec.servers[0].url).origin).toBe(new URL(baseURL).origin);
    expect(spec.paths["/projects/create"].post.requestBody).toBeDefined();
    expect(
      spec.paths["/organizations/updateCountry"].post.responses["403"],
    ).toBeDefined();
    expect(spec.paths["/authentication/signIn"].post).toBeDefined();
  });

  it("preserves authentication and safe credential errors", async () => {
    await expectError(
      await post("organizations/getSettings", {}),
      401,
      "UNAUTHORIZED",
      "SESSION_REQUIRED",
    );
    await expectError(
      await post("authentication/signIn", {
        email: actorEmails[0],
        password: "incorrect-password",
      }),
      401,
      "UNAUTHORIZED",
      "INVALID_CREDENTIALS",
    );
  });

  it("preserves permissions and the active tenant", async () => {
    const response = await post("organizations/getSettings", {}, cookies[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: host, country: "DE" });
    await expectError(
      await post("organizations/updateCountry", { country: "FR" }, cookies[1]),
      403,
      "FORBIDDEN",
    );
    const outsider = await post("organizations/getSettings", {}, cookies[2]);
    expect(outsider.status).toBe(200);
    expect(await outsider.json()).toMatchObject({ id: other, country: "FR" });
    expect(
      (
        await db.query.organization.findFirst({
          where: eq(organization.id, host),
        })
      )?.country,
    ).toBe("DE");
  });

  it("coerces ISO dates on create and list but retains domain validation and tenant isolation", async () => {
    const created = await post("projects/create", projectInput, cookies[0]);
    expect(created.status).toBe(200);
    const { id } = await created.json();
    projectIds.push(id);
    expect(Boolean(await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, id),
    }))).toBe(true);
    const listing = await post(
      "projects/listHosted",
      {
        pageSize: 25,
        dateFrom: projectInput.startDate,
        dateTo: projectInput.endDate,
      },
      cookies[0],
    );
    expect(listing.status).toBe(200);
    expect((await listing.json()).rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, startDate: projectInput.startDate }),
      ]),
    );
    const outsider = await post(
      "projects/listHosted",
      { pageSize: 25 },
      cookies[2],
    );
    expect(outsider.status).toBe(200);
    expect((await outsider.json()).rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id })]),
    );
    await expectError(
      await post("projects/get", { projectId: id }, cookies[2]),
      404,
      "NOT_FOUND",
      "PROJECT_NOT_FOUND",
    );
    await expectError(
      await post(
        "projects/create",
        { ...projectInput, startDate: "not-a-date" },
        cookies[0],
      ),
      400,
      "BAD_REQUEST",
    );
    await expectError(
      await post(
        "projects/create",
        { ...projectInput, endDate: "2026-09-01T00:00:00.000Z" },
        cookies[0],
      ),
      400,
      "BAD_REQUEST",
    );
    await expectError(
      await post(
        "projects/listHosted",
        { pageSize: 25, dateFrom: "not-a-date" },
        cookies[0],
      ),
      400,
      "BAD_REQUEST",
    );
  });

  it("keeps the RPC wire transport's session, permissions and error contract unchanged", async () => {
    const rpc = (cookie?: string): RouterClient<Router> =>
      createORPCClient(
        new RPCLink({
          origin: baseURL,
          url: "/api/rpc",
          fetch: fetchWithTimeout,
          headers: { ...(cookie ? { cookie } : {}), origin: baseURL },
        }),
      );
    await expect(rpc().organizations.getSettings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      data: { reason: "SESSION_REQUIRED" },
    });
    await expect(
      rpc(cookies[0]).organizations.getSettings(),
    ).resolves.toMatchObject({ id: host });
    await expect(
      rpc(cookies[1]).organizations.updateCountry({ country: "FR" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      rpc(cookies[2]).organizations.getSettings(),
    ).resolves.toMatchObject({ id: other });
  });

  it("rejects invalid JSON and schema inputs without exposing internal errors", async () => {
    await expectError(
      await post("organizations/updateCountry", { country: "XX" }, cookies[0]),
      400,
      "BAD_REQUEST",
    );
    const response = await fetchWithTimeout(
      `${baseURL}/api/openapi/projects/create`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookies[0]! },
        body: "{",
      },
    );
    await expectError(response, 400, "BAD_REQUEST");
    expect((await post("does-not-exist", {}, cookies[0])).status).toBe(404);
  });
});
