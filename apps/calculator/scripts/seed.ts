#!/usr/bin/env tsx

import { Buffer } from "node:buffer";
/**
 * Development DB seeder
 *
 * - Purpose: Insert a seed user, organization, projects, and Project Shared Travel Legs for local development and tests.
 * - Warning: Stop the Next.js dev server (or any process using the database) before running to avoid connection conflicts.
 * - Run: pnpm run db:seed (uses tsx)
 *
 * Uses its own DB pool and will exit the process when finished. For local/dev use only — do not run in production.
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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

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

const SEED_ORGANIZATION = {
  name: "Seed Organization",
  slug: "seed-org",
  country: "DE",
} as const;

const PROJECT_NAMES = [
  "Carbon Footprint Workshop",
  "Sustainability Conference",
  "Green Energy Symposium",
  "Climate Action Workshop",
  "Eco-Innovation Summit",
  "Renewable Energy Conference",
  "Environmental Protection Workshop",
  "Sustainable Development Forum",
  "Climate Solutions Workshop",
  "Green Technology Conference",
] as const;

const TRANSPORT_EMISSION_PROFILES: ProjectSharedTransportEmissionProfile[] = [
  "boat",
  "bus",
  "train",
  "car",
  "electricCar",
];

const LOCATIONS = [
  { city: "Berlin", country: "DE" as const },
  { city: "Munich", country: "DE" as const },
  { city: "Paris", country: "FR" as const },
  { city: "Rome", country: "IT" as const },
  { city: "Madrid", country: "ES" as const },
  { city: "Amsterdam", country: "NL" as const },
  { city: "Brussels", country: "BE" as const },
  { city: "Vienna", country: "AT" as const },
  { city: "Warsaw", country: "PL" as const },
  { city: "Stockholm", country: "SE" as const },
] as const;

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

function getRandomElement<T>(array: readonly T[] | T[]): T {
  return array[Math.floor(Math.random() * array.length)] as T;
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function generateProjectDates() {
  const startDate = getRandomDate(new Date(2024, 0, 1), new Date(2024, 11, 31));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + getRandomInt(1, 30));
  return { startDate, endDate };
}

async function seed() {
  console.log("🌱 Starting database seed...\n");

  try {
    // Step 1: Check if user already exists
    console.log("👤 Checking for existing user...");
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, SEED_USER.email),
    });

    let userId: string;

    if (existingUser) {
      console.log(`⚠️  User already exists: ${SEED_USER.email}`);
      userId = existingUser.id;
    } else {
      // Create user
      console.log("👤 Creating user...");
      userId = createId();

      await db.insert(user).values({
        id: userId,
        name: SEED_USER.name,
        email: SEED_USER.email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`✅ User created: ${SEED_USER.email} (ID: ${userId})`);
    }

    // Delete existing account if any
    await db.delete(account).where(eq(account.userId, userId));

    // Create password account
    console.log("🔒 Creating password account...");
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

    // Step 2: Create or find organization
    console.log("🏢 Checking for existing organization...");
    const existingOrg = await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORGANIZATION.slug),
    });

    let orgId: string;

    if (existingOrg) {
      console.log(`⚠️  Organization already exists: ${SEED_ORGANIZATION.name}`);
      orgId = existingOrg.id;
    } else {
      orgId = createId();
      await db.insert(organization).values({
        id: orgId,
        name: SEED_ORGANIZATION.name,
        slug: SEED_ORGANIZATION.slug,
        country: SEED_ORGANIZATION.country,
        createdAt: new Date(),
      });
      console.log(
        `✅ Organization created: ${SEED_ORGANIZATION.name} (ID: ${orgId})`,
      );
    }

    // Step 3: Create membership
    console.log("👥 Checking for existing membership...");
    const existingMembership = await db.query.member.findFirst({
      where: (members, { and }) =>
        and(eq(members.userId, userId), eq(members.organizationId, orgId)),
    });

    const hostingMembershipCreatedAt =
      existingMembership?.createdAt ?? new Date();
    if (existingMembership) {
      console.log("⚠️  Membership already exists");
    } else {
      const memberId = createId();
      await db.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: hostingMembershipCreatedAt,
      });
      console.log("✅ User set as organization owner");
    }

    // Step 4: Create projects
    console.log("📁 Creating projects...");
    const projectIds: string[] = [];

    for (let i = 0; i < PROJECT_NAMES.length; i++) {
      const projectId = createId();
      const { startDate, endDate } = generateProjectDates();
      const location = LOCATIONS[i];

      await db.insert(projectsTable).values({
        id: projectId,
        name: PROJECT_NAMES[i],
        startDate,
        endDate,
        location: location.city,
        country: location.country,
        welcomeMessage: `Welcome to ${PROJECT_NAMES[i]}! We're excited to have you join us for this important sustainability initiative.`,
        organizationId: orgId,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(hostProjectAssignmentsTable).values({ projectId, userId });
      projectIds.push(projectId);
      console.log(
        `  ✅ Project ${i + 1}/10: ${PROJECT_NAMES[i]} in ${location.city}, ${location.country}`,
      );
    }

    // Step 5: Create Project Shared Travel Legs
    console.log("🚗 Creating Project Shared Travel Legs...");
    let totalTravelLegsCreated = 0;

    for (const projectId of projectIds) {
      const numSharedTravelLegs = getRandomInt(3, 8);

      for (let i = 0; i < numSharedTravelLegs; i++) {
        const transportEmissionProfile = getRandomElement(
          TRANSPORT_EMISSION_PROFILES,
        );
        const distanceKm = getRandomInt(5, 500);

        await db.insert(projectSharedTravelLegsTable).values({
          id: createId(),
          projectId,
          transportEmissionProfile,
          distanceKm,
          description: `${transportEmissionProfile} trip - ${distanceKm} km`,
          travelDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        totalTravelLegsCreated++;
      }
    }

    console.log(
      `✅ Created ${totalTravelLegsCreated} Project Shared Travel Legs across 10 projects`,
    );
    // One complete, mocked cross-app slice on the first Project. No proof upload,
    // invitation or mail is needed to inspect an editable Claim.
    console.log("🤝 Creating shared Journey and Partner Claim demo...");
    await db.transaction(async (tx) => {
      const existingPartner = await tx.query.organization.findFirst({
        where: eq(organization.slug, "seed-partner-org"),
      });
      const partnerId = existingPartner?.id ?? createId();
      if (!existingPartner) {
        await tx.insert(organization).values({
          id: partnerId,
          name: "Seed Partner Organization",
          slug: "seed-partner-org",
          country: "FR",
          createdAt: new Date(),
        });
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
      const projectId = projectIds[0];
      const partnershipId = createId();
      const participationId = createId();
      const claimId = createId();
      const entryId = createId();
      await tx.insert(projectPartnerOrganizationsTable).values({
        id: partnershipId,
        projectId,
        organizationId: partnerId,
      });
      await tx
        .insert(partnerCoordinatorAssignmentsTable)
        .values({ partnershipId, userId });
      await tx
        .insert(participantProfilesTable)
        .values({
          userId,
          fullName: SEED_USER.name,
        })
        .onConflictDoNothing();
      await tx.insert(projectParticipantsTable).values({
        id: participationId,
        projectId,
        representedOrganizationId: partnerId,
        userId,
        displayName: SEED_USER.name,
        email: SEED_USER.email,
        country: "FR",
      });
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
      await tx.insert(participantJourneysTable).values({
        projectParticipantId: participationId,
        origin: "Paris",
        destination: "Berlin",
        tripType: "round-trip",
        erasmusDistanceKm: "878.00",
      });
      await tx.insert(claimsTable).values({ id: claimId, partnershipId });
      await tx.insert(travelCostEntriesTable).values({
        id: entryId,
        claimId,
        transportProfile: "train",
        amountEur: "120.00",
        allocationMethod: "amount",
      });
      await tx.insert(costAllocationsTable).values({
        travelCostEntryId: entryId,
        projectParticipantId: participationId,
        amountEur: "120.00",
      });
    });
    console.log(
      "✅ Seed Partner Organization: Paris → Berlin, round-trip, 878 km; editable train Claim: EUR 120",
    );

    console.log("\n🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(
      "📋 Development seed summary (login defined in @greendex/auth/seed-user):",
    );
    console.log("-".repeat(60));
    console.log(`Email:    ${SEED_USER.email}`);
    console.log("-".repeat(60));
    console.log(`User ID: ${userId}`);
    console.log(`Organization ID: ${orgId}`);
    console.log(`Projects: ${projectIds.length}`);
    console.log(`Project Shared Travel Legs: ${totalTravelLegsCreated}`);
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
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
