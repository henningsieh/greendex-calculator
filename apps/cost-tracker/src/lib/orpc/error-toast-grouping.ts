import { ORPCError } from "@orpc/client";

/** Identical Cost Tracker oRPC failures share one toast for two seconds. */
export const ORPC_ERROR_TOAST_GROUPING_INTERVAL_MS = 2_000;

function getErrorGroupingKey(error: unknown): unknown {
  if (error instanceof ORPCError) {
    return `orpc:${error.status}:${error.code}`;
  }

  if (error instanceof Error) {
    return `error:${error.name}:${error.message}`;
  }

  return error;
}

export function createORPCErrorToastGrouper({
  now = Date.now,
}: { now?: () => number } = {}) {
  const visibleSince = new Map<unknown, number>();

  return {
    shouldShow(error: unknown): boolean {
      const timestamp = now();
      const cutoff = timestamp - ORPC_ERROR_TOAST_GROUPING_INTERVAL_MS;

      for (const [key, shownAt] of visibleSince) {
        if (shownAt <= cutoff) visibleSince.delete(key);
      }

      const key = getErrorGroupingKey(error);
      if (visibleSince.has(key)) return false;

      visibleSince.set(key, timestamp);
      return true;
    },
  };
}
