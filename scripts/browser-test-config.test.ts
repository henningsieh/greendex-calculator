import { afterEach, describe, expect, it, vi } from "vitest";

import { fullBrowserConfig, fullBrowserUse } from "./browser-test-config";

const configurations = [
  "../apps/cost-tracker/playwright.config",
  "../apps/calculator/playwright.config",
  "../apps/calculator/playwright.merge.config",
  "../apps/calculator/playwright.instant.config",
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("full browser configuration", () => {
  it("does not change focused defaults", () => {
    vi.stubEnv("GREENDEX_FULL_TEST_RUN", "false");
    expect(fullBrowserConfig()).toEqual({});
    expect(fullBrowserUse()).toEqual({});
  });
  it("requires private output paths", () => {
    vi.stubEnv("GREENDEX_FULL_TEST_RUN", "true");
    vi.stubEnv("GREENDEX_PLAYWRIGHT_REPORT", "");
    expect(() => fullBrowserConfig()).toThrow(
      "Missing private browser evidence paths.",
    );
  });
  it("applies zero retries, bounded concurrency and private paths to all four real configs", async () => {
    vi.stubEnv("GREENDEX_FULL_TEST_RUN", "true");
    vi.stubEnv("GREENDEX_PLAYWRIGHT_REPORT", "/private/run/raw.json");
    vi.stubEnv("GREENDEX_PLAYWRIGHT_OUTPUT", "/private/run/output");
    vi.stubEnv("GREENDEX_PLAYWRIGHT_AUTH", "/private/run/auth.json");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://127.0.0.1:9876");
    const configs = [];
    for (const path of configurations) {
      const { default: config } = await import(path);
      configs.push(config);
      expect(config).toMatchObject({
        retries: 0,
        workers: 1,
        forbidOnly: true,
        outputDir: "/private/run/output",
        reporter: [["json", { outputFile: "/private/run/raw.json" }]],
        use: { trace: "off", screenshot: "off", video: "off" },
      });
    }
    expect(configs[0].use.storageState).toBe("/private/run/auth.json");
    expect(configs[1].use.storageState).toBe("/private/run/auth.json");
    expect(configs[1].testIgnore).toBe("instant-shells.spec.ts");
    expect(configs[3].testMatch).toBe("instant-shells.spec.ts");
    expect(configs[3].use.storageState).toEqual({ cookies: [], origins: [] });
    expect(configs[3].globalSetup).toBeUndefined();
    expect(configs[2].globalSetup).toBeUndefined();
  });
});
