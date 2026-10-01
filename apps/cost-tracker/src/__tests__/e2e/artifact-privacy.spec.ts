import { randomBytes } from "node:crypto";

import { type Page, type TestInfo } from "@playwright/test";

import {
  expect,
  expectPrivateURL,
  installArtifactPrivacy,
  installExperimentalArtifactPrivacy,
  redactArtifactText,
  registerPrivateValues,
  test,
} from "./fixtures/artifact-privacy";

// Safe MVP probes use synthetic URLs and never navigate to a private link.
// Deep-hook probes below are retained but NOT registered/executed; see backlog.
// Trace/video/screenshots are off; automatic DOM snapshots remain a known risk.
export function experimentalStepPrivacyProbe() {
  const secret = randomBytes(24).toString("base64url");
  registerPrivateValues(secret);
  const emitted: string[] = [];
  const addStep = (data: unknown) => {
    emitted.push(JSON.stringify(data));
    return {
      complete: (result: { error?: Error }) => {
        emitted.push(result.error?.message ?? "", result.error?.stack ?? "");
      },
    };
  };
  const failWithError = (error: Error) =>
    emitted.push(error.message, error.stack!);
  const info = { _addStep: addStep, _failWithError: failWithError };
  const previous = process.env.PLAYWRIGHT_NO_COPY_PROMPT;
  const restore = installExperimentalArtifactPrivacy(info as unknown as TestInfo);
  try {
    expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe("1");
    info
      ._addStep({
        title: `Navigate to /setup-links/private-id?secret=${secret}`,
        subtitle: secret,
        params: { password: secret },
      })
      .complete({ error: new Error(`navigation failed with ${secret}`) });
    info._failWithError(new Error(`assertion failed with ${secret}`));
    // Preserve evidence of both failures and the step; only values are redacted.
    expect(emitted.join("\n").includes(secret)).toBe(false);
    expect(emitted.join("\n")).toContain("Navigate to");
    expect(emitted.join("\n")).toContain("navigation failed");
    expect(emitted.join("\n")).toContain("assertion failed");
    expect(emitted.join("\n")).toContain("[redacted]");
  } finally {
    restore();
  }
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe(previous);
  expect(info._addStep).toBe(addStep);
  expect(info._failWithError).toBe(failWithError);
}

export async function experimentalSnapshotPrivacyProbe(page: Page) {
  const secret = randomBytes(24).toString("base64url");
  registerPrivateValues(secret);
  await page.route("**/setup-links/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<label>Private link<input value="${secret}"></label>`,
    }),
  );
  await page.goto(`/setup-links/private-id?secret=${secret}`);
  // Preserve the original full-URL regex check: a mismatched private route fails.
  await expect(
    expectPrivateURL(page, /\/login/, { timeout: 100 }),
  ).rejects.toThrow("Navigation must satisfy the expected full-URL match");
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe("1");
}

export async function experimentalNavigationPrivacyProbe(page: Page) {
  const secret = randomBytes(24).toString("base64url");
  registerPrivateValues(secret);
  await page.route("**/participant-links/**", (route) => route.abort());
  let failure: unknown;
  try {
    await page.goto(`/participant-links/private-id?secret=${secret}`);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  const message = (failure as Error).message;
  expect(message.includes(secret)).toBe(false);
  expect(message).toContain("page.goto");
  expect(message).toContain("[redacted]");
}

test("MVP guard leaves runner hooks and environment untouched", ({
  baseURL: _baseURL,
}, testInfo) => {
  const previous = process.env.PLAYWRIGHT_NO_COPY_PROMPT;
  const restore = installArtifactPrivacy(testInfo);
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe(previous);
  restore();
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe(previous);
});

test("retained pure redactor removes registered values and private link shapes", () => {
  const secret = randomBytes(24).toString("base64url");
  registerPrivateValues(secret);
  const redacted = redactArtifactText(`/setup-links/private-id?secret=${secret}`);
  expect(redacted.includes(secret)).toBe(false);
  expect(redacted).toContain("[redacted]");
});

test("boolean URL diagnostics preserve regex and exact URL assertion strength", async ({
  baseURL,
}) => {
  const secret = randomBytes(24).toString("base64url");
  const url = new URL(`/setup-links/private-id?secret=${secret}`, baseURL).href;
  const page = { url: () => url } as Page;
  // Preserve the complete original regex evaluation without emitting its input.
  await expectPrivateURL(page, /\/setup-links\/[^?]+\?secret=/);
  // A wrong path and an exact URL without the secret query must both fail.
  for (const expected of [/\/login/, "/setup-links/private-id"]) {
    await expect(
      expectPrivateURL(page, expected, { timeout: 100 }),
    ).rejects.toThrow("Navigation must satisfy the expected full-URL match");
  }
});
