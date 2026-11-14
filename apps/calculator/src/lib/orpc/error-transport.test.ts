// @vitest-environment node
import { openapi } from "@orpc/openapi";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.hoisted(() => vi.resetModules());
beforeAll(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterAll(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("@/lib/orpc/router");
});

vi.mock("@/lib/orpc/router", async () => {
  const { rootBase } = await import("@/lib/orpc/context");
  return {
    router: Object.fromEntries(
      Object.keys(rootBase["~orpc"].errorMap).map((code) => [
        code,
        rootBase
          .meta(openapi({ method: "GET", path: `/${code}` }))
          .handler(({ errors }) => {
            throw errors[code as keyof typeof errors]!();
          }),
      ]),
    ),
  };
});
import { POST } from "@/app/api/rpc/[[...rest]]/route";
import { ERROR_CODES } from "@/lib/orpc/context";
import { openapiHandler } from "@/lib/orpc/openapi-handler";

const previousStatuses = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};
it.each(ERROR_CODES)(
  "preserves %s status on RPC and REST without body status",
  async (code) => {
    const rpc = await POST(
      new Request(`http://localhost/api/rpc/${code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"json":null}',
      }),
    );
    const { response: rest } = await openapiHandler.handle(
      new Request(`http://localhost/api/openapi/${code}`),
      { prefix: "/api/openapi", context: { headers: new Headers() } },
    );
    expect(rpc.status).toBe(previousStatuses[code]);
    expect(rest?.status).toBe(previousStatuses[code]);
    const body = await rest!.json();
    expect(body).toMatchObject({ code });
    expect(body).not.toHaveProperty("status");
    const rpcBody = await rpc.json();
    expect(rpcBody.json).not.toHaveProperty("status");
  },
);
it("restricts credentialed REST origins to the allowlist on failure and preflight", async () => {
  // #371: the closed allowlist (own origin plus www alias) replaces the
  // previous reflection. Anything off-list gets no ACAO header, so the
  // static credentials flag stays inert. Same-origin requests
  // (http://localhost:3000 in this environment) keep working.
  for (const method of ["GET", "OPTIONS"]) {
    const handle = (origin: string) =>
      openapiHandler.handle(
        new Request("http://localhost/api/openapi/BAD_REQUEST", {
          method,
          headers: {
            origin,
            "access-control-request-method": "GET",
          },
        }),
        { prefix: "/api/openapi", context: { headers: new Headers() } },
      );
    const { response: denied } = await handle("https://consumer.example");
    expect(denied?.headers.get("access-control-allow-origin")).toBeNull();
    expect(denied?.headers.get("access-control-allow-credentials")).toBe("true");
    expect(denied?.headers.get("vary")).toMatch(/origin/i);
    const { response: allowed } = await handle("http://localhost:3000");
    expect(allowed?.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(allowed?.headers.get("access-control-allow-credentials")).toBe("true");
  }
});
