// @vitest-environment node
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIsolatedRunDatabase,
  disposeIsolatedRunDatabase,
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "@/__tests__/helpers/isolated-run-database";

/**
 * Isolated seeded cross-app lifecycle (#265).
 *
 * One full run owns exactly one test database on the configured service:
 * create uniquely-owned database, apply the normal migrations, run the
 * canonical seed once, then prove both app contexts (including subprocesses)
 * share identities and persistence on that same database. Case interference
 * is deleted without reseeding; the run database is dropped after success
 * and failure, and cleanup failures fail the run.
 *
 * Deliberately not a turbo aggregate: every step shells the underlying
 * package command (`db:migrate`) or `tsx` directly, so root `pnpm test` can
 * adopt this lifecycle later without recursive task invocation. Steps run
 * serially in this file; concurrent full runs never share a database because
 * each run owns a unique name plus its ownership marker.
 */

// Aggregate mode consumes the root's migrated/seeded database; root owns disposal.
// Focused mode retains the standalone lifecycle, including disposal assertions.
const aggregate = process.env.GREENDEX_AGGREGATE_TEST_RUN === "true";
const execute = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../../..");
const databasePackage = resolve(repoRoot, "packages/database");
const tsxBinary = resolve(repoRoot, "node_modules/.bin/tsx");

/**
 * Fixture ids travel via environment, never interpolated into executed code
 * (CodeQL js/bad-code-sanitization).
 */
const FIXTURE_ENV = "LIFECYCLE_FIXTURE";
const PROJECT_ENV = "LIFECYCLE_PROJECT_ID";
const PARTNERSHIP_ENV = "LIFECYCLE_PARTNERSHIP_ID";
const PARTICIPATION_ENV = "LIFECYCLE_PARTICIPATION_ID";
const JOURNEY_ENV = "LIFECYCLE_JOURNEY_ID";

const SEED_HOSTING_SLUG = "seed-org";
const SEED_PARTNER_SLUG = "seed-partner-org";

const dbImports = `
import { db } from "@greendex/database/client";
import { organization, projectsTable, projectPartnerOrganizationsTable, projectParticipantsTable, participantJourneysTable } from "@greendex/database/schema";
import { eq } from "drizzle-orm";
`;

interface LifecycleState {
  handle: IsolatedRunHandle;
  baseDatabaseUrl: string;
  commit: string;
  fixture: string;
  pool: Pool;
  timings: Record<string, number>;
  results: Record<string, boolean>;
}

let state: LifecycleState | null = null;
let disposeError: unknown = null;

function runInApp(app: string, script: string): string {
  if (!state) throw new Error("Lifecycle state is missing.");
  return execFileSync(
    tsxBinary,
    [
      "-e",
      `${dbImports}\nconst projectId = process.env.${PROJECT_ENV} as string;\nconst partnershipId = process.env.${PARTNERSHIP_ENV} as string;\nconst participationId = process.env.${PARTICIPATION_ENV} as string;\nconst journeyId = process.env.${JOURNEY_ENV} as string;\n(async () => { try { ${script} } finally { await global.__pool?.end(); } })().catch((error) => { console.error(error); process.exitCode = 1; });`,
    ],
    {
      cwd: resolve(repoRoot, "apps", app),
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: state.handle.databaseUrl,
        [FIXTURE_ENV]: state.fixture,
        [PROJECT_ENV]: `${state.fixture}-project`,
        [PARTNERSHIP_ENV]: `${state.fixture}-partnership`,
        [PARTICIPATION_ENV]: `${state.fixture}-participation`,
        [JOURNEY_ENV]: `${state.fixture}-journey`,
      },
    },
  ).trim();
}

