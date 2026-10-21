import { createHash } from "node:crypto";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(): never {
  throw new Error("Missing valid browser evidence.");
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    return invalid();
  return value;
}
const failureMatchers = [
  "toBeVisible",
  "toBeHidden",
  "toContainText",
  "toHaveCount",
  "toHaveURL",
  "toHaveTitle",
  "toBeTruthy",
  "toContain",
  "toEqual",
  "toMatch",
  "toPass",
  "toBe",
];
export type BrowserFailureCategory =
  | "timeout"
  | "assertion"
  | "navigation"
  | "unknown";
function failureText(errors: unknown[]): string {
  const parts: string[] = [];
  for (const error of errors.slice(0, 3)) {
    if (!record(error)) continue;
    for (const key of ["message", "stack", "value"]) {
      if (typeof error[key] === "string")
        parts.push((error[key] as string).slice(0, 2000));
    }
  }
  return parts.join("\n");
}
export function classifyBrowserFailure(
  status: string,
  errors: unknown[],
): { category: BrowserFailureCategory; matcher: string | null } {
  if (status === "timedOut") return { category: "timeout", matcher: null };
  const text = failureText(errors);
  const matcher =
    failureMatchers.find((name) => new RegExp(`\\.${name}\\b`).test(text)) ??
    null;
  if (
    /net::[A-Z_]+|navigation failed|ERR_|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(
      text,
    )
  )
    return { category: "navigation", matcher: null };
  if (/test timeout of \d+\s*ms exceeded|timeout \d+\s*ms exceeded/i.test(text))
    return { category: "timeout", matcher };
  if (/expect\(|assertionerror|expected:|received:/i.test(text))
    return { category: "assertion", matcher };
  return { category: "unknown", matcher: null };
}
function browserAttempt(value: unknown) {
  if (
    !record(value) ||
    !["passed", "failed", "timedOut", "skipped", "interrupted"].includes(
      String(value.status),
    ) ||
    !Array.isArray(value.errors)
  )
    return invalid();
  const duration =
    typeof value.duration === "number" &&
    Number.isFinite(value.duration) &&
    value.duration >= 0
      ? value.duration
      : 0;
  return {
    status: value.status,
    retry: count(value.retry),
    errorCount: value.errors.length,
    durationMs: duration,
    failure:
      value.errors.length > 0 ||
      !["passed", "skipped"].includes(String(value.status))
        ? classifyBrowserFailure(String(value.status), value.errors)
        : null,
  };
}
function browserSpec(value: unknown) {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.file !== "string" ||
    !Array.isArray(value.tests) ||
    !value.tests.length ||
    !/^[\w./-]+\.spec\.ts$/.test(value.file) ||
    value.file.startsWith("/") ||
    value.file.split("/").includes("..") ||
    count(value.line) === 0
  )
    return invalid();
  return {
    id: value.id,
    file: value.file,
    line: count(value.line),
    tests: value.tests,
  };
}
export interface BrowserTestEvidence {
  id: string;
  file: string;
  line: number;
  status: string;
  attempts: number;
  clean: boolean;
  failure?: {
    category: BrowserFailureCategory;
    matcher: string | null;
    durationMs: number;
  };
}
export function browserTestEvidence(data: unknown, discovery = false) {
  if (
    !record(data) ||
    !Array.isArray(data.suites) ||
    !Array.isArray(data.errors) ||
    !record(data.stats)
  )
    return invalid();
  const tests: BrowserTestEvidence[] = [];
  const walk = (suites: unknown[]) => {
    for (const suite of suites) {
      if (
        !record(suite) ||
        !Array.isArray(suite.specs) ||
        (suite.suites !== undefined && !Array.isArray(suite.suites))
      )
        return invalid();
      for (const value of suite.specs) {
        const spec = browserSpec(value);
        for (const test of spec.tests) {
          if (
            !record(test) ||
            typeof test.projectId !== "string" ||
            !["passed", "failed", "timedOut", "skipped", "interrupted"].includes(
              String(test.expectedStatus),
            ) ||
            !Array.isArray(test.results) ||
            !["expected", "unexpected", "flaky", "skipped"].includes(
              String(test.status),
            )
          )
            return invalid();
          const attempts = test.results.map(browserAttempt);
          const result = attempts[0];
          const failure = attempts.find(
            ({ failure }) => failure !== null,
          )?.failure;
          tests.push({
            id: createHash("sha256")
              .update(`${spec.id}/${test.projectId}`)
              .digest("hex"),
            file: spec.file,
            line: count(spec.line),
            status: String(test.status),
            attempts: test.results.length,
            ...(failure
              ? {
                  failure: {
                    ...failure,
                    durationMs: Math.max(
                      ...attempts.map(({ durationMs }) => durationMs),
                    ),
                  },
                }
              : {}),
            clean:
              !discovery &&
              test.expectedStatus === "passed" &&
              test.status === "expected" &&
              test.results.length === 1 &&
              result?.status === "passed" &&
              result.retry === 0 &&
              result.errorCount === 0,
          });
        }
      }
      walk(suite.suites ?? []);
    }
  };
  walk(data.suites);
  if (!tests.length || new Set(tests.map(({ id }) => id)).size !== tests.length)
    return invalid();
  const stats = {
    passed: count(data.stats.expected),
    failed: count(data.stats.unexpected),
    flaky: count(data.stats.flaky),
    skipped: count(data.stats.skipped),
    durationMs:
      typeof data.stats.duration === "number" &&
      Number.isFinite(data.stats.duration) &&
      data.stats.duration >= 0
        ? data.stats.duration
        : invalid(),
  };
  return {
    tests,
    stats,
    errors: data.errors.length,
    clean:
      !discovery &&
      data.errors.length === 0 &&
      tests.every(({ clean }) => clean) &&
      stats.passed === tests.length &&
      stats.failed === 0 &&
      stats.flaky === 0 &&
      stats.skipped === 0,
  };
}

export function assertBrowserExecution(
  discovery: ReturnType<typeof browserTestEvidence>,
  execution: ReturnType<typeof browserTestEvidence>,
): void {
  const expected = discovery.tests.map(({ id }) => id).sort();
  const actual = execution.tests.map(({ id }) => id).sort();
  if (
    discovery.errors ||
    JSON.stringify(expected) !== JSON.stringify(actual) ||
    !execution.clean
  )
    throw new Error("Required browser tests did not pass cleanly.");
}
