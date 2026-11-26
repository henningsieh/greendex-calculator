import { createServer } from "node:http";

import { describe, expect, it, vi } from "vitest";

import { createCostTrackerSessionValidator } from "./session-validator";

const origin = "http://localhost:3002";

describe("Cost Tracker session validator", () => {
  it("forwards the cookie and returns the session user", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ user: { id: "user-1" }, session: { id: "session" } }),
          { status: 200 },
        ),
      );
    const validate = createCostTrackerSessionValidator(origin, fetchImpl);

    await expect(validate("better-auth.session_token=abc")).resolves.toEqual({
      userId: "user-1",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("/api/auth/get-session", origin),
      expect.objectContaining({
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );
  });

  it("refuses missing, rejected, malformed, and failed session checks", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("null", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: {} })))
      .mockRejectedValueOnce(new Error("network down"));
    const validate = createCostTrackerSessionValidator(origin, fetchImpl);

    await expect(validate(undefined)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(validate("cookie")).resolves.toBeNull();
    await expect(validate("cookie")).resolves.toBeNull();
    await expect(validate("cookie")).resolves.toBeNull();
    await expect(validate("cookie")).resolves.toBeNull();
  });

  it("validates against a real HTTP session endpoint", async () => {
    const authServer = createServer((request, response) => {
      const authorized =
        request.url === "/api/auth/get-session" &&
        request.headers.cookie === "session=valid";
      response.writeHead(authorized ? 200 : 401, {
        "content-type": "application/json",
      });
      response.end(
        authorized ? JSON.stringify({ user: { id: "user-http" } }) : "null",
      );
    });
    await new Promise<void>((resolve) =>
      authServer.listen(0, "127.0.0.1", resolve),
    );
    const address = authServer.address();
    if (!address || typeof address === "string") throw new Error("no port");
    try {
      const validate = createCostTrackerSessionValidator(
        `http://127.0.0.1:${address.port}`,
      );
      await expect(validate("session=valid")).resolves.toEqual({
        userId: "user-http",
      });
      await expect(validate("session=invalid")).resolves.toBeNull();
    } finally {
      await new Promise<void>((resolve) => authServer.close(() => resolve()));
    }
  });
});