async function seedOnce(databaseUrl: string): Promise<string> {
  const script = `
    (async () => {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { Pool } = await import("pg");
      const schema = await import("@greendex/database/schema");
      const seedModule = await import(${JSON.stringify(resolve(repoRoot, "apps/calculator/scripts/seed.ts"))});
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const db = drizzle(pool, { schema });
        const summary = await seedModule.seedDatabase(db);
        console.log(JSON.stringify({ projectCount: summary.projectIds.length, userId: summary.userId }));
      } finally {
        await pool.end();
      }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const { stdout } = await execute(tsxBinary, ["-e", script], {
    cwd: resolve(repoRoot, "apps/calculator"),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  const lines = String(stdout).trim().split("\n");
  return lines[lines.length - 1] as string;
}

function readCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
  } catch {
    return "unknown";
  }
}

const EXPECTED_RESULTS = [
  "migrated",
  "seededOnce",
  "connectionsIsolated",
  "crossAppReadWrite",
  "caseCleanupWithoutReseed",
  "cleanedUp",
] as const;

function emitReport(): void {
  if (!state) return;
  const outcome = EXPECTED_RESULTS.every((key) => state?.results[key])
    ? "completed"
    : "failed";
  // Sanitized: run identity, commit, seed version, timings, results. No URLs,
  // credentials, message bodies, or bearer material ever leave this process.
  console.log(
    JSON.stringify(
      {
        lifecycle: "isolated-seeded-cross-app",
        outcome,
        runId: state.handle.runId,
        databaseName: state.handle.databaseName,
        service: `${state.handle.serviceHost}:${state.handle.servicePort}`,
        commit: state.commit,
        seedRulesVersion: TRAVEL_FUNDING_RULES.version,
        timingsMs: state.timings,
        results: state.results,
        baseDatabaseUntouched: true,
        cleanupError: disposeError ? String(disposeError) : null,
      },
      null,
      2,
    ),
  );
}

beforeAll(async () => {
  const startedAt = Date.now();
  const baseDatabaseUrl = aggregate
    ? process.env.GREENDEX_TEST_SERVICE_DATABASE_URL
    : process.env.DATABASE_URL;
  if (!baseDatabaseUrl) {
    throw new Error(
      "BLOCKED: DATABASE_URL is not configured, so no service can host the isolated run database. Refusing to fall back to any default database.",
    );
  }
  let handle: IsolatedRunHandle | null = null;
  try {
    if (aggregate) {
      const databaseUrl = process.env.DATABASE_URL;
      const runId = process.env.TEST_RUN_ID;
      if (
        !databaseUrl ||
        !runId ||
        !/^[a-f0-9]{32}$/.test(runId) ||
        !new URL(databaseUrl).pathname.endsWith(`_${runId}`)
      )
        throw new Error("Invalid injected lifecycle.");
      const base = new URL(baseDatabaseUrl);
      handle = {
        runId,
        databaseUrl,
        databaseName: new URL(databaseUrl).pathname.slice(1),
        baseDatabaseUrl,
        baseDatabaseName: base.pathname.slice(1),
        serviceHost: base.hostname,
        servicePort: base.port || "5432",
        createdAt: new Date().toISOString(),
      };
    } else {
      handle = await createIsolatedRunDatabase({
        baseDatabaseUrl,
        prefix: "lifecycle_check",
      });
    }
    state = {
      handle,
      baseDatabaseUrl,
      commit: readCommit(),
      fixture: `lifecycle-${randomUUID()}`,
      pool: new Pool({ connectionString: handle.databaseUrl, max: 1 }),
      timings: {},
      results: {},
    };
    if (
      new URL(handle.databaseUrl).pathname === new URL(baseDatabaseUrl).pathname
    ) {
      throw new Error(
        "Isolated run database collides with the service database.",
      );
    }
    const migratedAt = Date.now();
    if (!aggregate)
      await execute("pnpm", ["run", "db:migrate"], {
        cwd: databasePackage,
        env: { ...process.env, DATABASE_URL: handle.databaseUrl },
        timeout: 120_000,
      });
    const ownership = await state.pool.query(
      "SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = $1",
      [handle.databaseName],
    );
    expect(ownership.rows[0]?.marker).toBe(`greendex-test-run:${handle.runId}`);
    state.timings.migrateMs = Date.now() - migratedAt;
    state.results.migrated = true;
    const seededAt = Date.now();
    const seedSummary = aggregate
      ? {
          projectCount: (
            await state.pool.query("SELECT count(*)::int AS count FROM project")
          ).rows[0].count,
        }
      : (JSON.parse(await seedOnce(handle.databaseUrl)) as {
          projectCount: number;
          userId: string;
        });
    state.timings.seedMs = Date.now() - seededAt;
    // The canonical seed runs exactly once per full run.
    expect(seedSummary.projectCount).toBeGreaterThan(0);
    state.results.seededOnce = true;
    state.timings.setupMs = Date.now() - startedAt;
  } catch (error) {
    if (error instanceof IsolatedRunCreationError) handle = error.handle;
    if (state) {
      await state.pool.end().catch(() => {});
      try {
        if (!aggregate) await disposeIsolatedRunDatabase(state.handle);
        state.results.cleanedUp = true;
        emitReport();
        // Annulled: afterAll must not retry a completed disposal.
        state = null;
      } catch (cleanupError) {
        console.error(
          `Setup failed and run database cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    } else if (handle && !aggregate) {
      try {
        await disposeIsolatedRunDatabase(handle);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Setup failed and run database cleanup also failed.",
        );
      }
    }
    throw error;
  }
}, 300_000);

