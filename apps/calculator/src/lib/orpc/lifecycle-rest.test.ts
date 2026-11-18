// @vitest-environment node
import type { ProjectLifecyclePermission } from "@greendex/auth/permissions";
import { openapi } from "@orpc/openapi";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/orpc/router", async () => {
  const { rootBase } = await import("@/lib/orpc/context");
  const command = (action: ProjectLifecyclePermission) =>
    rootBase
      .meta(openapi({ method: "PATCH", path: `/projects/{id}/${action}` }))
      .input(z.object({ id: z.string() }).strict())
      .handler(({ input }) => input);
  return {
    router: {
      projects: { archive: command("archive"), reopen: command("reopen") },
    },
  };
});

import { generateOpenAPISpec } from "@/lib/orpc/openapi-generator";
import { openapiHandler } from "@/lib/orpc/openapi-handler";

describe.each(["archive", "reopen"])("REST %s body", (action) => {
  it.each([
    [undefined, 200],
    ["{}", 200],
    ["false", 400],
    ["null", 400],
    ["[]", 400],
    ['{"id":"other"}', 400],
    ['{"reason":"extra"}', 400],
  ])("validates original body %s", async (body, status) => {
    const { response } = await openapiHandler.handle(
      new Request(`http://localhost/api/openapi/projects/p1/${action}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
      }),
      { prefix: "/api/openapi", context: { headers: new Headers() } },
    );
    expect(response?.status).toBe(status);
    if (status === 200) expect(await response?.json()).toEqual({ id: "p1" });
  });

  it("documents an optional strict empty body", async () => {
    const spec = await generateOpenAPISpec({
      info: { title: "Test", version: "1" },
    });
    const operation = spec.paths?.[`/projects/{id}/${action}`]?.patch;
    expect(operation?.requestBody).toMatchObject({
      required: false,
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: false },
        },
      },
    });
  });

  it.each([
    [undefined, undefined],
    ["application/x-www-form-urlencoded", ""],
  ])("accepts omitted or empty form body", async (contentType, body) => {
    const { response } = await openapiHandler.handle(
      new Request(`http://localhost/api/openapi/projects/p1/${action}`, {
        method: "PATCH",
        headers: contentType ? { "content-type": contentType } : undefined,
        body,
      }),
      { prefix: "/api/openapi", context: { headers: new Headers() } },
    );
    expect(response?.status).toBe(200);
  });
});
