#!/usr/bin/env tsx

import { Buffer } from "node:buffer";
/**
 * Canonical development + test seed.
 *
 * Single implementation used by normal development seeding (`pnpm run db:seed`
 * in either app; Cost Tracker reuses this file) and by test setup, which
 * imports {@link seedDatabase} against an isolated database instead of
 * shelling the CLI. Do not introduce a parallel fixture generator.
 *
 * Stable identities and scenario registry:
 * - The Seed Owner (`SEED_USER`), the Hosting Organization (`seed-org`), the
 *   Seed Partner Organization (`seed-partner-org`), the ten `SEED_PROJECTS`,
 *   and the showcase slice (partnership, Project Participation, Participant
 *   Journey, editable Claim) are found by stable logical identity (email,
 *   slug, project name) on every run. `SEED_SCENARIOS` is the discoverable
 *   registry tests and developers reference instead of inventing setup data.
 *
 * Deterministic reference policy:
 * - Domain dates are fixed canonical values (a 2024 reference calendar for
 *   Projects, Project-relative travel days), never derived from the wall
 *   clock, so the baseline cannot become invalid as the calendar changes.
 * - `createdAt`/`updatedAt` on inserted rows are run-anchored metadata, not
 *   domain data; tests must not assert their exact values.
 * - The password hash salt is a runtime authentication secret regenerated on
 *   every run so the well-known development login keeps working. Per the
 *   parent specification, repeatability means the same logical starting
 *   dataset, not identical salts or secrets. No other fixed salts, secrets,
 *   or tokens live in this seed.
 *
 * Reset policy:
 * - Normal seeding never deletes development records: every step is
 *   find-or-create and converges missing rows only. It never rewrites
 *   developer-modified seed rows (the password hash refresh is the only
 *   rewrite, and it preserves the login).
 * - Removing seed data is explicit and safely targeted: `resetSeedData`
 *   requires `{ confirmSeedReset: true }`, and the CLI additionally requires
 *   the `--reset-seed-data` flag plus `SEED_ALLOW_DEV_RESET=true`. Only rows
 *   matching canonical seed identities are removed; unrelated organizations,
 *   non-canonical projects, and hand-added travel legs survive.
 *
 * Extension point (same seed, no parallel datasets):
 * 1. Add stable identities/constants next to `SEED_SCENARIOS`.
 * 2. Add an `ensure*` step below following the find-or-create pattern (stable
 *    lookup first, insert only when missing, no fixed secrets, no destructive
 *    writes), and call it from {@link seedDatabase}.
 * 3. Register the scenario in `SEED_SCENARIOS` and cover it in
 *    `src/__tests__/development-seed.integration.test.ts`.
 * Accepted shared-auth, Organization/Project Participation, and Participant
 * Invitation decisions stay intact: Organization Invitations and Cost Tracker
 * Participant Invitations remain distinct, and participant entry stays
 * app-owned and Partner-initiated, so future invitation/agreement/claim-state
 * scenarios must use the owning app's procedures, never direct auth writes.
 *
 * Run: pnpm run db:seed (uses tsx). Uses its own DB pool and exits the
 * process when finished. For local/dev use only — do not run in production.
 * Stop the Next.js dev server (or any process using the database) before
 * running to avoid connection conflicts.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import type { ProjectSharedTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import {
  claimsTable,
  costAllocationsTable,
  hostProjectAssignmentsTable,
  participantJourneysTable,
  participantProfilesTable,
  partnerCoordinatorAssignmentsTable,
  projectFundingBandsTable,
  projectFundingSnapshotsTable,
  projectPartnerOrganizationsTable,
  projectParticipantsTable,
  travelCostEntriesTable,
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import { account, member, organization, user } from "@greendex/database/schema";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** Database handle the canonical seed operates on. The caller owns the connection lifecycle. */
export type SeedDatabase = NodePgDatabase<typeof schema>;

/** Re-exported so test setup references one canonical seed surface. */
export { SEED_USER };

export const SEED_ORGANIZATION = {
  name: "Seed Organization",
  slug: "seed-org",
  country: "DE",
} as const;

export const SEED_PARTNER_ORGANIZATION = {
  name: "Seed Partner Organization",
  slug: "seed-partner-org",
  country: "FR",
} as const;

