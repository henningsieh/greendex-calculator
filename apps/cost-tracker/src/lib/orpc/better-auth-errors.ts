import { ORPCError } from "@orpc/server";
import { APIError, isAPIError } from "better-auth/api";
import { z } from "zod";

import {
  genericClientRefusalNames,
  membershipMisconfigurationNames,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

type Situations = ReturnType<typeof createSituationErrors>;
const BodySchema = z.object({ code: z.string().max(128) });
const MAX_ERROR_BODY_BYTES = 4096;

/** Vendor-status fallback resolves through the generic catalog refusals. */
const genericRefusalByStatus = new Map<
  number,
  (typeof genericClientRefusalNames)[number]
>(genericClientRefusalNames.map((name) => [situationCatalog[name].status, name]));

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
  const genericName = genericRefusalByStatus.get(status);
  if (genericName !== undefined) return errors[genericName]();
  return errors.internalFailure();
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

// addMember is a privileged server command. Permission/session/selection failures
// there describe server configuration, not the already authenticated Invitee.
const membershipMisconfigurationCodes: string[] =
  membershipMisconfigurationNames.map((name) => situationCatalog[name].code);

function normalizeParticipantMembershipFailure(
  error: ORPCError<string, unknown>,
  errors: Situations,
) {
  if (
    membershipMisconfigurationCodes.includes(error.code) &&
    error.data &&
    typeof error.data === "object" &&
    "reason" in error.data &&
    error.data.reason !== situationCatalog.verifyEmail.reason
  )
    return errors.internalFailure();
  if (error.code === situationCatalog.badInput.code)
    return errors.internalFailure();
  return error;
}

export function normalizeParticipantMembershipError(
  error: unknown,
  errors: Situations,
  resHeaders?: Headers,
) {
  if (error instanceof ORPCError) return error;
  return normalizeParticipantMembershipFailure(
    normalizeBetterAuthError(error, errors, resHeaders),
    errors,
  );
}

export async function normalizeParticipantMembershipResponse(
  response: Response,
  errors: Situations,
  resHeaders?: Headers,
) {
  return normalizeParticipantMembershipFailure(
    await normalizeBetterAuthResponse(response, errors, resHeaders),
    errors,
  );
}
