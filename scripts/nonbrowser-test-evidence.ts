interface AssertionResult {
  status: string;
  fullName: string;
  failureMessages: string[] | null;
}

interface TestResults {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: {
    name: string;
    status: string;
    message: string;
    assertionResults: AssertionResult[];
  }[];
}

/** Emit identities and static error kinds only; Vitest messages may contain secrets. */
export function nonbrowserTestEvidence(
  data: TestResults,
  scope: string,
  root: string,
) {
  const relativeFile = (name: string) => name.replace(`${root}/`, "");
  return {
    scope,
    total: data.numTotalTests,
    passed: data.numPassedTests,
    failed: data.numFailedTests,
    pending: data.numPendingTests,
    failures: data.testResults.flatMap((file) =>
      file.assertionResults
        .filter((test) => test.status === "failed")
        .map((test) => ({
          file: relativeFile(file.name),
          test: test.fullName,
          kind: (test.failureMessages ?? []).some((message) =>
            /timed out|timeout/i.test(message),
          )
            ? "timeout"
            : "assertion-or-runtime-error",
        })),
    ),
    pendingTests: data.testResults.flatMap((file) =>
      file.assertionResults
        .filter((test) =>
          ["pending", "skipped", "todo", "disabled"].includes(test.status),
        )
        .map((test) => ({
          file: relativeFile(file.name),
          test: test.fullName,
          status: test.status,
        })),
    ),
    suiteFailures: data.testResults
      .filter(
        (file) =>
          file.status === "failed" &&
          !file.assertionResults.some((test) => test.status === "failed"),
      )
      .map((file) => ({
        file: relativeFile(file.name),
        kind: /hook|beforeAll|afterAll|beforeEach|afterEach/i.test(file.message)
          ? "hook-error"
          : "suite-runtime-error",
      })),
  };
}
