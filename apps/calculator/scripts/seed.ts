#!/usr/bin/env tsx

/**
 * Development DB seeder
 *
 * - Purpose: Insert a seed user, organization, projects, and Project Shared Travel Legs for local development and tests.
 * - Warning: Stop the Next.js dev server (or any process using the database) before running to avoid connection conflicts.
 * - Run: pnpm run db:seed (uses tsx)
 *
 * Uses its own DB pool and will exit the process when finished. For local/dev use only — do not run in production.
 */

import { Buffer } from "node:buffer";

import type { ProjectSharedTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import {
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import * as schema from "@greendex/database/schema";
import { account, member, organization, user } from "@greendex/database/schema";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { SEED_USER } from "./seed-user";

// Load environment variables from .env file
config({ path: ".env" });

// Validate DATABASE_URL is available
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env file");
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

    if (existingMembership) {
      console.log("⚠️  Membership already exists");
    } else {
      const memberId = createId();
      await db.insert(member).values({
        id: memberId,
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: new Date(),
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
        responsibleUserId: userId,
        organizationId: orgId,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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
    console.log("\n🎉 SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("📋 Login Credentials:");
    console.log("-".repeat(60));
    console.log(`Email:    ${SEED_USER.email}`);
    console.log(`Password: ${SEED_USER.password}`);
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
