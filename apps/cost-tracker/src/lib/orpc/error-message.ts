import { ORPCError } from "@orpc/client";

import {
  genericClientRefusalNames,
  getSafeErrorSituation,
  hasComposedCopy,
  SafeErrorDataSchema,
  situationCatalog,
  type ProjectCompletionBlocker,
  type SafeFieldIssue,
  type Situation,
} from "@/lib/orpc/error-contract";
import { getErrorStatus } from "@/lib/orpc/error-status";

const GENERIC_FAILURE_TEXT = "The request could not be completed. Try again.";
const NETWORK_FAILURE_TEXT =
  "The server or network is unreachable. Check your connection and try again.";

export type ORPCRequestErrorMessage = {
  sessionExpired: boolean;
  text: string;
};

export type ErrorPresentation = ORPCRequestErrorMessage & {
  key:
    | Situation["reason"]
    | "fallback.internalFailure"
    | "fallback.networkFailure";
  issues?: SafeFieldIssue[];
  blockers?: ProjectCompletionBlocker[];
};

export function getORPCErrorPresentation(error: unknown): ErrorPresentation {
  if (!(error instanceof ORPCError))
    return {
      key: "fallback.networkFailure",
      text: NETWORK_FAILURE_TEXT,
      sessionExpired: false,
    };

  return getMetadataPresentation(error);
}

function getMetadataPresentation(error: {
  code: string;
  data?: unknown;
}): ErrorPresentation {
  const situation = getSafeErrorSituation(error);
  const parsed = situation
    ? SafeErrorDataSchema.safeParse(error.data)
    : undefined;
  if (
    situation &&
    (!hasComposedCopy(situation) ||
      (parsed?.success && parsed.data.blockers?.length))
  ) {
    return {
      key:
        situation.reason === "INTERNAL_FAILURE"
          ? "fallback.internalFailure"
          : situation.reason,
      text: hasComposedCopy(situation)
        ? situationCatalog.conflict.message
        : situation.reason === "INTERNAL_FAILURE"
          ? GENERIC_FAILURE_TEXT
          : situation.message,
      sessionExpired: situation.reason === "SESSION_REQUIRED",
      ...(parsed?.success && parsed.data.issues
        ? { issues: parsed.data.issues }
        : {}),
      ...(parsed?.success && parsed.data.blockers
        ? { blockers: parsed.data.blockers }
        : {}),
    };
  }

  return getGenericPresentation(error.code);
}

function getGenericPresentation(code: string): ErrorPresentation {
  const fallback = genericClientRefusalNames
    .map((name) => situationCatalog[name])
    .find((entry) => entry.code === code);
  return {
    key:
      !fallback || fallback.reason === "INTERNAL_FAILURE"
        ? "fallback.internalFailure"
        : fallback.reason,
    text:
      !fallback || fallback.reason === "INTERNAL_FAILURE"
        ? GENERIC_FAILURE_TEXT
        : fallback.message,
    sessionExpired: fallback?.reason === "SESSION_REQUIRED",
  };
}

/** Safe English output for callers that cannot render React content. */
export function getORPCRequestErrorMessage(
  error: unknown,
): ORPCRequestErrorMessage {
  const { text, sessionExpired } = getORPCErrorPresentation(error);
  return { text, sessionExpired };
}

export function getHTTPErrorPresentation(
  body: unknown,
  status: number,
): ErrorPresentation {
  if (
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string" &&
    "reason" in body
  ) {
    const metadata = { code: body.code, data: { reason: body.reason } };
    const situation = getSafeErrorSituation(metadata);
    if (situation && getErrorStatus(situation.code) === status)
      return getMetadataPresentation(metadata);
  }
  return getMetadataPresentation({ code: "INTERNAL_SERVER_ERROR" });
}
