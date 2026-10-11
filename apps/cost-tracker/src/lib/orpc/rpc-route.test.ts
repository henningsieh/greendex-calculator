// @vitest-environment node
import { createORPCClient, type Client } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { afterAll, describe, expect, it, vi } from "vitest";

// Exercise the production HTTP handler with a public, header-observing procedure.
vi.mock("@/lib/orpc/router", async () => {
  const { os } = await import("@orpc/server");
  return {
    router: {
      read: os
        .$context<{ headers: Headers }>()
        .handler(({ context }) => ({ cookie: context.headers.get("cookie") })),
    },
  };
});
import * as routes from "@/app/api/rpc/[[...rest]]/route";

function client(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  headers: Record<string, string> = {},
) {
  return createORPCClient<{
    read: Client<object, undefined, { cookie: string | null }, never>;
  }>(
    new RPCLink({
      origin: "http://localhost",
      url: "/api/rpc",
      method,
      headers: { cookie: "session=one", ...headers },
      fetch: (url, init) => routes[method](new Request(url, init)),
    }),
  );
}

describe("RPC methods and GET CSRF protection", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "answers %s and forwards request headers",
    async (method) => {
      await expect(client(method).read()).resolves.toEqual({
        cookie: "session=one",
      });
    },
  );
  it("allows same-origin browser GET reads", async () => {
    await expect(
      client("GET", {
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
      }).read(),
    ).resolves.toEqual({ cookie: "session=one" });
  });
  it.each<Record<string, string>>([
    { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" },
    {
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    },
  ])("rejects unsafe browser GET reads: %j", async (headers) => {
    await expect(client("GET", headers).read()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("keeps HEAD exported but unmatched, alongside all method exports", async () => {
    for (const method of [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
    ] as const)
      expect(routes[method]).toBeTypeOf("function");
    expect(
      (
        await routes.HEAD(
          new Request("http://localhost/api/rpc/read", { method: "HEAD" }),
        )
      ).status,
    ).toBe(404);
  });
});

afterAll(() => {
  vi.doUnmock("@/lib/orpc/router");
  vi.resetModules();
});
