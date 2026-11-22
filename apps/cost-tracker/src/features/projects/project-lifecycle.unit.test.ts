import { describe, expect, it } from "vitest";

import {
  evaluateProjectTransition,
  projectLifecycleCapabilities,
  projectSettlement,
} from "./project-lifecycle";

describe("Project lifecycle", () => {
  it("projects settlement independently of permission and archive state", () => {
    expect(projectSettlement(false, [])).toBe("ready");
    expect(projectSettlement(false, ["paid", "rejected"])).toBe("ready");
    expect(projectSettlement(false, ["paid", null])).toBe("open");
    expect(projectSettlement(false, ["approved"])).toBe("open");
    expect(projectSettlement(true, ["paid"])).toBe("archived");
    expect(
      projectLifecycleCapabilities({
        archived: false,
        statuses: [],
        canArchive: false,
        canReopen: true,
      }),
    ).toEqual({ settlement: "ready", canArchive: false, canReopen: false });
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
