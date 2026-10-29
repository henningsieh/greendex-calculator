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

import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

it("limits Tailwind rules to production UI sources in all owning contexts", () => {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-tailwind-scope-"));
  const uiFiles = [
    "apps/calculator/src/features/scope-probe.tsx",
    "apps/cost-tracker/src/features/scope-probe.tsx",
    "apps/documentation/src/components/scope-probe.tsx",
    "packages/auth/src/scope-probe.tsx",
    "packages/email/src/scope-probe.tsx",
  ];
  const excludedFiles = [
    "apps/calculator/src/features/scope-probe.test.tsx",
    "apps/cost-tracker/src/__tests__/scope-probe.tsx",
    "apps/documentation/src/components/scope-probe.stories.tsx",
    "apps/calculator/src/app/api/scope-probe.ts",
    "packages/database/src/scope-probe.ts",
    "scripts/scope-probe.ts",
  ];
  try {
    mkdirSync(join(fixture, "scripts"));
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    copyFileSync(
      join(root, "scripts/oxlint-i18n.mjs"),
      join(fixture, "scripts/oxlint-i18n.mjs"),
    );
    const config = JSON.parse(readFileSync(join(root, ".oxlintrc.json"), "utf8"));
    config.options.typeAware = false;
    const tailwindScope = config.overrides.find(
      (override: { rules?: Record<string, unknown> }) =>
        override.rules?.["better-tailwindcss/no-conflicting-classes"] === "error",
    );
    for (const rule of [
      "no-duplicate-classes",
      "enforce-canonical-classes",
      "no-deprecated-classes",
    ]) {
      expect(tailwindScope.rules[`better-tailwindcss/${rule}`]).toBe("error");
    }
    config.overrides.push({
      files: ["**/*.{ts,tsx}"],
      rules: {
        "better-tailwindcss/no-duplicate-classes": "off",
        "better-tailwindcss/enforce-canonical-classes": "off",
        "better-tailwindcss/no-deprecated-classes": "off",
      },
    });
    writeFileSync(join(fixture, ".oxlintrc.json"), JSON.stringify(config));
    for (const file of [...uiFiles, ...excludedFiles]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      writeFileSync(
        join(fixture, file),
        file.endsWith(".tsx")
          ? 'export const view = <div className="p-2 p-4" />;\n'
          : 'export const className = "p-2 p-4";\n',
      );
    }
    const result = spawnSync(
      join(root, "node_modules/.bin/oxlint"),
      ["--threads=1", "--config", ".oxlintrc.json", ...uiFiles, ...excludedFiles],
      { cwd: fixture, encoding: "utf8", timeout: 120_000 },
    );
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    expect(result.status).toBe(1);
    for (const file of uiFiles) {
      expect(output).toContain(`${file}:`);
      expect(output).toMatch(
        new RegExp(
          `${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:.*better-tailwindcss\\(no-conflicting-classes\\)`,
        ),
      );
    }
    expect(output).not.toContain("Internal error");
    for (const file of excludedFiles) expect(output).not.toContain(`${file}:`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 130_000);
