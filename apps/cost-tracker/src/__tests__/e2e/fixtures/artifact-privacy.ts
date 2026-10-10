import { createRequire } from "node:module";

import { SEED_USER } from "@greendex/auth/seed-user";
import {
  expect,
  test as base,
  type Page,
  type BrowserContextOptions,
  type TestInfo,
} from "@playwright/test";

export { expect } from "@playwright/test";

// The deep guard is dormant for MVP. See the follow-up backlog item at
// apps/cost-tracker/docs/backlog/e2e-artifact-privacy-followup.md.
const require = createRequire(import.meta.url);

const privateValues = new Set<string>([SEED_USER.password]);
for (const [key, value] of Object.entries(process.env)) {
  if (
    value &&
    /password|secret|token|credential|database_url|access_key/i.test(key)
  )
    privateValues.add(value);
}

export function registerPrivateValues(...values: string[]) {
  for (const value of values) if (value) privateValues.add(value);
}

export function redactArtifactText(text: string): string {
  for (const value of privateValues) {
    text = text.replaceAll(value, "[redacted]");
    text = text.replaceAll(encodeURIComponent(value), "[redacted]");
  }
  return (
    text
      // Also cover nested/percent-encoded login return URLs and private link IDs.
      .replace(
        /(?:\/|%2f)(?:setup-links|participant-links|participant-invitations|accept-invitation)(?:\/|%2f)[^\s"'<>)]*/gi,
        "/private-link/[redacted]",
      )
      .replace(
        /(?:\?|%3f)(?:secret|token|returnTo|redirect)[^\s"'<>)]*/gi,
        "?[redacted]",
      )
      .replace(
        /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi,
        "[redacted-id]",
      )
      // Generated link secrets, session tokens, password hashes and JWT segments.
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted-token]")
  );
}

function redactParameters(value: unknown): unknown {
  if (typeof value === "string") return redactArtifactText(value);
  if (Array.isArray(value)) return value.map(redactParameters);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactParameters(item)]),
    );
  return value;
}

function redactError(error: unknown): unknown {
  if (typeof error === "string") return redactArtifactText(error);
  if (!error || typeof error !== "object") return error;
  const fields = error as Record<string, unknown>;
  for (const key of ["message", "stack", "value"] as const) {
    const value = fields[key];
    if (typeof value === "string") fields[key] = redactArtifactText(value);
  }
  // Matchers can attach an aria snapshot independently of automatic snapshots.
  if ("matcherResult" in error && error.matcherResult)
    Object.assign(error, {
      matcherResult: redactParameters(error.matcherResult),
    });
  if ("errors" in error && Array.isArray(error.errors))
    error.errors.forEach(redactError);
  return error;
}

type StepData = {
  title: string;
  subtitle?: string;
  params?: unknown;
};
type StepResult = { error?: unknown; softError?: unknown };
type PrivacyTestInfo = TestInfo & {
  _addStep: (
    data: StepData,
    ...rest: unknown[]
  ) => {
    complete: (result: StepResult) => void;
  };
  _failWithError: (error: unknown) => void;
};

// Deliberate no-op: do not install runner-internals hooks for MVP.
export function installArtifactPrivacy(_testInfo: TestInfo): () => void {
  return () => undefined;
}

// Retained experimental implementation, NEVER called by the default test export.
// Re-enabling requires the backlog validation, not just switching this function.
export function installExperimentalArtifactPrivacy(
  testInfo: TestInfo,
): () => void {
  if (require("@playwright/test/package.json").version !== "1.63.0") {
    throw new Error(
      "Experimental artifact privacy requires Playwright version review.",
    );
  }
  const info = testInfo as PrivacyTestInfo;
  if (
    typeof info._addStep !== "function" ||
    typeof info._failWithError !== "function"
  )
    throw new Error("Playwright artifact privacy hooks are unavailable.");
  const addStep = info._addStep;
  const failWithError = info._failWithError;
  const previous = process.env.PLAYWRIGHT_NO_COPY_PROMPT;
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
  info._addStep = function (data, ...rest) {
    const step = addStep.call(
      this,
      {
        ...data,
        title: redactArtifactText(data.title),
        subtitle: data.subtitle && redactArtifactText(data.subtitle),
        params: redactParameters(data.params),
      },
      ...rest,
    );
    const complete = step.complete;
    step.complete = (result) =>
      complete({
        ...result,
        error: redactError(result.error),
        softError: redactError(result.softError),
      });
    return step;
  };
  info._failWithError = function (error) {
    failWithError.call(this, redactError(error));
  };
  return () => {
    info._addStep = addStep;
    info._failWithError = failWithError;
    if (previous === undefined) delete process.env.PLAYWRIGHT_NO_COPY_PROMPT;
    else process.env.PLAYWRIGHT_NO_COPY_PROMPT = previous;
  };
}

// Dormant artifact-recorder dependency experiment; no suite imports this export.
export const experimentalTest = base.extend<{
  artifactPrivacy: void;
  _combinedContextOptions: BrowserContextOptions;
}>({
  artifactPrivacy: [
    // Playwright requires a destructured dependency parameter, even when empty.
    // oxlint-disable-next-line eslint/no-empty-pattern
    async ({}, provide, testInfo) => {
      const restore = installExperimentalArtifactPrivacy(testInfo);
      try {
        await provide();
      } finally {
        restore();
      }
    },
    { auto: true },
  ],
  // _setupArtifacts depends on this fixture. Keep the privacy guard alive until
  // AFTER its teardown (otherwise its final failure snapshot would leak).
  _combinedContextOptions: async (
    { _combinedContextOptions, artifactPrivacy: _artifactPrivacy },
    provide,
  ) => {
    await provide(_combinedContextOptions);
  },
});

export const test = base.extend({});

// Match the same complete URL that toHaveURL would, but never hand it to the
// matcher diagnostic. In particular, login redirects can embed a private URL.
export async function expectPrivateURL(
  page: Page,
  expected: string | RegExp,
  options: { timeout?: number } = {},
) {
  const baseURL = test.info().project.use.baseURL;
  const exact =
    typeof expected === "string" ? new URL(expected, baseURL).href : undefined;
  await expect
    .poll(
      () =>
        typeof expected === "string"
          ? page.url() === exact
          : expected.test(page.url()),
      {
        ...options,
        message:
          "Navigation must satisfy the expected full-URL match (private values redacted)",
      },
    )
    .toBe(true);
}
