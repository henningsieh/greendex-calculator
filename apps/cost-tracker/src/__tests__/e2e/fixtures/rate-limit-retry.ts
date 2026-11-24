import { setTimeout as delay } from "node:timers/promises";

import type { APIRequestContext, APIResponse } from "@playwright/test";

const MAX_SIGN_IN_RATE_LIMIT_RETRIES = 2;
const MAX_SIGN_IN_RATE_LIMIT_WAIT_MS = 30_000;
const DEFAULT_SIGN_IN_RATE_LIMIT_WAIT_MS = 11_000;

function retryAfterSeconds(response: APIResponse): number | undefined {
  const value = Number(
    response
      .headersArray()
      .find((header) => header.name.toLowerCase() === "retry-after")?.value,
  );
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Signs a fixture actor in, waiting out a throttled window instead of
 * returning a response the caller cannot act on.
 *
 * A rate-limited sign-in answers 429 *without* a session cookie, so the next
 * authenticated request reports 401 and any pending page navigation lands on
 * `/login`. That chain is far away from its cause, so it is reported here: the
 * sign-in is retried with `Retry-After`, and a sign-in that returns success
 * without a session cookie fails immediately with the status that produced it.
 */
export async function postSignInWithRateLimitRetry(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<APIResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
    });
    const status = response.status();

    if (status === 429) {
      const retryAfter = retryAfterSeconds(response);
      await response.body().catch(() => undefined);
      if (attempt >= MAX_SIGN_IN_RATE_LIMIT_RETRIES) {
        throw new Error(
          `Fixture sign-in for ${email} stayed rate limited after ${attempt + 1} attempts ` +
            `(status 429, retry-after ${retryAfter ?? "not provided"}). ` +
            "Start the E2E server with GREENDEX_LOCAL_TEST_SERVER=1 so loopback sign-ins are not throttled.",
        );
      }
      const waitMs = retryAfter
        ? Math.min(retryAfter * 1000, MAX_SIGN_IN_RATE_LIMIT_WAIT_MS)
        : DEFAULT_SIGN_IN_RATE_LIMIT_WAIT_MS;
      console.warn(
        `[rate-limit-retry] fixture sign-in limited, attempt ${attempt + 1}, waiting ${waitMs}ms`,
      );
      await delay(waitMs);
      continue;
    }

    if (response.ok()) {
      const { cookies } = await request.storageState();
      if (!cookies.some(({ name }) => name.includes("session_token"))) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Fixture sign-in for ${email} returned ${status} without a session cookie, ` +
            `so every later authenticated request would fail. Body: ${body.slice(0, 200)}`,
        );
      }
    }

    return response;
  }
}
