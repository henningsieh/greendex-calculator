import { afterEach, describe, expect, it, vi } from "vitest";

import { playwrightRetries } from "./playwright-retries";

describe("Playwright retry configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to zero and accepts safe non-negative integers", () => {
    expect(playwrightRetries(undefined)).toBe(0);
    expect(playwrightRetries("0")).toBe(0);
    expect(playwrightRetries("1")).toBe(1);
    expect(playwrightRetries("12")).toBe(12);
    expect(playwrightRetries("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(["", " ", "-1", "1.5", "abc", "1e2", "9007199254740992"])(
    "rejects invalid retry value %j without echoing it",
    (value) => {
      expect(() => playwrightRetries(value)).toThrow(
        "PLAYWRIGHT_RETRIES must be a non-negative safe integer.",
      );
    },
  );

  it.each([
    "../apps/calculator/playwright.config.ts",
    "../apps/calculator/playwright.merge.config.ts",
    "../apps/cost-tracker/playwright.config.ts",
  ])("uses the retry setting in %s", async (file) => {
    vi.stubEnv("PLAYWRIGHT_RETRIES", "3");
    vi.stubEnv("COST_TRACKER_E2E_BASE_URL", "http://localhost:3002");
    const config = (await import(file)).default;
    expect(config.retries).toBe(3);
    expect(config.reporter[0][0]).toBe(
      "../../scripts/playwright-retries-reporter.ts",
    );
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_RETRIES", "invalid");
    await expect(import(file)).rejects.toThrow(
      "PLAYWRIGHT_RETRIES must be a non-negative safe integer.",
    );
  });
});
