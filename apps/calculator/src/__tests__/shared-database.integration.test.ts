import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { db } from "@greendex/database";
import {
  organization,
  projectParticipantsTable,
  projectsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const imports = `
import { db } from "@greendex/database/client";
import { organization, projectsTable, projectParticipantsTable, participantJourneysTable } from "@greendex/database/schema";
import { eq, and } from "drizzle-orm";
`;

// Fixture values travel via environment, never interpolated into the
// executed code string (CodeQL js/bad-code-sanitization).
const FIXTURE_ENV = "SHARED_DB_FIXTURE";
const SEED_ORG_ENV = "SHARED_DB_SEED_ORG";
const SEED_PROJECT_ENV = "SHARED_DB_SEED_PROJECT";

/**
 * Canonical seed identities (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Both app environments must observe
 * the same seeded Organization, Project, and showcase Journey rows —
 * shared records, not two separately generated lookalike datasets. The
 * only case-owned row is a Journey-free Participation, removed afterwards.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_SHOWCASE_PROJECT_NAME = "Carbon Footprint Workshop";

function runInApp(
  app: string,
  script: string,
  extraEnv: Record<string, string> = {},
): string {
  return execFileSync(
    "./node_modules/.bin/dotenv",
    [
      "-e",
      "../../packages/database/.env",
      "-e",
      ".env",
      "--",
      "../../node_modules/.bin/tsx",
      "-e",
      `${imports}\nconst fixture = process.env.${FIXTURE_ENV} as string;\n(async () => { try { ${script} } finally { await global.__pool?.end(); } })().catch(() => { console.error("Shared database fixture failed"); process.exitCode = 1; });`,
    ],
    {
      cwd: resolve("../../apps", app),
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env, ...extraEnv },
    },
  ).trim();
}

describe("shared Calculator and Cost Tracker database", () => {
  it("reads identical canonical domain IDs and observes writes from both app environments", async () => {
    const seedOrg = await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    });
    if (!seedOrg) throw new Error("Canonical seed Organization is missing");
    const showcase = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.organizationId, seedOrg.id),
        eq(projectsTable.name, SEED_SHOWCASE_PROJECT_NAME),
      ),
    });
    if (!showcase) throw new Error("Canonical showcase Project is missing");
    const id = `shared-db-${randomUUID()}`;
    const caseEmail = `${id}@example.org`;
    const env = {
      [FIXTURE_ENV]: id,
      [SEED_ORG_ENV]: seedOrg.id,
      [SEED_PROJECT_ENV]: showcase.id,
    };
    try {
      runInApp(
        "calculator",
        `
        await db.insert(projectParticipantsTable).values({ id: fixture, projectId: process.env.${SEED_PROJECT_ENV}, representedOrganizationId: process.env.${SEED_ORG_ENV}, displayName: "Shared participant", email: fixture + "@example.org" });
      `,
        env,
      );
      const read = `
        const orgs = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, "${SEED_ORG_SLUG}"));
        const projects = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.organizationId, process.env.${SEED_ORG_ENV}), eq(projectsTable.name, "${SEED_SHOWCASE_PROJECT_NAME}")));
        const journeys = await db.select({ destination: participantJourneysTable.destination }).from(participantJourneysTable).innerJoin(projectParticipantsTable, eq(participantJourneysTable.projectParticipantId, projectParticipantsTable.id)).where(and(eq(projectParticipantsTable.projectId, process.env.${SEED_PROJECT_ENV}), eq(projectParticipantsTable.email, "owner@sieh.org")));
        const cases = await db.select({ participationId: projectParticipantsTable.id, displayName: projectParticipantsTable.displayName }).from(projectParticipantsTable).where(eq(projectParticipantsTable.id, fixture));
        console.log(JSON.stringify({ orgs, projects, journeys, cases }));
      `;
      const expectedCases = [
        { participationId: id, displayName: "Shared participant" },
      ];
      const calculatorRead = JSON.parse(runInApp("calculator", read, env));
      expect(calculatorRead.orgs).toEqual([{ id: seedOrg.id }]);
      expect(calculatorRead.projects).toEqual([{ id: showcase.id }]);
      expect(calculatorRead.journeys).toEqual([{ destination: "Berlin" }]);
      expect(calculatorRead.cases).toEqual(expectedCases);
      // Cost Tracker observes the identical canonical rows plus the case write.
      expect(JSON.parse(runInApp("cost-tracker", read, env))).toEqual(
        calculatorRead,
      );
      runInApp(
        "cost-tracker",
        `
        await db.update(projectParticipantsTable).set({ displayName: "Shared participant renamed" }).where(eq(projectParticipantsTable.id, fixture));
      `,
        env,
      );
      const renamed = JSON.parse(runInApp("calculator", read, env));
      expect(renamed.cases).toEqual([
        { participationId: id, displayName: "Shared participant renamed" },
      ]);
      expect(renamed.orgs).toEqual([{ id: seedOrg.id }]);
      expect(renamed.projects).toEqual([{ id: showcase.id }]);
      expect(renamed.journeys).toEqual([{ destination: "Berlin" }]);
    } finally {
      await db
        .delete(projectParticipantsTable)
        .where(eq(projectParticipantsTable.email, caseEmail));
    }
  }, 60_000);
});