interface SeedTravelLegDefinition {
  transportEmissionProfile: ProjectSharedTransportEmissionProfile;
  distanceKm: number;
  /** Days after the owning Project's start date; keeps legs on the fixed reference calendar. */
  startDateOffsetDays: number;
}

export interface SeedProjectDefinition {
  /** Stable scenario reference for the cross-app showcase slice and tests. */
  scenarioId: string;
  name: string;
  city: string;
  country: "DE" | "FR" | "IT" | "ES" | "NL" | "BE" | "AT" | "PL" | "SE";
  /** Fixed ISO calendar date (UTC); part of the deterministic reference policy. */
  startDate: string;
  /** Fixed ISO calendar date (UTC); part of the deterministic reference policy. */
  endDate: string;
  travelLegs: readonly SeedTravelLegDefinition[];
}

const TRANSPORT_EMISSION_PROFILE_ROTATION: ProjectSharedTransportEmissionProfile[] =
  ["boat", "bus", "train", "car", "electricCar"];

const SEED_PROJECT_BASICS = [
  { name: "Carbon Footprint Workshop", city: "Berlin", country: "DE" },
  { name: "Sustainability Conference", city: "Munich", country: "DE" },
  { name: "Green Energy Symposium", city: "Paris", country: "FR" },
  { name: "Climate Action Workshop", city: "Rome", country: "IT" },
  { name: "Eco-Innovation Summit", city: "Madrid", country: "ES" },
  { name: "Renewable Energy Conference", city: "Amsterdam", country: "NL" },
  { name: "Environmental Protection Workshop", city: "Brussels", country: "BE" },
  { name: "Sustainable Development Forum", city: "Vienna", country: "AT" },
  { name: "Climate Solutions Workshop", city: "Warsaw", country: "PL" },
  { name: "Green Technology Conference", city: "Stockholm", country: "SE" },
] as const;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildSeedProjects(): SeedProjectDefinition[] {
  return SEED_PROJECT_BASICS.map((basics, index) => {
    const startDate = new Date(Date.UTC(2024, 2 + (index % 10), 10));
    const endDate = new Date(
      startDate.getTime() + (5 + index) * 24 * 60 * 60 * 1000,
    );
    const legCount = 3 + (index % 3);
    const travelLegs = Array.from({ length: legCount }, (_, legIndex) => ({
      transportEmissionProfile: TRANSPORT_EMISSION_PROFILE_ROTATION[
        (index + legIndex) % TRANSPORT_EMISSION_PROFILE_ROTATION.length
      ] as ProjectSharedTransportEmissionProfile,
      distanceKm: 25 + ((index * 37 + legIndex * 53) % 440),
      startDateOffsetDays: legIndex,
    }));
    return {
      scenarioId:
        index === 0 ? "seed-showcase-workshop" : `seed-project-${index + 1}`,
      name: basics.name,
      city: basics.city,
      country: basics.country,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
      travelLegs,
    };
  });
}

export const SEED_PROJECTS: readonly SeedProjectDefinition[] =
  buildSeedProjects();

function legDescription(
  leg: Pick<SeedTravelLegDefinition, "transportEmissionProfile" | "distanceKm">,
): string {
  return `${leg.transportEmissionProfile} trip - ${leg.distanceKm} km`;
}

function legTravelDate(projectStartDate: string, offsetDays: number): Date {
  return new Date(
    new Date(`${projectStartDate}T00:00:00Z`).getTime() +
      offsetDays * 24 * 60 * 60 * 1000,
  );
}

/** Showcase slice: one complete cross-app Journey on the first Project with an editable Claim. */
export const SEED_SHOWCASE = {
  projectScenarioId: "seed-showcase-workshop",
  journey: {
    origin: "Paris",
    destination: "Berlin",
    tripType: "round-trip",
    erasmusDistanceKm: "878.00",
  },
  claim: {
    transportProfile: "train",
    amountEur: "120.00",
    allocationMethod: "amount",
    status: "editable",
  },
} as const;

/**
 * Discoverable registry of canonical seed scenarios. Reference these stable
 * identities instead of inventing private setup datasets.
 */
