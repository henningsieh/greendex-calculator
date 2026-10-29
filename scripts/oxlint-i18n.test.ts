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
const scopedFile = "apps/cost-tracker/src/features/example.tsx";

function lint(source: string, file = scopedFile) {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-i18n-"));
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
            override.rules?.["greendex/no-hardcoded-ui-copy"] !== undefined,
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
      {
        cwd: fixture,
        encoding: "utf8",
      },
    );
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function copies(output: string) {
  return [...output.matchAll(/Hardcoded UI copy "([^"]*)"/g)].map(
    (match) => match[1],
  );
}

describe("greendex/no-hardcoded-ui-copy", () => {
  it("reports rendered branches and exact literal locations", () => {
    const source = [
      'const view = <>{revoke.isPending ? t("pending") : "Revoke Group Organizer assignment"}',
      '{a ? (b ? "Nested one" : "Nested two") : "Outer"}',
      '{condition && "And"}{value || "Or"}{value ?? "Nullish"}',
      '{"Prefix " + name + " suffix"}{`Hello ${name} again`}',
      '{`${flag ? "Inside" : "Alternative"}`}{("Wrapped" as string)!}</>;',
    ].join("\n");
    const result = lint(source);
    expect(result.status).toBe(1);
    expect(copies(result.output)).toEqual([
      "Revoke Group Organizer assignment",
      "Nested one",
      "Nested two",
      "Outer",
      "And",
      "Or",
      "Nullish",
      "Prefix",
      "suffix",
      "Hello",
      "again",
      "Inside",
      "Alternative",
      "Wrapped",
    ]);
    expect(result.output).toContain(
      `${scopedFile}:1:51: error greendex(no-hardcoded-ui-copy)`,
    );
  });

  it("checks visible attributes on HTML, components and SVG", () => {
    const result = lint(
      [
        'const view = <><input aria-description="Direct" placeholder={"Wrapped"} />',
        '<Widget title={ready ? "Yes" : "No"} label={`Hello ${name} friend`} />',
        '<svg aria-description={ready ? "Vector" : `Icon ${name} description`} /></>;',
      ].join("\n"),
    );
    expect(result.status).toBe(1);
    expect(copies(result.output)).toEqual([
      "Direct",
      "Wrapped",
      "Yes",
      "No",
      "Hello",
      "friend",
      "Vector",
      "Icon",
      "description",
    ]);
  });

  it("ignores translations, controls, technical values and decoration", () => {
    const result = lint(
      [
        'const view = <div id="technical" className="styles" data-testid="target"',
        ' title={t("key")} aria-label={tPart("key")} >',
        '{status === "active" ? t("active") : t("inactive")}',
        '{flag && t("label")}{user.name}{count}{123}{"— &nbsp;"} !!!',
        "</div>;",
      ].join("\n"),
    );
    expect(result.status).toBe(0);
    expect(copies(result.output)).toEqual([]);
  });

  it("supports native inline disable comments", () => {
    const result = lint(
      "// oxlint-disable-next-line greendex/no-hardcoded-ui-copy\nconst view = <p>Allowed copy</p>;",
    );
    expect(result.status).toBe(0);
    expect(copies(result.output)).toEqual([]);
  });

  it("checks rendered arrays and ignores escaped template whitespace", () => {
    const result = lint(
      'const view = <>{["Array copy", flag ? "Nested array copy" : t("key")]}{`\\n`}</>;',
    );
    expect(result.status).toBe(1);
    expect(copies(result.output)).toEqual(["Array copy", "Nested array copy"]);
  });

  it.each([
    "apps/cost-tracker/src/features/example.test.tsx",
    "apps/cost-tracker/src/features/example.spec.jsx",
    "apps/cost-tracker/src/features/example.stories.tsx",
    "apps/cost-tracker/src/features/__tests__/example.tsx",
    "apps/cost-tracker/src/features/components/ui/example.tsx",
    "apps/cost-tracker/src/components/ui/example.tsx",
    "apps/calculator/src/example.tsx",
    "apps/cost-tracker/example.tsx",
  ])("excludes %s", (file) => {
    const result = lint("const view = <p>Excluded copy</p>;", file);
    if (file === "apps/cost-tracker/src/components/ui/example.tsx") {
      expect(result.status).toBe(1);
      expect(result.output).toContain("No files found to lint");
    } else {
      expect(result.status).toBe(0);
    }
    expect(copies(result.output)).toEqual([]);
  });
});
