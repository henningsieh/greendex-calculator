import { describe, expect, it } from "vitest";

import { findForbiddenDatabaseImports } from "./check-cost-tracker-persistence-seam.mjs";

describe("Cost Tracker persistence seam", () => {
  it("rejects direct database-client imports from route and view modules", () => {
    expect(
      findForbiddenDatabaseImports([
        {
          content: 'import { db } from "@greendex/database";',
          relativePath: "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
        },
        {
          content: 'import { db } from "@greendex/database";',
          relativePath:
            "apps/cost-tracker/src/features/projects/components/projects-list.tsx",
        },
      ]),
    ).toEqual([
      "apps/cost-tracker/src/app/(protected)/projects/page.tsx",
      "apps/cost-tracker/src/features/projects/components/projects-list.tsx",
    ]);
  });

  it("allows procedure persistence, Better Auth, schemas, and test fixtures", () => {
    expect(
      findForbiddenDatabaseImports([
        {
          content: 'import { db } from "@greendex/database";',
          relativePath: "apps/cost-tracker/src/features/projects/procedures.ts",
        },
        {
          content: 'import { db } from "@greendex/database";',
          relativePath: "apps/cost-tracker/src/lib/auth.ts",
        },
        {
          content: 'import { user } from "@greendex/database/schema";',
          relativePath:
            "apps/cost-tracker/src/features/user-settings/validation-schemas.ts",
        },
        {
          content: 'import { db } from "@greendex/database";',
          relativePath:
            "apps/cost-tracker/src/features/projects/procedures.integration.test.ts",
        },
      ]),
    ).toEqual([]);
  });
});
