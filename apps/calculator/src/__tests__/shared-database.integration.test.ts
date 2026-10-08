import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const imports = `
import { db } from "@greendex/database/client";
import { organization, projectsTable, projectParticipantsTable, participantJourneysTable } from "@greendex/database/schema";
import { eq } from "drizzle-orm";
`;

function runInApp(app: string, script: string): string {
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
      `${imports}\n(async () => { try { ${script} } finally { await global.__pool?.end(); } })().catch(() => { console.error("Shared database fixture failed"); process.exitCode = 1; });`,
    ],
    { cwd: resolve("../../apps", app), encoding: "utf8", timeout: 15_000 },
  ).trim();
}

describe("shared Calculator and Cost Tracker database", () => {
  it("reads identical domain IDs and observes writes from both app environments", () => {
    const id = `shared-db-${randomUUID()}`;
    const fixture = JSON.stringify(id);
    try {
      runInApp(
        "calculator",
        `
        await db.transaction(async (tx) => {
          await tx.insert(organization).values({ id: ${fixture}, name: "Shared DB fixture", slug: ${fixture}, country: "DE", createdAt: new Date() });
          await tx.insert(projectsTable).values({ id: ${fixture}, name: "Shared DB fixture", organizationId: ${fixture}, startDate: new Date(), endDate: new Date(), location: "Berlin", country: "DE" });
          await tx.insert(projectParticipantsTable).values({ id: ${fixture}, projectId: ${fixture}, representedOrganizationId: ${fixture}, displayName: "Shared participant" });
          await tx.insert(participantJourneysTable).values({ id: ${fixture}, projectParticipantId: ${fixture}, origin: "Berlin", destination: "Paris", tripType: "round-trip", erasmusDistanceKm: "1000" });
        });
      `,
      );
      const read = `
        const rows = await db.select({ organizationId: organization.id, projectId: projectsTable.id, participationId: projectParticipantsTable.id, journeyId: participantJourneysTable.id, destination: participantJourneysTable.destination })
          .from(organization)
          .innerJoin(projectsTable, eq(projectsTable.organizationId, organization.id))
          .innerJoin(projectParticipantsTable, eq(projectParticipantsTable.projectId, projectsTable.id))
          .innerJoin(participantJourneysTable, eq(participantJourneysTable.projectParticipantId, projectParticipantsTable.id))
          .where(eq(organization.id, ${fixture}));
        console.log(JSON.stringify(rows));
      `;
      const expected = [
        {
          organizationId: id,
          projectId: id,
          participationId: id,
          journeyId: id,
          destination: "Paris",
        },
      ];
      expect(
        JSON.parse(
          runInApp(
            "cost-tracker",
            `${read}
await db.update(participantJourneysTable).set({ destination: "Munich" }).where(eq(participantJourneysTable.id, ${fixture}));`,
          ),
        ),
      ).toEqual(expected);
      expect(
        JSON.parse(
          runInApp(
            "calculator",
            `${read}
await db.update(participantJourneysTable).set({ destination: "Hamburg" }).where(eq(participantJourneysTable.id, ${fixture}));`,
          ),
        ),
      ).toEqual([{ ...expected[0], destination: "Munich" }]);
      expect(JSON.parse(runInApp("cost-tracker", read))).toEqual([
        { ...expected[0], destination: "Hamburg" },
      ]);
    } finally {
      runInApp(
        "calculator",
        `
        await db.delete(projectParticipantsTable).where(eq(projectParticipantsTable.id, ${fixture}));
        await db.delete(projectsTable).where(eq(projectsTable.id, ${fixture}));
        await db.delete(organization).where(eq(organization.id, ${fixture}));
      `,
      );
    }
  }, 60_000);
});
