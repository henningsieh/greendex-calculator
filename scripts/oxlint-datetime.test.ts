import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const rule = "greendex/no-raw-date-formatting";

function lint(source: string, file = "apps/calculator/src/features/example.tsx") {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-datetime-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    const config = JSON.parse(readFileSync(join(root, ".oxlintrc.json"), "utf8"));
    writeFileSync(
      join(fixture, ".oxlintrc.json"),
      JSON.stringify({
        ignorePatterns: config.ignorePatterns,
        jsPlugins: ["./scripts/oxlint-i18n.mjs"],
        overrides: config.overrides.filter(
          (override: { rules?: Record<string, unknown> }) =>
            override.rules?.[rule] !== undefined,
        ),
      }),
    );
    copyFileSync(
      join(root, "scripts/oxlint-i18n.mjs"),
      join(fixture, "scripts/oxlint-i18n.mjs"),
    );
    writeFileSync(join(fixture, file), source);
    const result = spawnSync(
      join(root, "node_modules/.bin/oxlint"),
      ["--config", ".oxlintrc.json", file],
      { cwd: fixture, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe(rule, () => {
  it("reports Intl date formatters", () => {
    for (const name of [
      "DateTimeFormat",
      "RelativeTimeFormat",
      "DurationFormat",
    ]) {
      const result = lint(`export const f = new Intl.${name}("en-GB");`);
      expect(result.status).toBe(1);
      expect(result.output).toContain(name);
    }
  });

  it("reports Intl formatters called without new", () => {
    const result = lint('export const f = Intl.DateTimeFormat("en-GB");');
    expect(result.status).toBe(1);
    expect(result.output).toContain("DateTimeFormat");
  });

  it("reports Date toLocale methods", () => {
    for (const name of [
      "toLocaleDateString",
      "toLocaleString",
      "toLocaleTimeString",
    ]) {
      const result = lint(`export const s = new Date().${name}();`);
      expect(result.status).toBe(1);
      expect(result.output).toContain(name);
    }
  });

  it("allows the formatter module to own the Intl calls", () => {
    const result = lint(
      'export const f = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });',
      "packages/i18n/src/datetime/format.ts",
    );
    expect(result.status).toBe(0);
    expect(result.output).not.toContain(rule);
  });

  it("allows callers that use the named formatter", () => {
    const result = lint(
      'import { useDateFormat } from "@greendex/i18n/datetime/client";\nexport const view = () => useDateFormat().format("2025-12-28");',
    );
    expect(result.status).toBe(0);
  });
});
