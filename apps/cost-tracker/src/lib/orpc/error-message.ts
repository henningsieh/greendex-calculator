import { ORPCError } from "@orpc/client";

import {
  getSafeErrorSituation,
  situationCatalog,
} from "@/lib/orpc/error-contract";

const genericSituations = [
  situationCatalog.badInput,
  situationCatalog.unauthenticated,
  situationCatalog.accessDenied,
  situationCatalog.notFound,
  situationCatalog.conflict,
  situationCatalog.proofTransportTooLarge,
  situationCatalog.proofMediaUnsupported,
  situationCatalog.unprocessable,
  situationCatalog.rateLimited,
  {
    ...situationCatalog.internalFailure,
    message: "The request could not be completed. Try again.",
  },
  situationCatalog.unavailable,
];

export type ORPCRequestErrorMessage = {
  sessionExpired: boolean;
  text: string;
};

/**
 * Converts transport errors into the limited, actionable language safe to show
 * to Cost Tracker users. Never render a remote error message directly.
 */
export function getORPCRequestErrorMessage(
  error: unknown,
): ORPCRequestErrorMessage {
  if (error instanceof ORPCError) {
    const situation = getSafeErrorSituation(error);
    if (situation)
      return {
        sessionExpired: situation.reason === "SESSION_REQUIRED",
        text:
          situation.reason === "INTERNAL_FAILURE"
            ? "The request could not be completed. Try again."
            : situation.message,
      };
    // Unknown metadata never activates reason-specific recovery. Require the
    // canonical code/status pair even for the generic sign-in fallback.
    const fallback = genericSituations.find(
      (entry) => entry.code === error.code && entry.status === error.status,
    );
    return {
      sessionExpired: fallback?.reason === "SESSION_REQUIRED",
      text: fallback?.message ?? "The request could not be completed. Try again.",
    };
  }

  return {
    sessionExpired: false,
    text: "The server or network is unreachable. Check your connection and try again.",
  };
}
