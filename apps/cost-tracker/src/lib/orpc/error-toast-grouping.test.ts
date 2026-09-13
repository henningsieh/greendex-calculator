import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  createORPCErrorToastGrouper,
  ORPC_ERROR_TOAST_GROUPING_INTERVAL_MS,
} from "@/lib/orpc/error-toast-grouping";

describe("Cost Tracker oRPC error toast grouping", () => {
  it("shows the first failure and groups an identical burst", () => {
    let now = 1_000;
    const grouper = createORPCErrorToastGrouper({ now: () => now });
    const error = new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 });

    expect(grouper.shouldShow(error)).toBe(true);
    expect(grouper.shouldShow(error)).toBe(false);

    now += ORPC_ERROR_TOAST_GROUPING_INTERVAL_MS;
    expect(grouper.shouldShow(error)).toBe(true);
  });

  it("keeps failures with different status codes or meanings separate", () => {
    const grouper = createORPCErrorToastGrouper({ now: () => 1_000 });

    expect(
      grouper.shouldShow(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 })),
    ).toBe(true);
    expect(
      grouper.shouldShow(new ORPCError("SERVICE_UNAVAILABLE", { status: 503 })),
    ).toBe(true);
    expect(grouper.shouldShow(new TypeError("fetch failed"))).toBe(true);
    expect(grouper.shouldShow(new TypeError("connection refused"))).toBe(true);
    expect(grouper.shouldShow({ reason: "offline" })).toBe(true);
    expect(grouper.shouldShow({ reason: "timeout" })).toBe(true);
  });
});
