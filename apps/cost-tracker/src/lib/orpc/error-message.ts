import { ORPCError } from "@orpc/client";

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
    if (error.status === 401 || error.code === "UNAUTHORIZED") {
      return {
        sessionExpired: true,
        text: "Your session is missing or has expired. Sign in to continue.",
      };
    }

    if (error.status === 403 || error.code === "FORBIDDEN") {
      return {
        sessionExpired: false,
        text: "You do not have permission to access this resource.",
      };
    }

    return {
      sessionExpired: false,
      text: `The request failed with HTTP ${error.status}. Try again.`,
    };
  }

  return {
    sessionExpired: false,
    text: "The server or network is unreachable. Check your connection and try again.",
  };
}
