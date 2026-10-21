import { afterEach, expect, it, vi } from "vitest";

import { HttpSession } from "./verify-email-workflows";

function stubFetch(statuses: number[]): void {
  const queue = [...statuses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const status = queue.shift() ?? 200;
      return new Response("{}", {
        status,
        headers: status === 429 ? { "retry-after": "1" } : {},
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("retries a rate-limited workflow request and returns the follow-up response", async () => {
  stubFetch([429, 200]);
  const session = new HttpSession("http://localhost:3002");
  const response = await session.request("/api/auth/sign-in/email", {
    email: "retry-probe@example.org",
    password: "WrongPass123!",
  });
  expect(response.status).toBe(200);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
});

it("returns non-rate-limited failures without retrying", async () => {
  stubFetch([401]);
  const session = new HttpSession("http://localhost:3002");
  const response = await session.request("/api/auth/sign-in/email", {
    email: "retry-probe@example.org",
    password: "WrongPass123!",
  });
  expect(response.status).toBe(401);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

it("bounds rate-limit retries and surfaces a persistent 429", async () => {
  stubFetch([429, 429, 429, 429, 429]);
  const session = new HttpSession("http://localhost:3002");
  const response = await session.request("/api/auth/sign-in/email", {
    email: "retry-probe@example.org",
    password: "WrongPass123!",
  });
  expect(response.status).toBe(429);
  expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1);
  expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(3);
});
