import { describe, expect, it } from "vitest";

import { nonbrowserTestEvidence } from "./nonbrowser-test-evidence";

const assertion = {
  status: "pending",
  fullName: "source-named test",
  failureMessages: [],
};
const results = {
  numTotalTests: 1,
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 1,
  testResults: [
    {
      name: "/repo/src/source.test.ts",
      status: "failed",
      message: "beforeAll hook timed out private-secret",
      assertionResults: [assertion],
    },
  ],
};

describe("nonbrowserTestEvidence", () => {
  it("names pending assertions and classifies hook errors without disclosing messages", () => {
    const evidence = nonbrowserTestEvidence(results, ".", "/repo");
    expect(evidence.pendingTests).toEqual([
      {
        file: "src/source.test.ts",
        test: "source-named test",
        status: "pending",
      },
    ]);
    expect(evidence.suiteFailures).toEqual([
      { file: "src/source.test.ts", kind: "hook-error" },
    ]);
    expect(JSON.stringify(evidence)).not.toContain("private-secret");
  });
  it("preserves assertion timeout classification and distinguishes runtime suite errors", () => {
    const evidence = nonbrowserTestEvidence(
      {
        ...results,
        testResults: [
          {
            ...results.testResults[0],
            assertionResults: [
              {
                ...assertion,
                status: "failed",
                failureMessages: ["timeout private-secret"],
              },
            ],
          },
          {
            ...results.testResults[0],
            message: "import failed private-secret",
            assertionResults: [],
          },
        ],
      },
      ".",
      "/repo",
    );
    expect(evidence.failures[0].kind).toBe("timeout");
    expect(evidence.suiteFailures).toEqual([
      { file: "src/source.test.ts", kind: "suite-runtime-error" },
    ]);
    expect(JSON.stringify(evidence)).not.toContain("private-secret");
  });
});
