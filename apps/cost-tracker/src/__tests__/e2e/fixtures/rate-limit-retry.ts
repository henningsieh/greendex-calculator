import { setTimeout as delay } from "node:timers/promises";

import type { APIRequestContext, APIResponse } from "@playwright/test";

const MAX_SIGN_IN_RATE_LIMIT_RETRIES = 2;
const MAX_SIGN_IN_RATE_LIMIT_WAIT_MS = 30_000;
const DEFAULT_SIGN_IN_RATE_LIMIT_WAIT_MS = 11_000;

export async function postSignInWithRateLimitRetry(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<APIResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
    });
    if (response.status() !== 429 || attempt >= MAX_SIGN_IN_RATE_LIMIT_RETRIES) {
      return response;
    }
    console.warn(
      `[rate-limit-retry] fixture sign-in limited, attempt ${attempt + 1}`,
    );
    await response.body().catch(() => undefined);
    const retryAfterSeconds = Number(
      response
        .headersArray()
        .find((header) => header.name.toLowerCase() === "retry-after")?.value,
    );
    const waitMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, MAX_SIGN_IN_RATE_LIMIT_WAIT_MS)
        : DEFAULT_SIGN_IN_RATE_LIMIT_WAIT_MS;
    await delay(waitMs);
  }
}
