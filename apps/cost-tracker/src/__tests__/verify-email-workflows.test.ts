// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../scripts/verify-email-workflows.ts", import.meta.url),
  "utf8",
);

describe("verify-email-workflows failure diagnostics", () => {
  it("reports only finite static stages and never the caught error", () => {
    const stages = [
      "assertion",
      "session",
      "send-accept",
      "inbox-receipt",
      "link-exercise",
      "acceptance",
    ];
    const assignments = [...source.matchAll(/failureStage = "([^"]+)"/g)];
    expect(assignments.length).toBeGreaterThan(stages.length);
    for (const assignment of assignments) expect(stages).toContain(assignment[1]);
    expect(source).toContain('failureStage = "assertion";\n    try {');
    expect(source).toContain(
      'catch {\n      results.push({\n        workflow,\n        failureStage,\n        status: "failed",',
    );
    const check = source.slice(
      source.indexOf("  const check = async ("),
      source.indexOf("    const environments = {"),
    );
    expect(check).not.toMatch(/catch\s*\(/);
  });
});
