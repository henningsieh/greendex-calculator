import { ORPCError } from "@orpc/server";
import { APIError, isAPIError } from "better-auth/api";
import { z } from "zod";

import { createSituationErrors } from "@/lib/orpc/errors";

type Situations = ReturnType<typeof createSituationErrors>;
const BodySchema = z.object({ code: z.string().max(128) });
const MAX_ERROR_BODY_BYTES = 4096;

function mapFailure(status: number, body: unknown, errors: Situations) {
  const parsed = BodySchema.safeParse(body);
  switch (parsed.success ? parsed.data.code : undefined) {
    case "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION":
      return errors.notMember();
    case "NO_ACTIVE_ORGANIZATION":
      return errors.selectOrganization();
    case "INVALID_EMAIL_OR_PASSWORD":
      return errors.invalidCredentials();
    case "EMAIL_NOT_VERIFIED":
      return errors.verifyEmail();
  }
  switch (status) {
    case 400:
      return errors.badInput();
    case 401:
      return errors.unauthenticated();
    case 403:
      return errors.accessDenied();
    case 404:
      return errors.notFound();
    case 409:
      return errors.conflict();
    case 422:
      return errors.unprocessable();
    case 429:
      return errors.rateLimited();
    case 503:
      return errors.unavailable();
    default:
      return errors.internalFailure();
  }
}

export function normalizeBetterAuthError(
  error: unknown,
  errors: Situations,
  resHeaders?: Headers,
) {
  if (error instanceof ORPCError) return error;
  if (error instanceof APIError && isAPIError(error)) {
    forwardCookies(new Headers(error.headers), resHeaders);
    return mapFailure(error.statusCode, error.body, errors);
  }
  return errors.internalFailure();
}

function forwardCookies(headers: Headers | undefined, target?: Headers) {
  if (!headers || !target) return;
  for (const cookie of headers.getSetCookie())
    target.append("set-cookie", cookie);
}

export async function normalizeBetterAuthResponse(
  response: Response,
  errors: Situations,
  resHeaders?: Headers,
) {
  forwardCookies(response.headers, resHeaders);
  let body: unknown;
  const reader = response.clone().body?.getReader();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_ERROR_BODY_BYTES) break;
        chunks.push(part.value);
      }
      if (bytes <= MAX_ERROR_BODY_BYTES) {
        const joined = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {
          joined.set(chunk, offset);
          offset += chunk.byteLength;
        }
        body = JSON.parse(new TextDecoder().decode(joined));
      }
    } catch {
      /* Malformed vendor bodies never become public copy. */
    } finally {
      void reader.cancel().catch(() => undefined);
    }
  }
  return mapFailure(response.status, body, errors);
}
