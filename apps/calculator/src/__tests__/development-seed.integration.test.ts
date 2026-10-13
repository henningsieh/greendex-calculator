// @vitest-environment node
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { SEED_USER } from "@greendex/auth/seed-user";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import type { Pool } from "pg";
import { expect, it } from "vitest";

import { withDisposableDatabase } from "@/__tests__/helpers/disposable-database";

const execute = promisify(execFile);

/** Module path travels via environment, never interpolated into executed code. */
const SEED_MODULE_ENV = "SEED_MODULE_PATH";

interface CanonicalSeedIdentity {
  email: string;
  seedEmails: string[];
  organizationSlugs: string[];
  projectNames: string[];
  scenarios: {
    hostingOrganization: { slug: string };
    partnerOrganization: { slug: string };
    ownerUser: { email: string };
    adminUser: { email: string; hostingRole: string };
    coordinatorUser: { email: string; hostingRole: string };
    participantUser: { email: string; hostingRole: string };
    hybridAdminUser: { email: string; hostingRole: string };
    hybridCoordinatorUser: { email: string; hostingRole: string };
    outsiderUser: { email: string };
    creatorUser: { email: string };
    showcaseProject: { name: string };
    showcaseJourney: { origin: string; destination: string };
    showcaseClaim: { status: string };
  };
}

/**
 * Run the canonical seed module entrypoint in a fresh process, the same way
 * test setup consumes it: import the shared implementation against an
 * isolated database instead of shelling the development CLI.
 */
