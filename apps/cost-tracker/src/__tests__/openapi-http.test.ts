// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { env } from "@/env";
import type { Router } from "@/lib/orpc/router";

const baseURL = env.NEXT_PUBLIC_BASE_URL;
const suffix = randomUUID();
const host = `http-host-${suffix}`;
const other = `http-other-${suffix}`;
const actors = ["owner", "participant", "outsider"].map(
  (role) => `http-${role}-${suffix}`,
);
const password = `Http-test-${suffix}!`;
const cookies: string[] = [];
const projectIds: string[] = [];

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${baseURL}/api/openapi/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseURL,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
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
    // A running server must use this same .env and database; never mock the transport or auth.
    try {
      await fetch(`${baseURL}/api/docs`, { signal: AbortSignal.timeout(5000) });
    } catch (cause) {
      throw new Error(
        `Start Cost Tracker at ${baseURL} before test:run (see docs/openapi.md).`,
        { cause },
      );
    }
    const now = new Date();
    await db.insert(organization).values(
      [host, other].map((id) => ({
        id,
        slug: id,
        name: id,
        country: "DE" as const,
        createdAt: now,
      })),
    );
    const hashed = await hashPassword(password);
    for (const [index, id] of actors.entries()) {
      await db.insert(user).values({
        id,
        name: "HTTP fixture",
        email: `${id}@example.org`,
        emailVerified: true,
      });
      await db.insert(account).values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: hashed,
      });
      await db.insert(member).values({
        id: randomUUID(),
        userId: id,
        organizationId: index === 2 ? other : host,
        role:
          index === 1
            ? ORGANIZATION_ROLES.Participant
            : ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      });
      const response = await post("authentication/signIn", {
        email: `${id}@example.org`,
        password,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).toContain("session_token=");
      cookies.push(cookie);
    }
  }, 30000);

  afterAll(async () => {
    if (projectIds.length)
      await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
    await db.delete(user).where(inArray(user.id, actors));
    await db.delete(organization).where(inArray(organization.id, [host, other]));
  });

  it("gates both explicit docs paths as unmatched and serves pinned Scalar and the newest spec to sessions", async () => {
    for (const path of ["/api/docs", "/api/openapi-spec"]) {
      expect((await fetch(`${baseURL}${path}`)).status).toBe(404);
      expect(
        (
          await fetch(`${baseURL}${path}`, {
            headers: { cookie: "better-auth.session_token=invalid" },
          })
        ).status,
      ).toBe(404);
    }
    const docs = await fetch(`${baseURL}/api/docs`, {
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
    const response = await fetch(`${baseURL}/api/openapi-spec`, {
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
        email: `${actors[0]}@example.org`,
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
    expect(await outsider.json()).toMatchObject({ id: other, country: "DE" });
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
    const response = await fetch(`${baseURL}/api/openapi/projects/create`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies[0]! },
      body: "{",
    });
    await expectError(response, 400, "BAD_REQUEST");
    expect((await post("does-not-exist", {}, cookies[0])).status).toBe(404);
  });
});
