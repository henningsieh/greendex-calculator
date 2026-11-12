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
const scopedFile =
  "apps/cost-tracker/src/features/example/components/example-form.tsx";
const rule = "greendex-domain(validation-schema-location)";

function lint(source: string, file = scopedFile) {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-domain-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    copyFileSync(
      join(root, "scripts/oxlint-domain.mjs"),
      join(fixture, "scripts/oxlint-domain.mjs"),
    );
    writeFileSync(
      join(fixture, ".oxlintrc.json"),
      JSON.stringify({
        jsPlugins: ["./scripts/oxlint-domain.mjs"],
        overrides: [
          {
            files: ["apps/*/src/features/**/components/**/*.{ts,tsx}"],
            rules: { "greendex-domain/validation-schema-location": "warn" },
          },
        ],
      }),
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

function findings(output: string) {
  return output.split("\n").filter((line) => line.includes(rule));
}

describe("greendex-domain/validation-schema-location", () => {
  it("reports a schema defined in a feature component", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const schema = z.object({",
        '  email: z.email("invalid"),',
        '  password: z.string().min(6, "short"),',
        "});",
      ].join("\n"),
    );
    expect(result.status).toBe(0);
    expect(findings(result.output)).toHaveLength(1);
    expect(findings(result.output)[0]).toContain(`${scopedFile}:2:`);
  });

  it("reports one finding per schema expression, not per nested builder", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const schema = z",
        "  .object({",
        '    name: z.string().min(1, "required"),',
        '    email: z.email("invalid"),',
        "  })",
        '  .refine((data) => data.name.length > 0, { message: "empty" });',
      ].join("\n"),
    );
    expect(findings(result.output)).toHaveLength(1);
  });

  it("ignores composition of imported schemas and resolver wiring", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        'import { zodResolver } from "@hookform/resolvers/zod";',
        'import { CreateSetupLinkInputSchema } from "@/features/x/validation-schemas";',
        "const narrowed = CreateSetupLinkInputSchema.pick({ projectId: true });",
        'const parsed = CreateSetupLinkInputSchema.parse({ projectId: "p" });',
        "type Values = z.infer<typeof CreateSetupLinkInputSchema>;",
        "const resolver = zodResolver(CreateSetupLinkInputSchema);",
        "export const view = [narrowed, parsed, resolver];",
      ].join("\n"),
    );
    expect(result.status).toBe(0);
    expect(findings(result.output)).toHaveLength(0);
  });

  it("ignores a local z that is not the zod module", () => {
    const result = lint(
      [
        "const z = {",
        "  object: (value: unknown) => value,",
        '  string: () => ({ min: () => "x" }),',
        "};",
        "export const schema = z.object({ name: z.string() });",
      ].join("\n"),
    );
    expect(findings(result.output)).toHaveLength(0);
  });

  it("allows schema modules outside component paths", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const CreateSetupLinkInputSchema = z.object({",
        '  recipientEmail: z.email("invalid"),',
        "});",
      ].join("\n"),
      "apps/cost-tracker/src/features/example/validation-schemas.ts",
    );
    expect(findings(result.output)).toHaveLength(0);
  });
});
