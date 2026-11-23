import { claimStatusEnum } from "@greendex/database/schema";
import { describe, expect, it } from "vitest";

import {
  evaluateProjectTransition,
  projectLifecycleCapabilities,
  projectStatus,
} from "./project-lifecycle";

describe("Project lifecycle", () => {
  it("projects status independently of permission and archive state", () => {
    expect(projectStatus(false, [])).toBe("ready");
    expect(projectStatus(false, ["paid", "rejected"])).toBe("ready");
    expect(projectStatus(false, ["paid", null])).toBe("open");
    expect(projectStatus(false, ["approved"])).toBe("open");
    expect(projectStatus(true, ["paid"])).toBe("archived");
    expect(
      projectLifecycleCapabilities({
        archived: false,
        statuses: [],
        canArchive: false,
        canReopen: true,
      }),
    ).toEqual({ status: "ready", canArchive: false, canReopen: false });
  });

  it.each(
    claimStatusEnum.enumValues.map((status) => [
      status,
      status === "paid" || status === "rejected" ? "ready" : "open",
    ]),
  )("derives list status from Claim status %s", (claimStatus, expected) => {
    expect(projectStatus(false, [claimStatus])).toBe(expected);
  });

  it("treats a missing Claim as unsettled and archive as masking readiness", () => {
    expect(projectStatus(false, [undefined])).toBe("open");
    expect(projectStatus(false, [null])).toBe("open");
    expect(projectStatus(true, [])).toBe("archived");
    expect(projectStatus(true, ["approved"])).toBe("archived");
  });

  it("requires settlement and a reopening reason", () => {
    expect(
      evaluateProjectTransition("active", "archive", { settled: true }),
    ).toEqual({ kind: "transition", state: "archived" });
    expect(
      evaluateProjectTransition("active", "archive", { settled: false }),
    ).toEqual({ kind: "refused", reason: "settled" });
    expect(
      evaluateProjectTransition("archived", "archive", { settled: true }),
    ).toEqual({ kind: "refused", reason: "invalidState" });
    expect(
      evaluateProjectTransition("archived", "reopen", { reason: true }),
    ).toEqual({ kind: "transition", state: "active" });
    expect(
      evaluateProjectTransition("archived", "reopen", { reason: false }),
    ).toEqual({ kind: "refused", reason: "reason" });
    expect(
      evaluateProjectTransition("active", "reopen", { reason: true }),
    ).toEqual({ kind: "refused", reason: "invalidState" });
  });
});
