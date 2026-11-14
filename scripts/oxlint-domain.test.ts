import { describe, expect, it } from "vitest";

import { byCode, lines, lint } from "./oxlint-fixture";

const location = "greendex-domain(validation-schema-location)";
const identifier = "greendex-domain(schema-derived-identifier)";
const input = "greendex-domain(procedure-input-schema)";

const componentFile = "components/example-form.tsx";
const schemaFile = "validation-schemas.ts";
const procedureFile = "procedures/example.ts";

/** Every rule reports as a warning here, so one run shows what the plugin does. */
const warnEverywhere = {
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
};

const run = (source: string[], file = componentFile) =>
  lint({ source: source.join("\n"), file, config: warnEverywhere });

describe("greendex-domain/validation-schema-location", () => {
  it("reports a schema defined in a feature component", () => {
    const result = run([
      'import { z } from "zod";',
      "export const schema = z.object({",
      '  email: z.email("invalid"),',
      '  password: z.string().min(6, "short"),',
      "});",
    ]);
    expect(
      result.diagnostics.map(({ code, filename, line }) => ({
        code,
        filename,
        line,
      })),
    ).toEqual([
      {
        code: location,
        filename: `apps/cost-tracker/src/features/example/${componentFile}`,
        line: 2,
      },
    ]);
  });

  it("reports a named zod builder import", () => {
    const result = run([
      'import { email, object } from "zod";',
      "export const schema = object({",
      '  email: email("invalid"),',
      "});",
    ]);
    expect(lines(result.diagnostics, location)).toEqual([2]);
  });

  it("reports an ISO datetime builder", () => {
    const result = run([
      'import { z } from "zod";',
      "export const createdAt = z.iso.datetime();",
    ]);
    expect(lines(result.diagnostics, location)).toEqual([2]);
  });

  it("reports one finding per schema expression, not per nested builder", () => {
    const result = run([
      'import { z } from "zod";',
      "export const schema = z",
      "  .object({",
      '    name: z.string().min(1, "required"),',
      '    email: z.email("invalid"),',
      "  })",
      '  .refine((data) => data.name.length > 0, { message: "empty" });',
    ]);
    expect(lines(result.diagnostics, location)).toHaveLength(1);
  });

  it("ignores composition of imported schemas and resolver wiring", () => {
    const result = run([
      'import { z } from "zod";',
      'import { zodResolver } from "@hookform/resolvers/zod";',
      'import { CreateSetupLinkInputSchema } from "@/features/x/validation-schemas";',
      "const narrowed = CreateSetupLinkInputSchema.pick({ projectId: true });",
      'const parsed = CreateSetupLinkInputSchema.parse({ projectId: "p" });',
      "type Values = z.infer<typeof CreateSetupLinkInputSchema>;",
      "const resolver = zodResolver(CreateSetupLinkInputSchema);",
      "export const view = [narrowed, parsed, resolver];",
    ]);
    expect(result.status).toBe(0);
    expect(byCode(result.diagnostics, location)).toEqual([]);
  });

  it("ignores a local z that is not the zod module", () => {
    const result = run([
      "const z = {",
      "  object: (value: unknown) => value,",
      '  string: () => ({ min: () => "x" }),',
      "};",
      "export const schema = z.object({ name: z.string() });",
    ]);
    expect(byCode(result.diagnostics, location)).toEqual([]);
  });

  it("allows schema modules outside component paths", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const CreateSetupLinkInputSchema = z.object({",
        '  recipientEmail: z.email("invalid"),',
        "});",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, location)).toEqual([]);
  });
});

describe("greendex-domain/schema-derived-identifier", () => {
  it("reports hand-written identifier validation in a schema module", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const InputSchema = z.object({",
        "  id: z.string(),",
        "  projectId: z.string().trim().min(1).max(128),",
        "});",
      ],
      schemaFile,
    );
    expect(lines(result.diagnostics, identifier)).toEqual([3, 4]);
  });

  it("reports nested and refined identifier chains once each", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const DetailSchema = z.object({",
        "  hostingOrganization: z.object({ id: z.string(), name: z.string() }),",
        "  completedByUserId: z.string().nullable(),",
        "});",
      ],
      schemaFile,
    );
    expect(lines(result.diagnostics, identifier)).toHaveLength(2);
  });

  it("allows identifiers derived from the table schema", () => {
    const result = run(
      [
        'import { z } from "zod";',
        'import { ProjectIdSchema } from "@/features/projects/validation-schemas";',
        "export const InputSchema = z.object({",
        "  projectId: ProjectIdSchema,",
        "  id: projectsTable.shape.id,",
        "  organizationId: persistedSelectSchema.shape.organizationId,",
        "});",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });

  it("ignores non-identifier keys that end in other letters", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const InputSchema = z.object({",
        "  name: z.string(),",
        "  grid: z.string(),",
        "  valid: z.string(),",
        "  ids: z.array(z.string()),",
        "});",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });

  it("reports a standalone identifier schema declaration", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const CoordinationIdSchema = z.string().trim().min(1).max(128);",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, identifier)).toHaveLength(1);
    expect(byCode(result.diagnostics, identifier)[0].message).toContain(
      "CoordinationIdSchema",
    );
  });

  it("allows a hand-built base piped into a derived schema", () => {
    const result = run(
      [
        'import { z } from "zod";',
        'import { ProjectIdSchema } from "@/features/projects/validation-schemas";',
        "export const InputSchema = z.object({",
        "  projectId: z.string().trim().pipe(ProjectIdSchema),",
        "  id: z.string(),",
        "});",
      ],
      schemaFile,
    );
    expect(lines(result.diagnostics, identifier)).toEqual([5]);
  });

  it("allows schemas derived from the table column", () => {
    const result = run(
      [
        'import { z } from "zod";',
        'import { createSelectSchema } from "drizzle-zod";',
        "export const ProjectIdSchema = createSelectSchema(projectsTable)",
        "  .shape.id.trim()",
        "  .min(1)",
        "  .max(128);",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });

  it("does not treat an object wrapper named *IdSchema as an identifier", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const ClaimPartnershipIdSchema = z.object({",
        "  partnershipId: CoordinationIdSchema,",
        "});",
      ],
      schemaFile,
    );
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });

  it("stays silent outside schema modules", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const local = z.object({ id: z.string() });",
      ],
      componentFile,
    );
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });
});

describe("greendex-domain/procedure-input-schema", () => {
  it("reports an input schema declared inline", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const procedure = authorized",
        "  .input(z.object({ partnershipId: z.string() }))",
        "  .handler(async () => undefined);",
      ],
      procedureFile,
    );
    expect(lines(result.diagnostics, input)).toEqual([3]);
  });

  it("reports a chained builder passed to input", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const procedure = authorized",
        "  .input(z.object({ id: z.string() }).extend({ note: z.string() }))",
        "  .handler(async () => undefined);",
      ],
      procedureFile,
    );
    expect(lines(result.diagnostics, input)).toHaveLength(1);
  });

  it("accepts shared and derived input schemas", () => {
    const result = run(
      [
        'import { z } from "zod";',
        "export const a = authorized.input(CreateSetupLinkInputSchema);",
        "export const b = authorized.input(claimColumns.pick({ id: true }));",
        "export const c = authorized.input(",
        "  createSelectSchema(claimsTable).pick({ id: true }),",
        ");",
      ],
      procedureFile,
    );
    expect(byCode(result.diagnostics, input)).toEqual([]);
  });
});
