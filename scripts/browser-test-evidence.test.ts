import { describe, expect, it } from "vitest";

import {
  assertBrowserExecution,
  browserTestEvidence,
  classifyBrowserFailure,
} from "./browser-test-evidence";

const report = () => ({
  suites: [
    {
      specs: [
        {
          id: "test-id",
          file: "journey.spec.ts",
          line: 12,
          tests: [
            {
              projectId: "chromium",
              expectedStatus: "passed",
              status: "expected",
              results: [{ status: "passed", retry: 0, errors: [] }],
            },
          ],
        },
      ],
    },
  ],
  errors: [],
  stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0, duration: 10 },
});

describe("browser evidence", () => {
  it("accepts one clean attempt and only emits source identities and counts", () => {
    const data = { ...report(), secret: "private-secret", errors: [] };
    const evidence = browserTestEvidence(data);
    expect(evidence.clean).toBe(true);
    expect(evidence.stats).toEqual({
      passed: 1,
      failed: 0,
      flaky: 0,
      skipped: 0,
      durationMs: 10,
    });
    expect(evidence.tests[0]).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{64}$/),
      file: "journey.spec.ts",
      line: 12,
      status: "expected",
      attempts: 1,
      clean: true,
    });
    expect(JSON.stringify(evidence)).not.toContain("private-secret");
  });
  it("classifies timeout, assertion, navigation, and unknown failures", () => {
    expect(classifyBrowserFailure("timedOut", []).category).toBe("timeout");
    expect(
      classifyBrowserFailure("failed", [
        { message: "Timeout 15000ms exceeded while waiting for URL" },
      ]),
    ).toEqual({ category: "timeout", matcher: null });
    expect(
      classifyBrowserFailure("failed", [
        {
          message: "Error: expect(locator).toHaveCount: expected 0, received 1",
        },
      ]),
    ).toEqual({ category: "assertion", matcher: "toHaveCount" });
    expect(
      classifyBrowserFailure("failed", [
        { message: "page.goto: net::ERR_CONNECTION_REFUSED" },
      ]).category,
    ).toBe("navigation");
    expect(classifyBrowserFailure("failed", [{ message: "boom" }])).toEqual({
      category: "unknown",
      matcher: null,
    });
  });
  it("emits failure category metadata without raw error strings", () => {
    const data = report();
    const test = data.suites[0].specs[0].tests[0];
    test.status = "unexpected";
    test.results = [
      {
        status: "failed",
        retry: 0,
        duration: 15234,
        errors: [
          {
            message:
              "Timeout 15000ms exceeded waiting for private-secret user@example.com token=abc",
          },
        ],
      },
    ];
    const evidence = browserTestEvidence(data);
    expect(evidence.clean).toBe(false);
    expect(evidence.tests[0].failure).toEqual({
      category: "timeout",
      matcher: null,
      durationMs: 15234,
    });
    expect(JSON.stringify(evidence)).not.toContain("private-secret");
    expect(JSON.stringify(evidence)).not.toContain("user@example.com");
    expect(JSON.stringify(evidence)).not.toContain("token=abc");
  });
  it.each(["flaky", "skipped", "unexpected"])(
    "rejects %s acceptance",
    (status) => {
      const data = report();
      data.suites[0].specs[0].tests[0].status = status;
      expect(browserTestEvidence(data).clean).toBe(false);
    },
  );
  it("rejects retry-pass, expected failure, missing results, and report errors", () => {
    const data = report();
    const test = data.suites[0].specs[0].tests[0];
    test.results[0].retry = 1;
    expect(browserTestEvidence(data).clean).toBe(false);
    test.results[0].retry = 0;
    test.results.push({ status: "passed", retry: 1, errors: [] });
    expect(browserTestEvidence(data).clean).toBe(false);
    test.results = [];
    expect(browserTestEvidence(data).clean).toBe(false);
    test.expectedStatus = "failed";
    expect(browserTestEvidence(data).clean).toBe(false);
    expect(
      browserTestEvidence({
        ...report(),
        errors: [{ message: "private-secret" }],
      }).clean,
    ).toBe(false);
  });
  it.each([
    null,
    {},
    { ...report(), suites: [] },
    { ...report(), stats: {} },
    { ...report(), suites: [null] },
    { ...report(), stats: { ...report().stats, skipped: -1 } },
  ])("rejects missing or malformed reports %#", (data) => {
    expect(() => browserTestEvidence(data)).toThrow(
      "Missing valid browser evidence.",
    );
  });
  it("rejects missing, extra, duplicate, and substituted execution identities", () => {
    const discovery = browserTestEvidence(report(), true);
    expect(() =>
      assertBrowserExecution(discovery, browserTestEvidence(report())),
    ).not.toThrow();
    const other = report();
    other.suites[0].specs[0].id = "substitute";
    expect(() =>
      assertBrowserExecution(discovery, browserTestEvidence(other)),
    ).toThrow();
    const duplicate = report();
    duplicate.suites.push(duplicate.suites[0]);
    expect(() => browserTestEvidence(duplicate)).toThrow();
    expect(() =>
      assertBrowserExecution(discovery, {
        ...browserTestEvidence(report()),
        tests: [],
      }),
    ).toThrow();
  });
});