export const SEED_SCENARIOS = {
  hostingOrganization: {
    kind: "organization",
    slug: SEED_ORGANIZATION.slug,
    name: SEED_ORGANIZATION.name,
    country: SEED_ORGANIZATION.country,
    description:
      "Default development organization; owns all seed Projects and selects as the Seed Owner default.",
  },
  partnerOrganization: {
    kind: "organization",
    slug: SEED_PARTNER_ORGANIZATION.slug,
    name: SEED_PARTNER_ORGANIZATION.name,
    country: SEED_PARTNER_ORGANIZATION.country,
    description: "Seed Partner Organization for the cross-app showcase slice.",
  },
  ownerUser: {
    kind: "user",
    email: SEED_USER.email,
    name: SEED_USER.name,
    description:
      "Seed organization owner, host coordinator, partner coordinator, and showcase Participant.",
  },
  showcaseProject: {
    kind: "project",
    scenarioId: SEED_SHOWCASE.projectScenarioId,
    name: "Carbon Footprint Workshop",
    description:
      "First seed Project; carries the shared Journey and Partner Claim demo slice.",
  },
  showcaseParticipation: {
    kind: "participation",
    projectScenarioId: SEED_SHOWCASE.projectScenarioId,
    email: SEED_USER.email,
    displayName: SEED_USER.name,
    description:
      "Seed Owner participation representing the Seed Partner Organization.",
  },
  showcaseJourney: {
    kind: "journey",
    ...SEED_SHOWCASE.journey,
    description: "Paris to Berlin round-trip Participant Journey (878 km).",
  },
  showcaseClaim: {
    kind: "claim",
    ...SEED_SHOWCASE.claim,
    description: "Editable train Travel Cost Entry claim for EUR 120.",
  },
} as const;

export interface SeedSummary {
  userId: string;
  organizationId: string;
  partnerOrganizationId: string;
  projectIds: string[];
  travelLegsEnsured: number;
  scenarios: typeof SEED_SCENARIOS;
}

export interface SeedResetReport {
  users: number;
  organizations: number;
  projects: number;
  travelLegs: number;
  /** Seed organization slugs intentionally kept because non-seed rows still reference them. */
  retainedOrganizationSlugs: string[];
}

async function hashPassword(password: string): Promise<string> {
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "hex",
  );
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16_384,
    r: 16,
    p: 1,
    dkLen: 64,
  });
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function ensureSeedUser(db: SeedDatabase): Promise<string> {
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, SEED_USER.email),
  });
  if (existingUser) {
    console.log(`⚠️  User already exists: ${SEED_USER.email}`);
    return existingUser.id;
  }
  const userId = createId();
  await db.insert(user).values({
    id: userId,
    name: SEED_USER.name,
    email: SEED_USER.email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`✅ User created: ${SEED_USER.email} (ID: ${userId})`);
  return userId;
}

async function ensurePasswordAccount(db: SeedDatabase, userId: string) {
  // Refresh the credential login on every run so the well-known development
  // password keeps working. The random salt is runtime secret material, not
  // domain data, and is intentionally not stable across runs.
  await db.delete(account).where(eq(account.userId, userId));
  const hashedPassword = await hashPassword(SEED_USER.password);
  await db.insert(account).values({
    id: createId(),
    userId,
    accountId: userId,
    providerId: "credential",
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✅ Password account created");
}

async function ensureSeedOrganization(
  db: SeedDatabase,
  definition: typeof SEED_ORGANIZATION | typeof SEED_PARTNER_ORGANIZATION,
): Promise<string> {
  const existingOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, definition.slug),
  });
  if (existingOrg) {
    console.log(`⚠️  Organization already exists: ${definition.name}`);
    return existingOrg.id;
  }
  const orgId = createId();
  await db.insert(organization).values({
    id: orgId,
    name: definition.name,
    slug: definition.slug,
    country: definition.country,
    createdAt: new Date(),
  });
  console.log(`✅ Organization created: ${definition.name} (ID: ${orgId})`);
  return orgId;
}

