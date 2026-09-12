import { describe, expect, it } from "vitest";

import { findForbiddenDatabaseImports } from "./check-cost-tracker-persistence-seam";

const fixture = (relativePath: string, content: string) => ({
  content,
  relativePath: `apps/cost-tracker/src/${relativePath}`,
});

describe("Cost Tracker persistence seam", () => {
  it("rejects database-client package roots, subpaths, and dynamic imports in routes and feature views", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "app/(protected)/projects/page.tsx",
          'import { db } from "@greendex/database";',
        ),
        fixture(
          "app/(protected)/projects/loading.tsx",
          'import { db } from "@greendex/database/client";',
        ),
        fixture(
          "features/projects/project-view-model.ts",
          'const database = await import("@greendex/database");',
        ),
        fixture(
          "components/project-list.tsx",
          'import { db } from "@greendex/database";',
        ),
        fixture(
          "app/api/example/route.ts",
          'import { db } from "@greendex/database";',
        ),
      ]),
    ).toEqual([
      "apps/cost-tracker/src/app/(protected)/projects/loading.tsx",
      "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
      "apps/cost-tracker/src/app/api/example/route.ts",
      "apps/cost-tracker/src/components/project-list.tsx",
      "apps/cost-tracker/src/features/projects/project-view-model.ts",
    ]);
  });

  it("follows local aliases and re-export chains that expose the database client", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "lib/database-client.ts",
          'import { db as client } from "@greendex/database/client";\nexport { client as db };',
        ),
        fixture(
          "lib/cost-tracker-database.ts",
          'export { db } from "@/lib/database-client";',
        ),
        fixture(
          "app/(protected)/projects/page.tsx",
          'import { db } from "@/lib/cost-tracker-database";',
        ),
        fixture(
          "features/projects/project-view-model.ts",
          'const database = await import("@/lib/cost-tracker-database");',
        ),
      ]),
    ).toEqual([
      "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
      "apps/cost-tracker/src/features/projects/project-view-model.ts",
    ]);
  });

  it("ignores import-like text in comments and string literals", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "app/(protected)/projects/page.tsx",
          [
            '// import { db } from "@greendex/database";',
            'const example = \'export { db } from "@greendex/database/client";\';',
            'const dynamicExample = `import("@greendex/database")`;',
            "export { example, dynamicExample };",
          ].join("\n"),
        ),
      ]),
    ).toEqual([]);
  });

  it("detects dynamic imports nested beside import.meta or inside exported initializers", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "app/(protected)/projects/page.tsx",
          'const modules = [import.meta.url, import("@greendex/database")];',
        ),
        fixture(
          "features/projects/project-view-model.ts",
          'export const database = import("@greendex/database/client");',
        ),
      ]),
    ).toEqual([
      "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
      "apps/cost-tracker/src/features/projects/project-view-model.ts",
    ]);
  });

  it("rejects routes that consume a database client re-exported by a permitted owner", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "features/projects/project-detail-procedure.ts",
          'export { db } from "@greendex/database";',
        ),
        fixture(
          "lib/auth.ts",
          [
            'import { db } from "@greendex/database/client";',
            "export { db };",
          ].join("\n"),
        ),
        fixture(
          "app/(protected)/projects/page.tsx",
          'import { db as procedureDb } from "@/features/projects/project-detail-procedure";',
        ),
        fixture(
          "features/projects/project-view-model.ts",
          'import { db as authDb } from "@/lib/auth";',
        ),
      ]),
    ).toEqual([
      "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
      "apps/cost-tracker/src/features/projects/project-view-model.ts",
    ]);
  });

  it("allows feature procedures, Better Auth, schema-only imports, and test fixtures", () => {
    expect(
      findForbiddenDatabaseImports([
        fixture(
          "features/projects/project-detail-procedure.ts",
          'import { db } from "@greendex/database";',
        ),
        fixture("lib/auth.ts", 'import { db } from "@greendex/database";'),
        fixture(
          "app/(protected)/projects/page.tsx",
          'import { auth } from "@/lib/auth";',
        ),
        fixture(
          "features/user-settings/project-view-model.ts",
          'import { user } from "@greendex/database/schema";',
        ),
        fixture(
          "features/projects/project-detail-procedure.integration.test.ts",
          'import { db } from "@greendex/database";',
        ),
      ]),
    ).toEqual([]);
  });
});
