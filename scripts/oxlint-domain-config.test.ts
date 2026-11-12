import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
function lint(app: string, source: string, component = false) {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-domain-config-"));
  try {
    const file = `apps/${app}/src/features/example/${component ? "components/example-form.tsx" : "validation-schemas.ts"}`;
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    mkdirSync(join(fixture, "scripts"));
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    for (const name of ["oxlint-domain.mjs", "oxlint-i18n.mjs"])
      copyFileSync(join(root, "scripts", name), join(fixture, "scripts", name));
    copyFileSync(join(root, ".oxlintrc.json"), join(fixture, ".oxlintrc.json"));
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

describe("repository identifier rule configuration", () => {
  const invalid =
    'import { z } from "zod";\n\nexport const schema = z.object({ projectId: z.string() });';
  const derived =
    'import { z } from "zod";\nimport { ProjectIdSchema } from "./other";\n\nexport const schema = z.object({ projectId: ProjectIdSchema });';
  it.each([
    ["cost-tracker", 1, "error"],
    ["calculator", 0, "warn"],
  ])("reports an identifier %s as %s", (app, status, severity) => {
    const result = lint(app, invalid);
    expect(result.status, result.output).toBe(status);
    expect(result.output).toContain("greendex-domain(schema-derived-identifier)");
    expect(result.output).toContain(
      `${severity === "warn" ? "warning" : "error"} greendex-domain(schema-derived-identifier)`,
    );
  });
  it.each(["cost-tracker", "calculator"])(
    "accepts a derived identifier in %s",
    (app) => {
      const result = lint(app, derived);
      expect(result.status, result.output).toBe(0);
      expect(result.output).not.toContain(
        "greendex-domain(schema-derived-identifier)",
      );
    },
  );
});

describe("repository component schema location rule", () => {
  it.each(["calculator", "cost-tracker"])(
    "rejects an inline schema in %s",
    (app) => {
      const result = lint(
        app,
        'import { z } from "zod";\n\nexport const schema = z.object({ email: z.email() });',
        true,
      );
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain(
        "error greendex-domain(validation-schema-location)",
      );
    },
  );

  it.each(["calculator", "cost-tracker"])(
    "accepts an imported factory in %s",
    (app) => {
      const result = lint(
        app,
        'import { createSchema } from "@/features/example/validation-schemas";\n\nexport const schema = createSchema();',
        true,
      );
      expect(result.status, result.output).toBe(0);
      expect(result.output).not.toContain(
        "greendex-domain(validation-schema-location)",
      );
    },
  );
});
