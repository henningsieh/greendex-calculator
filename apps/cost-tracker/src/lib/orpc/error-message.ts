import { ORPCError } from "@orpc/client";

import {
  genericClientRefusalNames,
  getSafeErrorSituation,
  hasComposedCopy,
  situationCatalog,
} from "@/lib/orpc/error-contract";

const GENERIC_FAILURE_TEXT = "The request could not be completed. Try again.";

const genericSituations = genericClientRefusalNames.map((name) =>
  name === "internalFailure"
    ? { ...situationCatalog.internalFailure, message: GENERIC_FAILURE_TEXT }
    : situationCatalog[name],
);

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
    // A composed copy is a prefix the client cannot complete, so it falls
    // through to the generic transport copy instead of leaking half a sentence.
    if (situation && !hasComposedCopy(situation))
      return {
        sessionExpired:
          situation.reason === situationCatalog.unauthenticated.reason,
        text:
          situation.reason === situationCatalog.internalFailure.reason
            ? GENERIC_FAILURE_TEXT
            : situation.message,
      };
    // Unknown metadata never activates reason-specific recovery. Require the
    // canonical code/status pair even for the generic sign-in fallback.
    const fallback = genericSituations.find(
      (entry) => entry.code === error.code && entry.status === error.status,
    );
    return {
      sessionExpired:
        fallback?.reason === situationCatalog.unauthenticated.reason,
      text: fallback?.message ?? GENERIC_FAILURE_TEXT,
    };
  }

  return {
    sessionExpired: false,
    text: "The server or network is unreachable. Check your connection and try again.",
  };
}
