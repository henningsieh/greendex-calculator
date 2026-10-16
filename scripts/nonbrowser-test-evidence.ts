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
  numTodoTests: number;
  testResults: {
    name: string;
    status: string;
    message: string;
    assertionResults: AssertionResult[];
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTestResults(value: unknown): value is TestResults {
  if (!isRecord(value)) return false;
  return (
    [
      value.numTotalTests,
      value.numPassedTests,
      value.numFailedTests,
      value.numPendingTests,
      value.numTodoTests,
    ].every(
      (count) =>
        typeof count === "number" && Number.isInteger(count) && count >= 0,
    ) &&
    Array.isArray(value.testResults) &&
    value.testResults.every(
      (file: unknown) =>
        isRecord(file) &&
        typeof file.name === "string" &&
        typeof file.status === "string" &&
        typeof file.message === "string" &&
        Array.isArray(file.assertionResults) &&
        file.assertionResults.every(
          (test: unknown) =>
            isRecord(test) &&
            typeof test.status === "string" &&
            typeof test.fullName === "string" &&
            (test.failureMessages === null ||
              (Array.isArray(test.failureMessages) &&
                test.failureMessages.every(
                  (message: unknown) => typeof message === "string",
                ))),
        ),
    )
  );
}

/** Emit identities and static error kinds only; Vitest messages may contain secrets. */
export function nonbrowserTestEvidence(
  data: unknown,
  scope: string,
  root: string,
) {
  if (!isTestResults(data)) throw new Error("Missing valid test evidence.");
  const relativeFile = (name: string) => name.replace(`${root}/`, "");
  return {
    scope,
    total: data.numTotalTests,
    passed: data.numPassedTests,
    failed: data.numFailedTests,
    pending: data.numPendingTests,
    todo: data.numTodoTests,
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