async function ensureMembership(
  db: SeedDatabase,
  orgId: string,
  userId: string,
  role: string,
  createdAt: Date,
): Promise<void> {
  const existingMembership = await db.query.member.findFirst({
    where: (members, { and }) =>
      and(eq(members.userId, userId), eq(members.organizationId, orgId)),
  });
  if (existingMembership) {
    return;
  }
  await db.insert(member).values({
    id: createId(),
    organizationId: orgId,
    userId,
    role,
    createdAt,
  });
}

async function ensureSeedProject(
  db: SeedDatabase,
  orgId: string,
  userId: string,
  project: SeedProjectDefinition,
): Promise<{ projectId: string; legsEnsured: number }> {
  const existingProject = await db.query.projectsTable.findFirst({
    where: (projects, { and }) =>
      and(eq(projects.organizationId, orgId), eq(projects.name, project.name)),
  });
  let projectId: string;
  if (existingProject) {
    projectId = existingProject.id;
  } else {
    projectId = createId();
    await db.insert(projectsTable).values({
      id: projectId,
      name: project.name,
      startDate: new Date(`${project.startDate}T00:00:00Z`),
      endDate: new Date(`${project.endDate}T00:00:00Z`),
      location: project.city,
      country: project.country,
      welcomeMessage: `Welcome to ${project.name}! We're excited to have you join us for this important sustainability initiative.`,
      organizationId: orgId,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  const existingAssignment = await db.query.hostProjectAssignmentsTable.findFirst(
    {
      where: (assignments, { and }) =>
        and(eq(assignments.projectId, projectId), eq(assignments.userId, userId)),
    },
  );
  if (!existingAssignment) {
    await db.insert(hostProjectAssignmentsTable).values({ projectId, userId });
  }

  // Converge the canonical travel legs without touching hand-added rows:
  // only exact canonical tuples are inserted when missing.
  const existingLegs = await db.query.projectSharedTravelLegsTable.findMany({
    where: eq(projectSharedTravelLegsTable.projectId, projectId),
  });
  const existingKeys = new Set(
    existingLegs.map(
      (leg) =>
        `${leg.transportEmissionProfile}|${leg.distanceKm}|${leg.description ?? ""}`,
    ),
  );
  let legsEnsured = 0;
  for (const leg of project.travelLegs) {
    const description = legDescription(leg);
    if (
      existingKeys.has(
        `${leg.transportEmissionProfile}|${leg.distanceKm}|${description}`,
      )
    ) {
      continue;
    }
    await db.insert(projectSharedTravelLegsTable).values({
      id: createId(),
      projectId,
      transportEmissionProfile: leg.transportEmissionProfile,
      distanceKm: leg.distanceKm,
      description,
      travelDate: legTravelDate(project.startDate, leg.startDateOffsetDays),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    legsEnsured++;
  }
  return { projectId, legsEnsured };
}

/**
 * Run the canonical seed against the given database. Every step is
 * find-or-create: repeat runs converge to the same logical dataset instead
 * of adding duplicates, and development records are never deleted.
 */
export async function seedDatabase(db: SeedDatabase): Promise<SeedSummary> {
  console.log("🌱 Starting database seed...\n");

  console.log("👤 Checking for existing user...");
  const userId = await ensureSeedUser(db);

  console.log("🔒 Creating password account...");
  await ensurePasswordAccount(db, userId);

  console.log("🏢 Checking for existing organization...");
  const orgId = await ensureSeedOrganization(db, SEED_ORGANIZATION);

  console.log("👥 Checking for existing membership...");
  const hostingMembership = await db.query.member.findFirst({
    where: (members, { and }) =>
      and(eq(members.userId, userId), eq(members.organizationId, orgId)),
  });
  const hostingMembershipCreatedAt = hostingMembership?.createdAt ?? new Date();
  await ensureMembership(
    db,
    orgId,
    userId,
    ORGANIZATION_ROLES.OrganizationOwner,
    hostingMembershipCreatedAt,
  );
  console.log("✅ User set as organization owner");

  console.log("📁 Ensuring projects...");
  const projectIds: string[] = [];
  let totalTravelLegsEnsured = 0;
  for (const [index, project] of SEED_PROJECTS.entries()) {
    const ensured = await ensureSeedProject(db, orgId, userId, project);
    projectIds.push(ensured.projectId);
    totalTravelLegsEnsured += ensured.legsEnsured;
    console.log(`  ✅ Project ${index + 1}/10: ${project.name}`);
  }

  // One complete, mocked cross-app slice on the showcase Project. No proof
  // upload, invitation or mail is needed to inspect an editable Claim.
  console.log("🤝 Creating shared Journey and Partner Claim demo...");
  await db.transaction(async (tx) => {
    const partnerId = await (async () => {
      const existingPartner = await tx.query.organization.findFirst({
        where: eq(organization.slug, SEED_PARTNER_ORGANIZATION.slug),
      });
      if (existingPartner) {
        return existingPartner.id;
      }
      const createdId = createId();
      await tx.insert(organization).values({
        id: createdId,
        name: SEED_PARTNER_ORGANIZATION.name,
        slug: SEED_PARTNER_ORGANIZATION.slug,
        country: SEED_PARTNER_ORGANIZATION.country,
        createdAt: new Date(),
      });
      return createdId;
    })();
    const existingPartnerMembership = await tx.query.member.findFirst({
      where: (members, { and }) =>
        and(eq(members.userId, userId), eq(members.organizationId, partnerId)),
    });
    if (!existingPartnerMembership) {
      await tx.insert(member).values({
        id: createId(),
        organizationId: partnerId,
        userId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        // Auth initially selects the newest Membership. Keep the existing
        // Hosting default for both apps and their ordinary seed-based tests.
        createdAt: new Date(hostingMembershipCreatedAt.getTime() - 1),
      });
    }
    const projectId = projectIds[0] as string;
    const existingPartnership =
      await tx.query.projectPartnerOrganizationsTable.findFirst({
        where: (partnerships, { and }) =>
          and(
            eq(partnerships.projectId, projectId),
            eq(partnerships.organizationId, partnerId),
          ),
      });
    let partnershipId: string;
    if (existingPartnership) {
      partnershipId = existingPartnership.id;
    } else {
      partnershipId = createId();
      await tx.insert(projectPartnerOrganizationsTable).values({
        id: partnershipId,
        projectId,
        organizationId: partnerId,
      });
    }
    const existingCoordinator =
      await tx.query.partnerCoordinatorAssignmentsTable.findFirst({
        where: (assignments, { and }) =>
          and(
            eq(assignments.partnershipId, partnershipId),
            eq(assignments.userId, userId),
          ),
      });
    if (!existingCoordinator) {
      await tx
        .insert(partnerCoordinatorAssignmentsTable)
        .values({ partnershipId, userId });
    }
    await tx
      .insert(participantProfilesTable)
      .values({
        userId,
        fullName: SEED_USER.name,
      })
      .onConflictDoNothing();
    const existingParticipation =
      await tx.query.projectParticipantsTable.findFirst({
        where: (participants, { and }) =>
          and(
            eq(participants.projectId, projectId),
            eq(participants.email, SEED_USER.email),
          ),
      });
    let participationId: string;
    if (existingParticipation) {
      participationId = existingParticipation.id;
    } else {
      participationId = createId();
      await tx.insert(projectParticipantsTable).values({
        id: participationId,
        projectId,
        representedOrganizationId: partnerId,
        userId,
        displayName: SEED_USER.name,
        email: SEED_USER.email,
        country: SEED_PARTNER_ORGANIZATION.country,
      });
    }
    const existingSnapshot =
      await tx.query.projectFundingSnapshotsTable.findFirst({
        where: eq(projectFundingSnapshotsTable.projectId, projectId),
      });
    if (!existingSnapshot) {
      await tx.insert(projectFundingSnapshotsTable).values({
        projectId,
        rulesVersion: TRAVEL_FUNDING_RULES.version,
        participantTransportProfiles: [
          ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
        ],
      });
      await tx.insert(projectFundingBandsTable).values(
        TRAVEL_FUNDING_RULES.bands.map((band) => ({
          projectId,
          minKm: String(band.minKm),
          maxKm: String(band.maxKm),
          standardEur: String(band.standardEur),
          greenEur: String(band.greenEur),
        })),
      );
    }
    const existingJourney = await tx.query.participantJourneysTable.findFirst({
      where: eq(participantJourneysTable.projectParticipantId, participationId),
    });
    if (!existingJourney) {
      await tx.insert(participantJourneysTable).values({
        projectParticipantId: participationId,
        origin: SEED_SHOWCASE.journey.origin,
        destination: SEED_SHOWCASE.journey.destination,
        tripType: SEED_SHOWCASE.journey.tripType,
        erasmusDistanceKm: SEED_SHOWCASE.journey.erasmusDistanceKm,
      });
    }
    const existingClaim = await tx.query.claimsTable.findFirst({
      where: eq(claimsTable.partnershipId, partnershipId),
    });
    let claimId: string;
    if (existingClaim) {
      claimId = existingClaim.id;
    } else {
      claimId = createId();
      await tx.insert(claimsTable).values({ id: claimId, partnershipId });
    }
    const existingEntries = await tx.query.travelCostEntriesTable.findMany({
      where: eq(travelCostEntriesTable.claimId, claimId),
    });
    if (existingEntries.length === 0) {
      const entryId = createId();
      await tx.insert(travelCostEntriesTable).values({
        id: entryId,
        claimId,
        transportProfile: SEED_SHOWCASE.claim.transportProfile,
        amountEur: SEED_SHOWCASE.claim.amountEur,
        allocationMethod: SEED_SHOWCASE.claim.allocationMethod,
      });
      await tx.insert(costAllocationsTable).values({
        travelCostEntryId: entryId,
        projectParticipantId: participationId,
        amountEur: SEED_SHOWCASE.claim.amountEur,
      });
    }
    return { partnerId };
  });
  console.log(
    "✅ Seed Partner Organization: Paris → Berlin, round-trip, 878 km; editable train Claim: EUR 120",
  );

  const partnerOrganization = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_PARTNER_ORGANIZATION.slug),
  });

  return {
    userId,
    organizationId: orgId,
    partnerOrganizationId: partnerOrganization?.id ?? "",
    projectIds,
    travelLegsEnsured: totalTravelLegsEnsured,
    scenarios: SEED_SCENARIOS,
  };
}

/**
 * A seed Organization is removable only when no projects and no memberships
 * outside the canonical seed still reference it. Canonical projects and the
 * seed User's memberships are already deleted by the time this runs, so any
 * remaining reference is developer data worth keeping.
 */
async function findRemovableSeedOrgIds(
  db: SeedDatabase,
  seedOrgIds: string[],
): Promise<string[]> {
  const remainingProjects = await db.query.projectsTable.findMany({
    where: inArray(projectsTable.organizationId, seedOrgIds as string[]),
  });
  const remainingMembers = await db.query.member.findMany({
    where: inArray(member.organizationId, seedOrgIds as string[]),
  });
  const blockedOrgIds = new Set([
    ...remainingProjects.map((project) => project.organizationId),
    ...remainingMembers.map((membership) => membership.organizationId),
  ]);
  return seedOrgIds.filter((orgId) => !blockedOrgIds.has(orgId));
}

/**
 * Explicit, safely targeted removal of canonical seed rows only. Requires
 * `{ confirmSeedReset: true }` — without it the function throws before
 * deleting anything. Rows that do not match canonical seed identities
 * (unrelated organizations, non-canonical projects, hand-added travel legs
 * on surviving projects) are preserved. A seed Organization with remaining
 * non-seed dependents is retained instead of cascade-deleting them, and its
 * slug is reported in `retainedOrganizationSlugs`.
 */
export async function resetSeedData(
  db: SeedDatabase,
  options: { confirmSeedReset: boolean },
): Promise<SeedResetReport> {
  if (options?.confirmSeedReset !== true) {
    throw new Error(
      "Refusing to reset seed data without explicit confirmation: pass { confirmSeedReset: true }.",
    );
  }
  const seedUser = await db.query.user.findFirst({
    where: eq(user.email, SEED_USER.email),
  });
  const seedOrganizations = await db.query.organization.findMany({
    where: inArray(organization.slug, [
      SEED_ORGANIZATION.slug,
      SEED_PARTNER_ORGANIZATION.slug,
    ]),
  });
  const seedOrgIds = seedOrganizations.map((org) => org.id);
  const canonicalNames = SEED_PROJECTS.map((project) => project.name);
  const seedProjects =
    seedOrgIds.length > 0
      ? await db.query.projectsTable.findMany({
          where: and(
            inArray(projectsTable.organizationId, seedOrgIds),
            inArray(projectsTable.name, canonicalNames),
          ),
        })
      : [];
  const seedProjectIds = seedProjects.map((project) => project.id);
  const canonicalLegKeys = new Set(
    SEED_PROJECTS.flatMap((project) =>
      project.travelLegs.map(
        (leg) =>
          `${project.name}|${leg.transportEmissionProfile}|${leg.distanceKm}|${legDescription(leg)}`,
      ),
    ),
  );

  let travelLegs = 0;
  if (seedProjectIds.length > 0) {
    const legs = await db.query.projectSharedTravelLegsTable.findMany({
      where: inArray(projectSharedTravelLegsTable.projectId, seedProjectIds),
    });
    const projectNamesById = new Map(
      seedProjects.map((project) => [project.id, project.name]),
    );
    const canonicalLegIds = legs
      .filter((leg) =>
        canonicalLegKeys.has(
          `${projectNamesById.get(leg.projectId)}|${leg.transportEmissionProfile}|${leg.distanceKm}|${leg.description ?? ""}`,
        ),
      )
      .map((leg) => leg.id);
    if (canonicalLegIds.length > 0) {
      await db
        .delete(projectSharedTravelLegsTable)
        .where(
          inArray(projectSharedTravelLegsTable.id, canonicalLegIds as string[]),
        );
      travelLegs = canonicalLegIds.length;
    }
    const partnerships = await db.query.projectPartnerOrganizationsTable.findMany(
      {
        where: inArray(
          projectPartnerOrganizationsTable.projectId,
          seedProjectIds as string[],
        ),
      },
    );
    const partnershipIds = partnerships.map((partnership) => partnership.id);
    if (partnershipIds.length > 0) {
      const claims = await db.query.claimsTable.findMany({
        where: inArray(claimsTable.partnershipId, partnershipIds as string[]),
      });
      const claimIds = claims.map((claim) => claim.id);
      if (claimIds.length > 0) {
        const entries = await db.query.travelCostEntriesTable.findMany({
          where: inArray(travelCostEntriesTable.claimId, claimIds as string[]),
        });
        const entryIds = entries.map((entry) => entry.id);
        if (entryIds.length > 0) {
          await db
            .delete(costAllocationsTable)
            .where(
              inArray(
                costAllocationsTable.travelCostEntryId,
                entryIds as string[],
              ),
            );
          await db
            .delete(travelCostEntriesTable)
            .where(inArray(travelCostEntriesTable.id, entryIds as string[]));
        }
        await db
          .delete(claimsTable)
          .where(inArray(claimsTable.id, claimIds as string[]));
      }
      await db
        .delete(partnerCoordinatorAssignmentsTable)
        .where(
          inArray(
            partnerCoordinatorAssignmentsTable.partnershipId,
            partnershipIds as string[],
          ),
        );
    }
    // Participations precede partnerships: a database invariant requires a
    // Participation represented Organization to stay assigned while it exists.
    const participations = await db.query.projectParticipantsTable.findMany({
      where: inArray(
        projectParticipantsTable.projectId,
        seedProjectIds as string[],
      ),
    });
    const seedParticipations = seedUser
      ? participations.filter(
          (participation) =>
            participation.email === SEED_USER.email &&
            participation.userId === seedUser.id,
        )
      : [];
    for (const participation of seedParticipations) {
      await db
        .delete(participantJourneysTable)
        .where(
          eq(participantJourneysTable.projectParticipantId, participation.id),
        );
      await db
        .delete(projectParticipantsTable)
        .where(eq(projectParticipantsTable.id, participation.id));
    }
    if (partnershipIds.length > 0) {
      await db
        .delete(projectPartnerOrganizationsTable)
        .where(
          inArray(
            projectPartnerOrganizationsTable.id,
            partnershipIds as string[],
          ),
        );
    }
    await db
      .delete(projectFundingBandsTable)
      .where(
        inArray(projectFundingBandsTable.projectId, seedProjectIds as string[]),
      );
    await db
      .delete(projectFundingSnapshotsTable)
      .where(
        inArray(
          projectFundingSnapshotsTable.projectId,
          seedProjectIds as string[],
        ),
      );
    await db
      .delete(hostProjectAssignmentsTable)
      .where(
        inArray(
          hostProjectAssignmentsTable.projectId,
          seedProjectIds as string[],
        ),
      );
    await db
      .delete(projectsTable)
      .where(inArray(projectsTable.id, seedProjectIds as string[]));
  }
  if (seedUser && seedOrgIds.length > 0) {
    await db
      .delete(member)
      .where(
        and(
          eq(member.userId, seedUser.id),
          inArray(member.organizationId, seedOrgIds as string[]),
        ),
      );
    await db
      .delete(participantProfilesTable)
      .where(eq(participantProfilesTable.userId, seedUser.id));
  }
  // Never cascade-delete a seed Organization that still carries non-seed
  // rows (developer projects, other memberships). Those dependents survive
  // and the organization is retained with them.
  const removableOrgIds =
    seedOrgIds.length > 0 ? await findRemovableSeedOrgIds(db, seedOrgIds) : [];
  const retainedOrganizationSlugs = seedOrganizations
    .filter((org) => !removableOrgIds.includes(org.id))
    .map((org) => org.slug);
  if (removableOrgIds.length > 0) {
    await db
      .delete(organization)
      .where(inArray(organization.id, removableOrgIds as string[]));
  }
  let users = 0;
  if (seedUser) {
    await db.delete(account).where(eq(account.userId, seedUser.id));
    await db.delete(user).where(eq(user.id, seedUser.id));
    users = 1;
  }
  return {
    users,
    organizations: removableOrgIds.length,
    projects: seedProjects.length,
    travelLegs,
    retainedOrganizationSlugs,
  };
}

async function runFromEnvironment(): Promise<void> {
  // Load the shared database configuration before app-local values.
  const databaseEnvPath = new URL(
    "../../../packages/database/.env",
    import.meta.url,
  );
  if (existsSync(databaseEnvPath)) loadEnvFile(databaseEnvPath);

  // Load environment variables from .env file
  if (existsSync(".env")) loadEnvFile(".env");

  // Validate DATABASE_URL is available
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is not configured");
    process.exit(1);
  }

  // Create dedicated pool for seeding
  const seedPool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
  });

  const db = drizzle(seedPool, { schema });

  try {
    if (process.argv.includes("--reset-seed-data")) {
      if (process.env.SEED_ALLOW_DEV_RESET !== "true") {
        console.error(
          "❌ Refusing to reset seed data without explicit confirmation: " +
            "rerun with the --reset-seed-data flag and SEED_ALLOW_DEV_RESET=true. " +
            "Only canonical seed rows are removed; other development records are preserved.",
        );
        process.exit(1);
      }
      console.log("🧹 Removing canonical seed rows...\n");
      const report = await resetSeedData(db, { confirmSeedReset: true });
      console.log("\n🧹 SEED RESET COMPLETED!");
      console.log("=".repeat(60));
      console.log(`Users removed: ${report.users}`);
      console.log(`Organizations removed: ${report.organizations}`);
      console.log(`Projects removed: ${report.projects}`);
      console.log(`Project Shared Travel Legs removed: ${report.travelLegs}`);
      console.log("=".repeat(60));
      return;
    }

    const summary = await seedDatabase(db);
    console.log("\n🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(
      "📋 Development seed summary (login defined in @greendex/auth/seed-user):",
    );
    console.log("-".repeat(60));
    console.log(`Email:    ${SEED_USER.email}`);
    console.log("-".repeat(60));
    console.log(`User ID: ${summary.userId}`);
    console.log(`Organization ID: ${summary.organizationId}`);
    console.log(`Projects: ${summary.projectIds.length}`);
    console.log(
      `Project Shared Travel Legs ensured this run: ${summary.travelLegsEnsured}`,
    );
    console.log("=".repeat(60));
    console.log("\n✨ You can now sign in at http://localhost:3000\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await seedPool.end();
  }
}

// Only run seed() if this script is executed directly, not when imported
if (import.meta.main) {
  runFromEnvironment()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
