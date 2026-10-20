import type { APIRequestContext, APIResponse } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";

import { postSignInWithRateLimitRetry } from "./e2e/fixtures/rate-limit-retry";

function stubRequest(statuses: number[]) {
  const queue = [...statuses];
  const post = vi.fn(async () => {
    const status = queue.shift() ?? 200;
    return {
      status: () => status,
      headersArray: () =>
        status === 429 ? [{ name: "retry-after", value: "1" }] : [],
      body: async () => Buffer.from("{}"),
    } as unknown as APIResponse;
  });
  return { post, request: { post } as unknown as APIRequestContext };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("retries a rate-limited fixture sign-in and returns the follow-up response", async () => {
  const { post, request } = stubRequest([429, 200]);
  const response = await postSignInWithRateLimitRetry(
    request,
    "retry-probe@example.org",
    "WrongPass123!",
  );
  expect(response.status()).toBe(200);
  expect(post).toHaveBeenCalledTimes(2);
});

it("returns non-rate-limited failures without retrying", async () => {
  const { post, request } = stubRequest([401]);
  const response = await postSignInWithRateLimitRetry(
    request,
    "retry-probe@example.org",
    "WrongPass123!",
  );
  expect(response.status()).toBe(401);
  expect(post).toHaveBeenCalledTimes(1);
});

it("bounds fixture sign-in retries and surfaces a persistent 429", async () => {
  const { post, request } = stubRequest([429, 429, 429, 429, 429]);
  const response = await postSignInWithRateLimitRetry(
    request,
    "retry-probe@example.org",
    "WrongPass123!",
  );
  expect(response.status()).toBe(429);
  expect(post.mock.calls.length).toBeGreaterThan(1);
  expect(post.mock.calls.length).toBeLessThanOrEqual(3);
});
