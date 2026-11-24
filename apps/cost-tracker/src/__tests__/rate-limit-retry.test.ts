import type { APIRequestContext, APIResponse } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";

import { postSignInWithRateLimitRetry } from "./e2e/fixtures/rate-limit-retry";

function stubRequest(
  statuses: number[],
  { sessionCookie = true }: { sessionCookie?: boolean } = {},
) {
  const queue = [...statuses];
  const post = vi.fn(async () => {
    const status = queue.shift() ?? 200;
    return {
      status: () => status,
      headersArray: () =>
        status === 429 ? [{ name: "retry-after", value: "1" }] : [],
      body: async () => Buffer.from("{}"),
      text: async () => "{}",
    } as unknown as APIResponse;
  });
  const storageState = vi.fn(async () => ({
    cookies: sessionCookie
      ? [{ name: "better-auth.session_token", value: "session" }]
      : [],
    origins: [],
  }));
  return {
    post,
    request: { post, storageState } as unknown as APIRequestContext,
  };
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

it("rejects a success response that carries no session cookie", async () => {
  const { request } = stubRequest([200], { sessionCookie: false });
  await expect(
    postSignInWithRateLimitRetry(
      request,
      "retry-probe@example.org",
      "WrongPass123!",
    ),
  ).rejects.toThrow(/without a session cookie/);
});

it("bounds fixture sign-in retries and reports the persistent 429", async () => {
  const { post, request } = stubRequest([429, 429, 429, 429, 429]);
  await expect(
    postSignInWithRateLimitRetry(
      request,
      "retry-probe@example.org",
      "WrongPass123!",
    ),
  ).rejects.toThrow(/stayed rate limited after 3 attempts/);
  expect(post.mock.calls.length).toBe(3);
});
