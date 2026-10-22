import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { expect, it } from "vitest";

import {
  assertBrowserExecution,
  browserTestEvidence,
} from "./browser-test-evidence";

it("accounts for real installed Playwright list and execution identities without a browser", async () => {
  const require = createRequire(
    resolve(import.meta.dirname, "../apps/calculator/package.json"),
  );
  const playwright = require.resolve("@playwright/test");
  const directory = await mkdtemp(
    resolve(tmpdir(), "greendex-browser-reporter-"),
  );
  try {
    // Pin the temp dir to CommonJS: the generated spec uses require(),
    // and os.tmpdir() may sit under a "type": "module" package.json
    // (gateway TMPDIR). Without this the test inherits ambient ESM scope.
    await writeFile(
      resolve(directory, "package.json"),
      JSON.stringify({ type: "commonjs" }),
    );
    await writeFile(
      resolve(directory, "playwright.config.cjs"),
      'module.exports = { testDir: ".", reporter: "json", workers: 1, retries: 0 };',
    );
    await writeFile(
      resolve(directory, "identity.spec.ts"),
      `const {test, expect} = require(${JSON.stringify(playwright)}); test('source identity', () => { expect(1).toBe(1); });`,
    );
    const invoke = async (list: boolean) => {
      const output = resolve(directory, list ? "list.json" : "execution.json");
      await promisify(execFile)(
        process.execPath,
        [
          resolve(dirname(playwright), "cli.js"),
          "test",
          "--config=playwright.config.cjs",
          ...(list ? ["--list"] : []),
        ],
        {
          cwd: directory,
          timeout: 30_000,
          env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: output },
        },
      );
      return browserTestEvidence(
        JSON.parse(await readFile(output, "utf8")),
        list,
      );
    };
    const discovery = await invoke(true);
    const execution = await invoke(false);
    expect(discovery.tests).toHaveLength(1);
    expect(execution.stats).toMatchObject({
      passed: 1,
      failed: 0,
      skipped: 0,
      flaky: 0,
    });
    expect(() => assertBrowserExecution(discovery, execution)).not.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
