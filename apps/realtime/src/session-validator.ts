import { z } from "zod";

export type SessionIdentity = { userId: string };

export type SessionValidator = (
  cookie: string | undefined,
) => Promise<SessionIdentity | null>;

/** The auth service could not answer; the caller may retry. */
export class SessionValidationUnavailableError extends Error {
  constructor() {
    super("Session validation is temporarily unavailable.");
    this.name = "SessionValidationUnavailableError";
  }
}

const SessionResponseSchema = z.object({
  user: z.object({ id: z.string().min(1) }),
});

const SESSION_TIMEOUT_MS = 2000;

/**
 * Delegates session validation to Cost Tracker's Better Auth endpoint, so this
 * service owns no auth configuration, cookie parsing, or signing secret. The
 * cookie is forwarded as-is and never logged.
 */
export function createCostTrackerSessionValidator(
  costTrackerOrigin: string,
  fetchImpl: typeof fetch = fetch,
): SessionValidator {
  return async (cookie) => {
    if (!cookie) return null;

    let response: Response;
    try {
      response = await fetchImpl(
        new URL("/api/auth/get-session", costTrackerOrigin),
        {
          headers: { cookie },
          signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
        },
      );
    } catch {
      throw new SessionValidationUnavailableError();
    }

    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new SessionValidationUnavailableError();

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new SessionValidationUnavailableError();
    }
    const parsed = SessionResponseSchema.safeParse(body);
    return parsed.success ? { userId: parsed.data.user.id } : null;
  };
}