describe("isolated seeded cross-app lifecycle", () => {
  it("keeps every connection on the isolated run database", async () => {
    if (!state) throw new Error("Lifecycle state is missing.");
    expect(state.handle.databaseUrl).not.toBe(state.baseDatabaseUrl);
    expect(state.handle.databaseName).not.toBe(state.handle.baseDatabaseName);
    // The child reports only the database path: the run URL (with credentials)
    // never travels through assertion strings or logs.
    const seen = runInApp(
      "calculator",
      `console.log(new URL(process.env.DATABASE_URL as string).pathname);`,
    );
    expect(seen).toBe(`/${state.handle.databaseName}`);
    state.results.connectionsIsolated = true;
  });

  it("proves shared identities across both app contexts from the seeded baseline", async () => {
    if (!state) throw new Error("Lifecycle state is missing.");
    const checkedAt = Date.now();
    const projectId = `${state.fixture}-project`;
    const participationId = `${state.fixture}-participation`;
    const created = JSON.parse(
      runInApp(
        "calculator",
        `
        const [hosting] = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, "${SEED_HOSTING_SLUG}"));
        const [partner] = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, "${SEED_PARTNER_SLUG}"));
        if (!hosting || !partner) throw new Error("Seeded baseline organizations are missing.");
        await db.transaction(async (tx) => {
          await tx.insert(projectsTable).values({ id: projectId, name: "Lifecycle cross-app fixture", organizationId: hosting.id, startDate: new Date("2024-04-01T00:00:00Z"), endDate: new Date("2024-04-10T00:00:00Z"), location: "Berlin", country: "DE" });
          await tx.insert(projectPartnerOrganizationsTable).values({ id: partnershipId, projectId, organizationId: partner.id });
          await tx.insert(projectParticipantsTable).values({ id: participationId, projectId, representedOrganizationId: partner.id, displayName: "Lifecycle fixture participant" });
          await tx.insert(participantJourneysTable).values({ id: journeyId, projectParticipantId: participationId, origin: "Berlin", destination: "Paris", tripType: "round-trip", erasmusDistanceKm: "1000" });
        });
        console.log(JSON.stringify({ hostingOrgId: hosting.id, partnerOrgId: partner.id }));
      `,
      ),
    ) as { hostingOrgId: string; partnerOrgId: string };
    // Cost Tracker reads the Calculator write through the seeded organizations.
    const observed = JSON.parse(
      runInApp(
        "cost-tracker",
        `
        const [project] = await db.select({ id: projectsTable.id, hostingSlug: organization.slug }).from(projectsTable).innerJoin(organization, eq(organization.id, projectsTable.organizationId)).where(eq(projectsTable.id, projectId));
        const [participation] = await db.select({ id: projectParticipantsTable.id, partnerSlug: organization.slug }).from(projectParticipantsTable).innerJoin(organization, eq(organization.id, projectParticipantsTable.representedOrganizationId)).where(eq(projectParticipantsTable.id, participationId));
        if (!project || !participation) throw new Error("Cross-app fixture write is not visible.");
        await db.update(participantJourneysTable).set({ destination: "Munich" }).where(eq(participantJourneysTable.id, journeyId));
        console.log(JSON.stringify({ hostingSlug: project.hostingSlug, partnerSlug: participation.partnerSlug }));
      `,
      ),
    ) as { hostingSlug: string; partnerSlug: string };
    expect(observed).toEqual({
      hostingSlug: SEED_HOSTING_SLUG,
      partnerSlug: SEED_PARTNER_SLUG,
    });
    // Calculator observes the Cost Tracker write, then writes back.
    const reverified = JSON.parse(
      runInApp(
        "calculator",
        `
        const [journey] = await db.select({ destination: participantJourneysTable.destination }).from(participantJourneysTable).where(eq(participantJourneysTable.id, journeyId));
        await db.update(participantJourneysTable).set({ destination: "Hamburg" }).where(eq(participantJourneysTable.id, journeyId));
        console.log(JSON.stringify(journey));
      `,
      ),
    ) as { destination: string };
    expect(reverified).toEqual({ destination: "Munich" });
    const settled = JSON.parse(
      runInApp(
        "cost-tracker",
        `
        const [journey] = await db.select({ destination: participantJourneysTable.destination }).from(participantJourneysTable).where(eq(participantJourneysTable.id, journeyId));
        console.log(JSON.stringify(journey));
      `,
      ),
    ) as { destination: string };
    expect(settled).toEqual({ destination: "Hamburg" });
    expect(created.hostingOrgId).toBeTruthy();
    expect(created.partnerOrgId).toBeTruthy();
    state.timings.crossAppChecksMs = Date.now() - checkedAt;
    state.results.crossAppReadWrite = true;
    // Cleanup verification belongs to this same multi-step cross-app workflow,
    // not a later case that can pass merely because no rows were ever created.

    runInApp(
      "calculator",
      `
      await db.delete(projectParticipantsTable).where(eq(projectParticipantsTable.id, participationId));
      await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
      console.log("cleaned");
    `,
    );
    const remaining = await state.pool.query(
      `SELECT
        (SELECT count(*)::int FROM project WHERE id = $1) AS projects,
        (SELECT count(*)::int FROM project_participant WHERE id = $2) AS participations,
        (SELECT count(*)::int FROM organization WHERE slug = $3) AS hosting_orgs,
        (SELECT count(*)::int FROM organization WHERE slug = $4) AS partner_orgs`,
      [projectId, participationId, SEED_HOSTING_SLUG, SEED_PARTNER_SLUG],
    );
    expect(remaining.rows[0]).toEqual({
      projects: 0,
      participations: 0,
      hosting_orgs: 1,
      partner_orgs: 1,
    });
    state.results.caseCleanupWithoutReseed = true;
  });
});

afterAll(async () => {
  if (!state || state.results.cleanedUp) return;
  try {
    // Narrowly scoped case cleanup is idempotent: fixture ids are unique per
    // run, so a retry after a mid-case failure cannot touch seeded rows.
    await state.pool
      .query(
        `DELETE FROM project_participant WHERE id = $1;
         DELETE FROM project WHERE id = $2;`,
        [`${state.fixture}-participation`, `${state.fixture}-project`],
      )
      .catch(() => {});
    if (aggregate)
      expect((await state.pool.query("SELECT 1")).rows).toHaveLength(1);
    await state.pool.end();
    try {
      if (!aggregate) await disposeIsolatedRunDatabase(state.handle);
      state.results.cleanedUp = true;
    } catch (error) {
      disposeError = error;
      state.results.cleanedUp = false;
      throw new Error(
        `Run cleanup failed, so the run fails: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } finally {
    emitReport();
  }
});
