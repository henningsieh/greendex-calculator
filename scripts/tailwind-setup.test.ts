import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, it } from "vitest";

import {
  TAILWIND_CONFIG_FILE,
  isTailwindSourcePath,
  tailwindOxlintArgs,
} from "./tailwind-config.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

it("builds every Tailwind Oxlint invocation from one config", () => {
  expect(TAILWIND_CONFIG_FILE).toBe("oxlint.tailwind.json");
  expect(tailwindOxlintArgs()).toEqual([
    "--config",
    "oxlint.tailwind.json",
    "apps",
    "packages",
  ]);
  expect(
    tailwindOxlintArgs({ fix: true, files: ["apps/calculator/src/a.tsx"] }),
  ).toEqual([
    "--config",
    "oxlint.tailwind.json",
    "--fix",
    "apps/calculator/src/a.tsx",
  ]);
});

it("derives Tailwind source scope from the shared config", () => {
  expect(isTailwindSourcePath("apps/cost-tracker/src/components/a.tsx")).toBe(
    true,
  );
  expect(isTailwindSourcePath("packages/auth/src/a.tsx")).toBe(true);
  expect(
    isTailwindSourcePath("apps/cost-tracker/src/components/ui/button.tsx"),
  ).toBe(false);
  expect(
    isTailwindSourcePath("apps/cost-tracker/src/components/a.unit.test.tsx"),
  ).toBe(false);
  expect(isTailwindSourcePath("scripts/a.ts")).toBe(false);
});

it("routes lint, CLI, watcher and pre-commit through the shared setup", () => {
  const lint = read("scripts/tailwind-lint.ts");
  const cli = read("scripts/canonicalize-tailwind.ts");
  const watcher = read("scripts/watch-tailwind-canonical.ts");
  const preCommit = read("scripts/pre-commit.mjs");

  for (const source of [lint, cli, watcher, preCommit]) {
    expect(source).toContain("./tailwind-config.mjs");
  }
  for (const source of [lint, cli, watcher]) {
    expect(source).toContain('"./tailwind-canonical"');
  }
  for (const source of [lint, cli, watcher]) {
    expect(source).not.toContain("canonicalizeCandidates");
  }
  expect(preCommit).toContain("scripts/canonicalize-tailwind.ts");
  expect(preCommit).toContain("tailwindOxlintArgs");
});

it("keeps save-time Tailwind fixes in the watcher, not VS Code code actions", () => {
  const settings = read(".vscode/settings.json");
  const extensions = read(".vscode/extensions.json");

  expect(settings).toContain('"source.fixAll.oxc": "always"');
  expect(settings).toContain('"source.fixAll.tailwindcss": "always"');
  expect(settings).toContain('"tailwindCSS.codeActions": true');
  expect(settings).toContain('"tailwindCSS.validate": true');
  expect(extensions).not.toContain("tailwind-canonical-fixer");
});
