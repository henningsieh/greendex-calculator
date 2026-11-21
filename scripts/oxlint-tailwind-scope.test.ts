import { spawnSync } from "node:child_process";
import {
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
    const config = JSON.parse(
      readFileSync(join(root, "oxlint.tailwind.json"), "utf8"),
    );
    config.options = { typeAware: false };
    const tailwindScope = config.overrides.find(
      (override: { rules?: Record<string, unknown> }) =>
        override.rules?.["better-tailwindcss/no-duplicate-classes"] === "error",
    );
    for (const rule of [
      "no-duplicate-classes",
      "enforce-canonical-classes",
      "no-deprecated-classes",
      "no-unnecessary-whitespace",
    ]) {
      const setting = tailwindScope.rules[`better-tailwindcss/${rule}`];
      expect(Array.isArray(setting) ? setting[0] : setting).toBe("error");
    }
    // Tailwind's canonicalizeCandidates returns its input unchanged without
    // `rem`, so a missing rootFontSize silently disables every canonical fix.
    const canonical =
      tailwindScope.rules["better-tailwindcss/enforce-canonical-classes"];
    expect(canonical[1]?.rootFontSize).toBe(16);
    // Collapse (`mt-2 mb-2` -> `my-2`) removes classes and leaves whitespace
    // behind, so the autofix needs two passes to reach a fixed point. Collapse
    // is not an editor diagnostic, but it must stay on: turning it off would
    // silently stop the gate merging classes at all.
    expect(canonical[1]?.collapse).toBe(true);
    // Only the duplicate rule stays active: the canonical rule resolves the
    // whole design system per file and would make this scope test dominate the
    // unit suite.
    config.overrides.push({
      files: ["**/*.{ts,tsx}"],
      rules: {
        "better-tailwindcss/enforce-canonical-classes": "off",
        "better-tailwindcss/no-deprecated-classes": "off",
      },
    });
    writeFileSync(join(fixture, "oxlint.tailwind.json"), JSON.stringify(config));
    for (const file of [...uiFiles, ...excludedFiles]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      writeFileSync(
        join(fixture, file),
        file.endsWith(".tsx")
          ? 'export const view = <div className="p-2 p-2" />;\n'
          : 'export const className = "p-2 p-2";\n',
      );
    }
    const result = spawnSync(
      join(root, "node_modules/.bin/oxlint"),
      [
        "--threads=1",
        "--config",
        "oxlint.tailwind.json",
        ...uiFiles,
        ...excludedFiles,
      ],
      { cwd: fixture, encoding: "utf8", timeout: 120_000 },
    );
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    expect(result.status).toBe(1);
    const diagnostics = output.split(/\n\s*\n/);
    for (const file of uiFiles) {
      expect(
        diagnostics.some(
          (diagnostic) =>
            diagnostic.includes(file) &&
            diagnostic.includes("better-tailwindcss(no-duplicate-classes)"),
        ),
        `expected a no-duplicate-classes diagnostic for ${file}`,
      ).toBe(true);
    }
    expect(output).not.toContain("Internal error");
    for (const file of excludedFiles) {
      expect(
        diagnostics.some((diagnostic) => diagnostic.includes(file)),
        `expected no diagnostic for excluded file ${file}`,
      ).toBe(false);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 130_000);