async function runSeedModule(
  databaseUrl: string,
  expression: string,
): Promise<string> {
  const calculatorDir = resolve(import.meta.dirname, "../..");
  const script = `
    (async () => {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { Pool } = await import("pg");
      const schema = await import("@greendex/database/schema");
      const seedModule = await import(process.env.${SEED_MODULE_ENV});
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const db = drizzle(pool, { schema });
        ${expression}
      } finally {
        await pool.end();
      }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const { stdout } = await execute("pnpm", ["exec", "tsx", "-e", script], {
    cwd: calculatorDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      [SEED_MODULE_ENV]: resolve(calculatorDir, "scripts/seed.ts"),
    },
  });
  // Seed progress lines share stdout; the machine-readable payload is the last line.
  const lines = String(stdout).trim().split("\n");
  return lines[lines.length - 1] as string;
}

async function readSeedIdentities(
  databaseUrl: string,
): Promise<CanonicalSeedIdentity> {
  const output = await runSeedModule(
    databaseUrl,
    `console.log(JSON.stringify({
      email: seedModule.SEED_USER.email,
      seedEmails: [seedModule.SEED_USER.email, ...seedModule.SEED_ORG_ROLE_EMAILS],
      organizationSlugs: [seedModule.SEED_ORGANIZATION.slug, seedModule.SEED_PARTNER_ORGANIZATION.slug],
      projectNames: seedModule.SEED_PROJECTS.map((project) => project.name),
      scenarios: seedModule.SEED_SCENARIOS,
    }));`,
  );
  return JSON.parse(output) as CanonicalSeedIdentity;
}

async function runModuleSeed(databaseUrl: string): Promise<{
  projectCount: number;
  travelLegsEnsured: number;
  userId: string;
  organizationId: string;
  partnerOrganizationId: string;
  projectIds: string[];
}> {
  const output = await runSeedModule(
    databaseUrl,
    `const summary = await seedModule.seedDatabase(db);
    console.log(JSON.stringify({
      projectCount: summary.projectIds.length,
      travelLegsEnsured: summary.travelLegsEnsured,
      userId: summary.userId,
      organizationId: summary.organizationId,
      partnerOrganizationId: summary.partnerOrganizationId,
      projectIds: summary.projectIds,
    }));`,
  );
  return JSON.parse(output) as {
    projectCount: number;
    travelLegsEnsured: number;
    userId: string;
    organizationId: string;
    partnerOrganizationId: string;
    projectIds: string[];
  };
}

it("seeds a shared Project, Participant Journey and allocated editable Claim from zero", async () => {
  await withDisposableDatabase("development_seed", async (pool, databaseUrl) => {
    const options = {
      cwd: resolve(import.meta.dirname, "../../../.."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    };
    await execute("pnpm", ["run", "db:migrate"], options);
    // Capture output: even legacy seeders must not leak login credentials into diagnostics.
    try {
      await execute("pnpm", ["run", "db:seed"], options);
    } catch {
      throw new Error("Development seed command failed");
    }
    const result = await pool.query(`
      SELECT hosting.slug AS hosting_slug, partner.slug AS partner_slug,
        p.name AS project_name, participant.display_name,
        journey.origin, journey.destination, journey.trip_type,
        journey.erasmus_distance_km, claim.status,
        entry.transport_profile, entry.amount_eur,
        allocation.amount_eur AS allocated_amount_eur,
        snapshot.rules_version, snapshot.participant_transport_profiles,
        (SELECT o.slug FROM member m JOIN organization o ON o.id = m.organization_id WHERE m.user_id = participant.user_id ORDER BY m.created_at DESC LIMIT 1) AS default_organization_slug,
        (SELECT count(*)::int FROM project_funding_band WHERE project_id = p.id) AS funding_bands,
        (SELECT count(*)::int FROM partner_coordinator_assignment WHERE partnership_id = partnership.id) AS partner_coordinators,
        (SELECT count(*)::int FROM member WHERE organization_id = partner.id AND role = 'owner') AS partner_owners
      FROM project p
      JOIN organization hosting ON hosting.id = p.organization_id
      JOIN project_partner_organization partnership ON partnership.project_id = p.id
      JOIN organization partner ON partner.id = partnership.organization_id
      JOIN project_participant participant ON participant.project_id = p.id AND participant.represented_organization_id = partner.id
      JOIN participant_journey journey ON journey.project_participant_id = participant.id
      JOIN claim ON claim.partnership_id = partnership.id
      JOIN travel_cost_entry entry ON entry.claim_id = claim.id
      JOIN cost_allocation allocation ON allocation.travel_cost_entry_id = entry.id AND allocation.project_participant_id = participant.id
      JOIN project_funding_snapshot snapshot ON snapshot.project_id = p.id
    `);
    expect(result.rows).toEqual([
      expect.objectContaining({
        default_organization_slug: "seed-org",
        hosting_slug: "seed-org",
        partner_slug: "seed-partner-org",
        project_name: "Carbon Footprint Workshop",
        origin: "Paris",
        destination: "Berlin",
        trip_type: "round-trip",
        erasmus_distance_km: "878.00",
        status: "editable",
        transport_profile: "train",
        amount_eur: "120.00",
        allocated_amount_eur: "120.00",
        rules_version: TRAVEL_FUNDING_RULES.version,
        participant_transport_profiles: [
          ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
        ],
        funding_bands: TRAVEL_FUNDING_RULES.bands.length,
        partner_coordinators: 1,
        partner_owners: 1,
      }),
    ]);
  });
}, 60_000);

interface SeedCounts {
  users: number;
  organizations: number;
  projects: number;
  travelLegs: number;
  partnerships: number;
  participations: number;
  journeys: number;
  claims: number;
}

async function readSeedCounts(
  pool: Pool,
  identities: CanonicalSeedIdentity,
): Promise<SeedCounts> {
  const result = await pool.query(
    `
    SELECT
      (SELECT count(*)::int FROM "user" WHERE email = ANY ($1)) AS users,
      (SELECT count(*)::int FROM organization WHERE slug = ANY ($2)) AS organizations,
      (SELECT count(*)::int FROM project WHERE name = ANY ($3)) AS projects,
      (SELECT count(*)::int FROM project_shared_travel_leg leg
        JOIN project p ON p.id = leg.project_id WHERE p.name = ANY ($3)) AS travel_legs,
      (SELECT count(*)::int FROM project_partner_organization partnership
        JOIN project p ON p.id = partnership.project_id
        JOIN organization o ON o.id = partnership.organization_id
        WHERE p.name = ANY ($3) AND o.slug = ANY ($2)) AS partnerships,
      (SELECT count(*)::int FROM project_participant participant
        JOIN project p ON p.id = participant.project_id
        WHERE p.name = ANY ($3) AND participant.email = $4) AS participations,
      (SELECT count(*)::int FROM participant_journey journey
        JOIN project_participant participant ON participant.id = journey.project_participant_id
        JOIN project p ON p.id = participant.project_id
        WHERE p.name = ANY ($3) AND participant.email = $4) AS journeys,
      (SELECT count(*)::int FROM claim
        JOIN project_partner_organization partnership ON partnership.id = claim.partnership_id
        JOIN project p ON p.id = partnership.project_id
        WHERE p.name = ANY ($3)) AS claims
    `,
    [
      identities.seedEmails,
      identities.organizationSlugs,
      identities.projectNames,
      identities.email,
    ],
  );
  const row = result.rows[0] as Record<string, string | number>;
  return {
    users: Number(row.users),
    organizations: Number(row.organizations),
    projects: Number(row.projects),
    travelLegs: Number(row.travel_legs),
    partnerships: Number(row.partnerships),
    participations: Number(row.participations),
    journeys: Number(row.journeys),
    claims: Number(row.claims),
  };
}

it("reuses one canonical seed across CLI and module runs without duplicates", async () => {
  await withDisposableDatabase("canonical_seed", async (pool, databaseUrl) => {
    const options = {
      cwd: resolve(import.meta.dirname, "../../../.."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    };
    await execute("pnpm", ["run", "db:migrate"], options);
    // First run through the normal development command: no credential leak.
    const cliResult = await execute("pnpm", ["run", "db:seed"], options);
    expect(`${cliResult.stdout}\n${cliResult.stderr}`).not.toContain(
      SEED_USER.password,
    );
    const identities = await readSeedIdentities(databaseUrl);
    expect(identities.email).toBe(SEED_USER.email);
    const countsAfterCliSeed = await readSeedCounts(pool, identities);
    expect(countsAfterCliSeed).toEqual({
      users: identities.seedEmails.length,
      organizations: 2,
      projects: identities.projectNames.length,
      travelLegs: countsAfterCliSeed.travelLegs,
      partnerships: 1,
      participations: 1,
      journeys: 1,
      claims: 1,
    });
    expect(countsAfterCliSeed.travelLegs).toBeGreaterThan(0);

    // Second run through the shared module entrypoint used by test setup.
    // The same implementation must converge instead of adding duplicates.
    const summary = await runModuleSeed(databaseUrl);
    expect(summary.projectCount).toBe(identities.projectNames.length);
    expect(await readSeedCounts(pool, identities)).toEqual(countsAfterCliSeed);

    // Every discoverable scenario reference resolves to its stable identity.
    const scenarios = await pool.query(
      `
      SELECT
        (SELECT id FROM organization WHERE slug = $1) AS hosting_org_id,
        (SELECT id FROM organization WHERE slug = $2) AS partner_org_id,
        (SELECT id FROM "user" WHERE email = $3) AS owner_user_id,
        (SELECT id FROM project WHERE name = $4) AS showcase_project_id,
        (SELECT participant.id FROM project_participant participant
          JOIN project p ON p.id = participant.project_id
          WHERE p.name = $4 AND participant.email = $3) AS showcase_participation_id,
        (SELECT journey.id FROM participant_journey journey
          JOIN project_participant participant ON participant.id = journey.project_participant_id
          JOIN project p ON p.id = participant.project_id
          WHERE p.name = $4 AND journey.origin = $5 AND journey.destination = $6) AS showcase_journey_id,
        (SELECT claim.id FROM claim
          JOIN project_partner_organization partnership ON partnership.id = claim.partnership_id
          JOIN project p ON p.id = partnership.project_id
          WHERE p.name = $4 AND claim.status = $7) AS showcase_claim_id
      `,
      [
        identities.scenarios.hostingOrganization.slug,
        identities.scenarios.partnerOrganization.slug,
        identities.scenarios.ownerUser.email,
        identities.scenarios.showcaseProject.name,
        identities.scenarios.showcaseJourney.origin,
        identities.scenarios.showcaseJourney.destination,
        identities.scenarios.showcaseClaim.status,
      ],
    );
    const resolved = scenarios.rows[0] as Record<string, string | null>;
    for (const [key, value] of Object.entries(resolved)) {
      expect(value, `scenario reference ${key}`).not.toBeNull();
    }
    expect(summary.userId).toBe(resolved.owner_user_id);
    expect(summary.organizationId).toBe(resolved.hosting_org_id);
    expect(summary.partnerOrganizationId).toBe(resolved.partner_org_id);
    expect(summary.projectIds).toContain(resolved.showcase_project_id);

    // Named Hosting Organization role actors resolve to seeded Memberships;
    // the outsider stays membership-free for denied/creation scenarios.
    const roleActors = await pool.query(
      `
      SELECT u.email, m.role, m.organization_id AS organization_id
      FROM "user" u LEFT JOIN member m
        ON m.user_id = u.id
        AND m.organization_id = $1
      WHERE u.email = ANY ($2)
      `,
      [resolved.hosting_org_id, identities.seedEmails],
    );
    const roleByEmail = new Map(
      roleActors.rows.map((row) => [
        row.email as string,
        row.role as string | null,
      ]),
    );
    expect(roleByEmail.get(identities.scenarios.adminUser.email)).toBe(
      identities.scenarios.adminUser.hostingRole,
    );
    expect(roleByEmail.get(identities.scenarios.coordinatorUser.email)).toBe(
      identities.scenarios.coordinatorUser.hostingRole,
    );
    expect(roleByEmail.get(identities.scenarios.participantUser.email)).toBe(
      identities.scenarios.participantUser.hostingRole,
    );
    expect(roleByEmail.get(identities.scenarios.hybridAdminUser.email)).toBe(
      identities.scenarios.hybridAdminUser.hostingRole,
    );
    expect(
      roleByEmail.get(identities.scenarios.hybridCoordinatorUser.email),
    ).toBe(identities.scenarios.hybridCoordinatorUser.hostingRole);
    expect(roleByEmail.get(identities.scenarios.outsiderUser.email)).toBeNull();
    expect(roleByEmail.get(identities.scenarios.creatorUser.email)).toBeNull();
    expect(roleByEmail.get(identities.scenarios.ownerUser.email)).not.toBeNull();
  });
}, 120_000);

it("requires explicit confirmation and resets only seed-owned rows", async () => {
  await withDisposableDatabase("seed_reset", async (pool, databaseUrl) => {
    const options = {
      cwd: resolve(import.meta.dirname, "../../../.."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    };
    await execute("pnpm", ["run", "db:migrate"], options);
    await runModuleSeed(databaseUrl);
    const identities = await readSeedIdentities(databaseUrl);

    // Reset without explicit confirmation is refused before deleting anything.
    const refusal = await runSeedModule(
      databaseUrl,
      `await seedModule.resetSeedData(db, { confirmSeedReset: false });`,
    ).then(
      () => {
        throw new Error("Seed reset without confirmation must fail");
      },
      (error: unknown) => String(error),
    );
    expect(refusal).toMatch(/explicit/i);
    expect((await readSeedCounts(pool, identities)).projects).toBe(
      identities.projectNames.length,
    );

    // Records outside the canonical seed survive a reset: an unrelated
    // organization, a non-canonical project inside the seed organization
    // (which also retains the seed organization itself instead of
    // cascade-deleting the developer project), and a hand-added travel leg
    // on that surviving project.
    await pool.query(
      `INSERT INTO organization (id, name, slug, country, created_at)
       VALUES ('decoy-org-id', 'Decoy Organization', 'decoy-org', 'DE', now())`,
    );
    await pool.query(
      `INSERT INTO project (id, name, start_date, end_date, location, country, organization_id, archived, created_at, updated_at)
       VALUES ('decoy-project-id', 'Decoy Project', now(), now(), 'Hamburg', 'DE',
         (SELECT id FROM organization WHERE slug = $1), false, now(), now())`,
      [identities.scenarios.hostingOrganization.slug],
    );
    await pool.query(
      `INSERT INTO project_shared_travel_leg
         (id, project_id, transport_emission_profile, distance_km, description, created_at, updated_at)
       VALUES ('decoy-leg-id', 'decoy-project-id', 'bus', '12.5',
         'Hand-added review commute', now(), now())`,
    );
    const canonicalCounts = await readSeedCounts(pool, identities);

    const report = JSON.parse(
      await runSeedModule(
        databaseUrl,
        `const report = await seedModule.resetSeedData(db, { confirmSeedReset: true });
        console.log(JSON.stringify(report));`,
      ),
    ) as {
      users: number;
      organizations: number;
      projects: number;
      travelLegs: number;
      retainedOrganizationSlugs: string[];
    };
    expect(report.projects).toBe(identities.projectNames.length);
    expect(report.travelLegs).toBe(canonicalCounts.travelLegs);
    expect(report.users).toBe(identities.seedEmails.length);
    expect(report.retainedOrganizationSlugs).toEqual([
      identities.scenarios.hostingOrganization.slug,
    ]);
    expect(await readSeedCounts(pool, identities)).toEqual({
      users: 0,
      organizations: 1,
      projects: 0,
      travelLegs: 0,
      partnerships: 0,
      participations: 0,
      journeys: 0,
      claims: 0,
    });
    const remainingOrgs = await pool.query(
      `SELECT slug FROM organization WHERE slug = ANY ($1) ORDER BY slug`,
      [identities.organizationSlugs],
    );
    expect(remainingOrgs.rows.map((row) => row.slug)).toEqual([
      identities.scenarios.hostingOrganization.slug,
    ]);

    const survivors = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM organization WHERE slug = 'decoy-org') AS decoy_orgs,
        (SELECT count(*)::int FROM project WHERE id = 'decoy-project-id') AS decoy_projects,
        (SELECT count(*)::int FROM project_shared_travel_leg WHERE id = 'decoy-leg-id') AS decoy_legs`,
    );
    expect(survivors.rows[0]).toEqual({
      decoy_orgs: 1,
      decoy_projects: 1,
      decoy_legs: 1,
    });
  });
}, 120_000);
