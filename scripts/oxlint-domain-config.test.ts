import { describe, expect, it } from "vitest";

import { byCode, lint, severities } from "./oxlint-fixture";

const identifier = "greendex-domain(schema-derived-identifier)";
const location = "greendex-domain(validation-schema-location)";
const input = "greendex-domain(procedure-input-schema)";
const apps = ["calculator", "cost-tracker"] as const;
const procedurePaths = ["procedures.ts", "procedures/example.ts"] as const;

/**
 * Severity wiring from the repository config: the same violation is an error in
 * Cost Tracker and a warning in Calculator. The exit status carries that
 * severity, so it is the assertion — not a word in a reporter's output.
 */
describe("repository lint configuration", () => {
  it.each([
    ["cost-tracker", 1, "error"],
    ["calculator", 0, "warning"],
  ] as const)(
    "scores an inline identifier in %s as %s",
    (app, status, severity) => {
      const result = lint({
        app,
        source:
          'import { z } from "zod";\n\nexport const schema = z.object({ projectId: z.string() });',
      });
      expect(result.status).toBe(status);
      expect(severities(result.diagnostics, identifier)).toEqual([severity]);
    },
  );

  it.each(apps)("accepts a derived identifier in %s", (app) => {
    const result = lint({
      app,
      source:
        'import { z } from "zod";\nimport { ProjectIdSchema } from "./other";\n\nexport const schema = z.object({ projectId: ProjectIdSchema });',
    });
    expect(byCode(result.diagnostics, identifier)).toEqual([]);
  });

  it.each(apps)("rejects an inline component schema in %s", (app) => {
    const result = lint({
      app,
      file: "components/example-form.tsx",
      source:
        'import { z } from "zod";\n\nexport const schema = z.object({ email: z.email() });',
    });
    expect(result.status).toBe(1);
    expect(severities(result.diagnostics, location)).toEqual(["error"]);
  });

  it.each(apps)("accepts an imported component factory in %s", (app) => {
    const result = lint({
      app,
      file: "components/example-form.tsx",
      source:
        'import { createSchema } from "@/features/example/validation-schemas";\n\nexport const schema = createSchema();',
    });
    expect(byCode(result.diagnostics, location)).toEqual([]);
  });

  it.each(
    apps.flatMap((app) => procedurePaths.map((file) => [app, file] as const)),
  )("rejects inline procedure input in %s %s", (app, file) => {
    for (const inline of [
      "z.object({ id: z.string() })",
      "z.object({ id: z.string() }).optional()",
    ]) {
      const result = lint({
        app,
        file,
        source: `import { z } from "zod";\n\nexport const procedure = authorized.input(${inline});`,
      });
      expect(result.status).toBe(1);
      expect(severities(result.diagnostics, input)).toEqual(["error"]);
    }
  });

  it.each(
    apps.flatMap((app) => procedurePaths.map((file) => [app, file] as const)),
  )("accepts imported procedure input in %s %s", (app, file) => {
    const result = lint({
      app,
      file,
      source:
        'import { z } from "zod";\nimport { InputSchema } from "@/features/example/validation-schemas";\n\nexport const procedure = authorized.input(InputSchema).output(z.object({ id: z.string() }));',
    });
    expect(byCode(result.diagnostics, input)).toEqual([]);
  });
});
