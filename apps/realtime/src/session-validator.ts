import { z } from "zod";

export type SessionIdentity = { userId: string };

export type SessionValidator = (
  cookie: string | undefined,
) => Promise<SessionIdentity | null>;

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
    try {
      const response = await fetchImpl(
        new URL("/api/auth/get-session", costTrackerOrigin),
        {
          headers: { cookie },
          signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
        },
      );
      if (!response.ok) return null;
      const parsed = SessionResponseSchema.safeParse(await response.json());
      return parsed.success ? { userId: parsed.data.user.id } : null;
    } catch {
      return null;
    }
  };
}
