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

describe("greendex/one-translator-source", () => {
  it.each([
    ["@greendex/i18n/client", "useTranslations", ""],
    ["next-intl", "useTranslations", ""],
    ["@greendex/i18n/server", "getTranslations", "await "],
    ["next-intl/server", "getTranslations", "await "],
  ])("checks direct and aliased imports from %s", (module, name, awaited) => {
    const source = (second: string) =>
      [
        `import { ${name}, ${name} as translate } from "${module}";`,
        `async function First() { const t = ${awaited}${name}("claims"); return <p>{t("title")}</p>; }`,
        `async function Second() { const t = ${awaited}translate("${second}"); return <p>{t("title")}</p>; }`,
      ].join("\n");
    expect(lint(source("claims")).status).toBe(0);
    const result = lint(source("claims.document"));
    expect(result.status).toBe(1);
    expect(result.output).toContain("greendex(one-translator-source)");
    expect(result.output).toContain(
      "Use one distinct translator namespace per UI file.",
    );
    expect(result.output).toContain(`${scopedFile}:3:`);
  });

  it("reports a reintroduced secondary binding across client and server imports", () => {
    const result = lint(
      [
        'import { useTranslations } from "@greendex/i18n/client";',
        'import { getTranslations } from "@greendex/i18n/server";',
        'function View() { const t = useTranslations("partnerships"); }',
        'async function Setup() { const tSetup = await getTranslations("partnerships.setup"); }',
      ].join("\n"),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "Use one distinct translator namespace per UI file.",
    );
    expect(result.output).toContain('Bind the translator as "t".');
  });

  it.each([
    "namespace",
    "`claims`",
    "`claims.${area}`",
    '"claims" + area',
    '{ namespace: "claims" }',
    '""',
    "",
    '"claims", options',
  ])("rejects a nonliteral or missing namespace in %s", (argument) => {
    const result = lint(
      [
        'import { useTranslations } from "@greendex/i18n/client";',
        `function View() { const t = useTranslations(${argument}); return <p>{t("title")}</p>; }`,
      ].join("\n"),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain("greendex(one-translator-source)");
    expect(result.output).toContain(
      "Pass one non-empty namespace string literal",
    );
  });

  it.each([
    'const tPart = useTranslations("claims");',
    'const { t } = useTranslations("claims");',
    'return useTranslations("claims");',
    'const tSetup = await getTranslations("partnerships.setup");',
  ])("requires the canonical binding for %s", (declaration) => {
    const result = lint(
      [
        'import { useTranslations } from "@greendex/i18n/client";',
        'import { getTranslations } from "@greendex/i18n/server";',
        `async function View() { ${declaration} }`,
      ].join("\n"),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('Bind the translator as "t".');
  });

  it("accepts awaited and type-wrapped canonical bindings", () => {
    const result = lint(
      [
        'import { getTranslations as translate } from "@greendex/i18n/server";',
        'async function View() { const t = (await translate("claims")) as Translator; return <p>{t("title")}</p>; }',
      ].join("\n"),
    );
    expect(result.status).toBe(0);
  });

  it("ignores comments, unused imports, unrelated functions and shadowed imports", () => {
    const result = lint(
      [
        'import { useTranslations } from "@greendex/i18n/client";',
        'import { getTranslations } from "another-library";',
        '// useTranslations("foreign"); getTranslations("other");',
        'const example = "useTranslations(\\"foreign\\")";',
        'function View(useTranslations) { const tPart = useTranslations(dynamic); return <p>{tPart("title")}</p>; }',
        "const arbitrary = getTranslations(dynamic);",
      ].join("\n"),
    );
    expect(result.status).toBe(0);
    expect(result.output).not.toContain("greendex(one-translator-source)");
  });

  it.each([
    "apps/cost-tracker/src/features/example.test.tsx",
    "apps/cost-tracker/src/features/example.spec.jsx",
    "apps/cost-tracker/src/features/example.stories.tsx",
    "apps/cost-tracker/src/features/__tests__/example.tsx",
    "apps/cost-tracker/src/features/components/ui/example.tsx",
    "apps/calculator/src/example.tsx",
    "apps/cost-tracker/example.tsx",
    "apps/cost-tracker/src/features/example.ts",
  ])("preserves the existing UI exclusions for %s", (file) => {
    const result = lint(
      [
        'import { useTranslations } from "@greendex/i18n/client";',
        "function View() { const tOther = useTranslations(dynamic); }",
      ].join("\n"),
      file,
    );
    expect(result.status).toBe(0);
    expect(result.output).not.toContain("greendex(one-translator-source)");
  });
});
