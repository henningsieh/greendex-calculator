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
const schemaFile = "apps/cost-tracker/src/features/example/validation-schemas.ts";
const procedureFile =
  "apps/cost-tracker/src/features/example/procedures/example.ts";
const rule = "greendex-domain(validation-schema-location)";
const identifierRule = "greendex-domain(schema-derived-identifier)";
const inputRule = "greendex-domain(procedure-input-schema)";

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
          {
            files: ["apps/*/src/**/validation-schemas.ts"],
            rules: { "greendex-domain/schema-derived-identifier": "warn" },
          },
          {
            files: [
              "apps/*/src/features/**/procedures.ts",
              "apps/*/src/features/**/procedures/**/*.ts",
            ],
            rules: { "greendex-domain/procedure-input-schema": "warn" },
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

function findings(output: string, ruleId = rule) {
  return output.split("\n").filter((line) => line.includes(ruleId));
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

  it("reports a named zod builder import", () => {
    const result = lint(
      [
        'import { email, object } from "zod";',
        "export const schema = object({",
        '  email: email("invalid"),',
        "});",
      ].join("\n"),
    );
    expect(result.status).toBe(0);
    const reported = findings(result.output);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain(`${scopedFile}:2:`);
  });

  it("reports an ISO datetime builder", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const createdAt = z.iso.datetime();",
      ].join("\n"),
    );
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

describe("greendex-domain/schema-derived-identifier", () => {
  it("reports hand-written identifier validation in a schema module", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const InputSchema = z.object({",
        "  id: z.string(),",
        "  projectId: z.string().trim().min(1).max(128),",
        "});",
      ].join("\n"),
      schemaFile,
    );
    expect(result.status).toBe(0);
    const reported = findings(result.output, identifierRule);
    expect(reported).toHaveLength(2);
    expect(reported[0]).toContain(`${schemaFile}:3:`);
    expect(reported[1]).toContain(`${schemaFile}:4:`);
  });

  it("reports nested and refined identifier chains once each", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const DetailSchema = z.object({",
        "  hostingOrganization: z.object({ id: z.string(), name: z.string() }),",
        "  completedByUserId: z.string().nullable(),",
        "});",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(2);
  });

  it("allows identifiers derived from the table schema", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        'import { ProjectIdSchema } from "@/features/projects/validation-schemas";',
        "export const InputSchema = z.object({",
        "  projectId: ProjectIdSchema,",
        "  id: projectsTable.shape.id,",
        "  organizationId: persistedSelectSchema.shape.organizationId,",
        "});",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(0);
  });

  it("ignores non-identifier keys that end in other letters", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const InputSchema = z.object({",
        "  name: z.string(),",
        "  grid: z.string(),",
        "  valid: z.string(),",
        "  ids: z.array(z.string()),",
        "});",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(0);
  });

  it("reports a standalone identifier schema declaration", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const CoordinationIdSchema = z.string().trim().min(1).max(128);",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(1);
    expect(findings(result.output, identifierRule)[0]).toContain(
      "`CoordinationIdSchema`",
    );
  });

  it("allows a hand-built base piped into a derived schema", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        'import { ProjectIdSchema } from "@/features/projects/validation-schemas";',
        "export const InputSchema = z.object({",
        "  projectId: z.string().trim().pipe(ProjectIdSchema),",
        "  id: z.string(),",
        "});",
      ].join("\n"),
      schemaFile,
    );
    const reported = findings(result.output, identifierRule);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain(`${schemaFile}:5:`);
  });

  it("allows schemas derived from the table column", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        'import { createSelectSchema } from "drizzle-zod";',
        "export const ProjectIdSchema = createSelectSchema(projectsTable)",
        "  .shape.id.trim()",
        "  .min(1)",
        "  .max(128);",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(0);
  });

  it("does not treat an object wrapper named *IdSchema as an identifier", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const ClaimPartnershipIdSchema = z.object({",
        "  partnershipId: CoordinationIdSchema,",
        "});",
      ].join("\n"),
      schemaFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(0);
  });

  it("stays silent outside schema modules", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const local = z.object({ id: z.string() });",
      ].join("\n"),
      scopedFile,
    );
    expect(findings(result.output, identifierRule)).toHaveLength(0);
  });
});

describe("greendex-domain/procedure-input-schema", () => {
  it("reports an input schema declared inline", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const procedure = authorized",
        "  .input(z.object({ partnershipId: z.string() }))",
        "  .handler(async () => undefined);",
      ].join("\n"),
      procedureFile,
    );
    expect(result.status).toBe(0);
    const reported = findings(result.output, inputRule);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain(`${procedureFile}:3:`);
  });

  it("reports a chained builder passed to input", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const procedure = authorized",
        "  .input(z.object({ id: z.string() }).extend({ note: z.string() }))",
        "  .handler(async () => undefined);",
      ].join("\n"),
      procedureFile,
    );
    expect(findings(result.output, inputRule)).toHaveLength(1);
  });

  it("accepts shared and derived input schemas", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const a = authorized.input(CreateSetupLinkInputSchema);",
        "export const b = authorized.input(claimColumns.pick({ id: true }));",
        "export const c = authorized.input(",
        "  createSelectSchema(claimsTable).pick({ id: true }),",
        ");",
      ].join("\n"),
      procedureFile,
    );
    expect(findings(result.output, inputRule)).toHaveLength(0);
  });

  it("does not report output schemas", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const procedure = authorized",
        "  .input(ClaimInputSchema)",
        "  .output(z.object({ id: z.string() }));",
      ].join("\n"),
      procedureFile,
    );
    expect(findings(result.output, inputRule)).toHaveLength(0);
  });

  it("matches only procedure modules", () => {
    const result = lint(
      [
        'import { z } from "zod";',
        "export const procedure = authorized.input(z.object({ id: z.string() }));",
      ].join("\n"),
      scopedFile,
    );
    expect(findings(result.output, inputRule)).toHaveLength(0);
  });
});
