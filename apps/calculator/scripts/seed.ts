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
 *   the Partner-owned `SEED_PARTNER_PROJECT`, and the showcase slice
 *   (partnership, Project Participations, Participant Journeys, editable
 *   Claim) are found by stable logical identity (email, slug, project name)
 *   on every run. `SEED_SCENARIOS` is the discoverable
 *   registry tests and developers reference instead of inventing setup data.
 *   `SEED_ORG_ROLE_USERS` adds the named Hosting Organization role actors
 *   (admin, coordinator, participant, combined-authority hybrids) plus a
 *   membership-free outsider for auth/Organization/permission checks.
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
 * Cost Tracker's co-located `seed-cost-tracker.ts` builders are called only by
 * seedDatabase and share this registry and explicit-reset contract.
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
  claimHistoryTable,
  duplicateReviewTasksTable,
  costAllocationsTable,
  hostProjectAssignmentsTable,
  participantJourneysTable,
  participantProfilesTable,
  participantEntryTokensTable,
  payoutAccountsTable,
  partnershipPayoutAccountsTable,
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

import {
  ensureCostTrackerScenarios,
  SUBMISSION_PAYOUT_ACCOUNT_IDS,
} from "./seed-cost-tracker";
import { ensureReviewScenarios } from "./seed-review-scenarios";
import { SEED_ENTITY_SEARCH, SEED_REVIEW_SCENARIOS } from "./seed-scenarios";

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

/** Second Partner Organization for participant-entry flows (#268).
 * Owns no Projects; it carries the isolated entry, invitation, and onboarding
 * Partnerships so the showcase single-row read keeps converging on one row.
 * Only the showcase Partnership targets the primary Partner Organization. */
export const SEED_SECOND_PARTNER_ORGANIZATION = {
  name: "Seed Second Partner Organization",
  slug: "seed-second-partner-org",
  country: "IT",
} as const;

/** Third Partner Organization for second-join checks (#268).
 * Assigned to the onboarding Project alongside the second Partner Organization
 * so second-join and cross-Partnership scenarios resolve seeded rows. */
export const SEED_THIRD_PARTNER_ORGANIZATION = {
  name: "Seed Third Partner Organization",
  slug: "seed-third-partner-org",
  country: "ES",
} as const;

/**
 * Named Hosting Organization actors for auth/Organization/permission tests
 * (#266) plus participant-entry Invitees (#268). Stable, recognizable identities
 * so ordinary role, scope, and negative-scenario checks resolve seeded rows
 * instead of inventing private User/Organization/Membership setup. Every entry
 * shares the well-known development password (`SEED_USER.password`); salts stay
 * run-scoped secrets per the deterministic reference policy above. The outsider,
 * the creator, and the two Invitees hold no Memberships anywhere: Cost Tracker
 * permits first-Organization creation only for membership-free callers, so each
 * parallel creator file owns one memberless gate and must restore it after
 * use (concurrent runs must never contend on shared rows). The Invitees are
 * the canonical joiners for participant-entry/onboarding flows; case
 * Participations, tokens, profiles, and acceptances for them are created
 * through the procedures under test and removed afterwards.
 */
export const SEED_ORG_ROLE_USERS = [
  {
    key: "admin",
    name: "Seed Admin",
    email: "seed-admin@example.org",
    hostingRole: ORGANIZATION_ROLES.OrganizationAdmin,
  },
  {
    key: "coordinator",
    name: "Seed Coordinator",
    email: "seed-coordinator@example.org",
    hostingRole: ORGANIZATION_ROLES.ProjectCoordinator,
  },
  {
    key: "participant",
    name: "Seed Participant",
    email: "seed-participant@example.org",
    hostingRole: ORGANIZATION_ROLES.Participant,
  },
  {
    key: "hybridAdmin",
    name: "Seed Hybrid Admin",
    email: "seed-hybrid-admin@example.org",
    hostingRole: `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`,
  },
  {
    key: "hybridCoordinator",
    name: "Seed Hybrid Coordinator",
    email: "seed-hybrid-coordinator@example.org",
    hostingRole: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
  },
  {
    key: "costTrackerPartnerOwner",
    name: "Seed Cost Tracker Partner Owner",
    email: "seed-cost-tracker-partner-owner@example.org",
    hostingRole: null,
  },
  {
    key: "outsider",
    name: "Seed Outsider",
    email: "seed-outsider@example.org",
    hostingRole: null,
  },
  {
    key: "creator",
    name: "Seed Creator",
    email: "seed-creator@example.org",
    hostingRole: null,
  },
  {
    key: "invitee",
    name: "Seed Invitee",
    email: "seed-invitee@example.org",
    hostingRole: null,
  },
  {
    key: "inviteeSecond",
    name: "Seed Second Invitee",
    email: "seed-second-invitee@example.org",
    hostingRole: null,
  },
  {
    key: "onboardingInvitee",
    name: "Seed Onboarding Invitee",
    email: "seed-onboarding-invitee@example.org",
    hostingRole: null,
  },
  {
    key: "onboardingInviteeSecond",
    name: "Seed Second Onboarding Invitee",
    email: "seed-second-onboarding-invitee@example.org",
    hostingRole: null,
  },
  {
    key: "invitationCoordinator",
    name: "Seed Invitation Coordinator",
    email: "seed-invitation-coordinator@example.org",
    hostingRole: ORGANIZATION_ROLES.ProjectCoordinator,
  },
  {
    key: "onboardingOwner",
    name: "Seed Onboarding Owner",
    email: "seed-onboarding-owner@example.org",
    hostingRole: ORGANIZATION_ROLES.OrganizationOwner,
  },
  {
    key: "onboardingAdmin",
    name: "Seed Onboarding Admin",
    email: "seed-onboarding-admin@example.org",
    hostingRole: ORGANIZATION_ROLES.OrganizationAdmin,
  },
  {
    key: "onboardingParticipant",
    name: "Seed Onboarding Participant",
    email: "seed-onboarding-participant@example.org",
    hostingRole: ORGANIZATION_ROLES.Participant,
  },
  {
    key: "onboardingCoordinator",
    name: "Seed Onboarding Coordinator",
    email: "seed-onboarding-coordinator@example.org",
    hostingRole: ORGANIZATION_ROLES.ProjectCoordinator,
  },
  {
    key: "onboardingCombined",
    name: "Seed Onboarding Combined",
    email: "seed-onboarding-combined@example.org",
    hostingRole: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
  },
] as const;

export const SEED_ORG_ROLE_EMAILS = SEED_ORG_ROLE_USERS.map(
  (entry) => entry.email,
);

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

/** Partner-owned Project for cross-Organization scoping checks (Calculator #267).
 * Owned by the Seed Partner Organization so active-Organization checks resolve
 * a seeded foreign Project instead of a private fixture. The name stays outside
 * `SEED_PROJECTS` so hosting-Project counts keep converging on the ten basics. */
export const SEED_PARTNER_PROJECT = {
  name: "Seed Partner Project",
  city: "Lyon",
  country: "FR",
  startDate: "2024-06-10",
  endDate: "2024-06-15",
} as const;

/** Dedicated participant-entry Projects reuse three empty hosting Projects (#268).
 * Each file owns one Project plus its Partnership so per-test token,
 * Participation, and assignment cleanup never touches the showcase slice or
 * another file's rows. Names stay inside `SEED_PROJECTS` so hosting-Project
 * counts keep converging. Entry-only preconditions target these Partnerships,
 * so the showcase single-row read stays stable. */
export const SEED_PARTICIPANT_ENTRY_PROJECT = {
  name: "Sustainability Conference",
  scenarioId: "seed-project-2",
} as const;

export const SEED_PARTICIPANT_INVITATION_PROJECT = {
  name: "Green Energy Symposium",
  scenarioId: "seed-project-3",
} as const;

export const SEED_PARTICIPANT_ONBOARDING_PROJECT = {
  name: "Climate Action Workshop",
  scenarioId: "seed-project-4",
} as const;

/** Stable identity for the seeded Participation without a login (Calculator #267). */
export const SEED_UNLINKED_PARTICIPANT = {
  displayName: "Seed Participation without login",
  email: "seed-unlinked-participant@example.org",
} as const;

/** Seeded Journey on the login-free Participation (Calculator #267). */
export const SEED_UNLINKED_JOURNEY = {
  origin: "Prague",
  destination: "Berlin",
  tripType: "one-way",
  erasmusDistanceKm: "350.00",
} as const;

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
  reviewFixes: SEED_REVIEW_SCENARIOS,
  costTrackerSetupLinks: {
    userIds: [
      "user",
      "host-coordinator",
      "host-participant",
      "host-admin",
      "host-owner",
      "assigned-coordinator",
      "partner-participant",
    ].map((name) => `setup-${name}-canonical`),
    userEmails: [
      "setup-canonical@example.com",
      ...[
        "host-coordinator",
        "host-participant",
        "host-admin",
        "host-owner",
        "assigned-coordinator",
        "partner-participant",
      ].map((name) => `setup-${name}-canonical@example.com`),
    ],
    organizationIds: [
      "host",
      "partner",
      "combined-coordinator,owner",
      "combined-owner,participant",
      "bind",
      "race",
      "rival",
    ].map((name) => `setup-${name}-canonical`),
    projectNames: ["project", "other-project"].map(
      (name) => `Seed Setup Link Project setup-${name}-canonical`,
    ),
  },
  costTrackerSubmission: {
    payoutAccountIds: SUBMISSION_PAYOUT_ACCOUNT_IDS,
    userIds: [
      "submit-actor-canonical",
      "submit-participant-user-canonical",
      ...["host", "partner"].flatMap((side) =>
        ["owner", "admin", "coordinator", "participant"].flatMap((role) =>
          (side === "partner" && (role === "owner" || role === "admin")
            ? ["unassigned"]
            : ["assigned", "unassigned"]
          ).map((scope) => `submit-matrix-${side}-${role}-${scope}-canonical`),
        ),
      ),
    ],
    userEmails: [
      "submit-actor-canonical@example.org",
      "submit-participant-user-canonical@example.org",
      ...["host", "partner"].flatMap((side) =>
        ["owner", "admin", "coordinator", "participant"].flatMap((role) =>
          (side === "partner" && (role === "owner" || role === "admin")
            ? ["unassigned"]
            : ["assigned", "unassigned"]
          ).map(
            (scope) =>
              `submit-matrix-${side}-${role}-${scope}-canonical@example.org`,
          ),
        ),
      ),
    ],
    organizationIds: ["host", "partner", "other"].map(
      (name) => `submit-${name}-canonical`,
    ),
    projectNames: [
      "editable",
      "submitted",
      "rejected",
      "approved",
      "paid",
      "correction",
    ].flatMap((name) => [
      `Seed Submission Project ${name}`,
      `Seed Other Submission Project ${name}`,
    ]),
    participationIds: [
      "editable",
      "submitted",
      "rejected",
      "approved",
      "paid",
      "correction",
    ].flatMap((name) =>
      ["robin", "sam", "outsider", "third"].map(
        (part) => `submit-${name}-${part}-canonical`,
      ),
    ),
  },
  costTrackerParticipations: {
    userIds: [
      ...[
        "actor",
        "candidate",
        "unassigned",
        "current",
        "old",
        "mixed",
        "owner",
        "second-assignee",
        "missing-agreement",
        "missing-profile",
      ].map((name) => `coord-${name}-canonical`),
      ...["unverified", "no-profile", "stale", "wrong-role", "wrong-org"].map(
        (key) => `directory-${key}-canonical`,
      ),
      ...Array.from({ length: 22 }, (_, index) => `capacity-${index}-canonical`),
    ],
    userEmails: [
      "coordinator-canonical@example.org",
      "candidate-canonical@example.org",
      "unassigned-canonical@x.org",
      "current-canonical@x.org",
      "old-canonical@x.org",
      "MIXED-canonical@EXAMPLE.ORG",
      ...["owner", "second-assignee", "missing-agreement", "missing-profile"].map(
        (name) => `coord-${name}-canonical@example.org`,
      ),
      ...["unverified", "no-profile", "stale", "wrong-role", "wrong-org"].map(
        (key) => `directory-${key}-canonical@example.org`,
      ),
      ...Array.from(
        { length: 22 },
        (_, index) => `capacity-${index}-canonical@example.org`,
      ),
    ],
    organizationIds: ["host", "partner", "other"].map(
      (name) => `coord-${name}-canonical`,
    ),
    projectNames: [
      "empty",
      "email",
      "mixed",
      "old-email",
      "foreign-invitation",
      "own-invitation",
      "referenced",
      "submitted",
      "correction",
      "report",
      "report-empty",
    ].map((name) => `Seed Participation Project ${name}`),
    participationIds: [
      ...[
        "email",
        "mixed",
        "old-email",
        "referenced",
        "submitted",
        "correction",
      ].map((name) => `coord-${name}-row-canonical`),
      "coord-unjoined-canonical",
      "coord-current-row-canonical",
      "coord-old-row-canonical",
    ],
  },
  costTrackerProjects: {
    userIds: [
      "readiness-actor-canonical",
      "readiness-other-user-canonical",
      ...["owner", "admin", "coordinator", "participant"].flatMap((role) =>
        ["assigned", "unassigned"].map(
          (scope) => `readiness-${scope}-${role}-canonical`,
        ),
      ),
      "detail-user-canonical",
      "list-user-canonical",
      ...["participant", "coordinator", "participant,coordinator"].map(
        (role) => `list-${role}-canonical`,
      ),
      "relationship-user-canonical",
      "discovery-coord-canonical",
      "discovery-stranger-canonical",
    ],
    userEmails: [
      "readiness-actor-canonical@example.org",
      "readiness-other-user-canonical@example.org",
      ...["owner", "admin", "coordinator", "participant"].flatMap((role) =>
        ["assigned", "unassigned"].map(
          (scope) => `readiness-${scope}-${role}-canonical@example.org`,
        ),
      ),
      "detail-user-canonical@example.com",
      "list-user-canonical@example.com",
      ...["participant", "coordinator", "participant-coordinator"].map(
        (role) => `list-${role}-canonical@example.org`,
      ),
      "relationship-user-canonical@example.com",
      "discovery-coord-canonical@example.com",
      "discovery-stranger-canonical@example.com",
    ],
    organizationIds: [
      "readiness-host",
      "readiness-partner-a",
      "readiness-partner-b",
      "readiness-partner-c",
      "detail-host",
      "detail-partner",
      "detail-unrelated",
      "list-host",
      "list-foreign-host",
      "list-partner",
      "list-second-partner",
      "list-unrelated",
      "relationship-host",
      "relationship-partner",
      "relationship-unrelated",
      "discovery-host",
      "discovery-partner",
    ].map((name) => `${name}-canonical`),
    projectNames: [
      ...[
        "empty",
        "mixed",
        "claimless-partial",
        "terminal",
        "editable",
        "submitted",
        "correction_requested",
        "approved",
      ].flatMap((name) =>
        ["project", "other-project"].map(
          (part) => `readiness-${name}-${part}-canonical`,
        ),
      ),
      "Detail Project",
      "Alpha Open Workshop",
      "Beta Closed Forum",
      "Climate Assembly",
      "Foreign Partner Project",
      "Archived Project",
      ...Array.from(
        { length: 26 },
        (_, index) => `Generated Project ${index.toString().padStart(2, "0")}`,
      ),
      "Relationship Project",
      "Archived Relationship Project",
      "discovery-assigned-canonical",
      "discovery-foreign-canonical",
    ],
    participationIds: [],
  },
  costTrackerJourneys: {
    userIds: ["journey-coordinator-canonical", "journey-user-canonical"],
    userEmails: [
      "journey-coordinator-canonical@example.org",
      "journey-user-canonical@example.org",
    ],
    organizationIds: ["host", "partner", "other"].map(
      (name) => `journey-${name}-canonical`,
    ),
    projectNames: [
      "empty",
      "editable",
      "legacy",
      "correction_requested",
      "submitted",
      "approved",
      "rejected",
      "paid",
    ].flatMap((name) =>
      ["project", "second-project"].map(
        (part) => `Seed Journey Project journey-${name}-${part}-canonical`,
      ),
    ),
    participationIds: [
      "empty",
      "editable",
      "legacy",
      "correction_requested",
      "submitted",
      "approved",
      "rejected",
      "paid",
    ].flatMap((name) =>
      ["first", "second", "outside", "later"].map(
        (part) => `journey-${name}-${part}-canonical`,
      ),
    ),
  },
  costTrackerPartnerships: {
    userIds: [
      "partnership-user-canonical",
      "partnership-visibility-coord-canonical",
      "partnership-visibility-stranger-canonical",
    ],
    userEmails: [
      "partnership-user-canonical",
      "partnership-visibility-coord-canonical",
      "partnership-visibility-stranger-canonical",
    ].map((id) => `${id}@example.com`),
    organizationIds: [
      "host",
      "foreign-host",
      "assigned-org",
      "removable-org",
      "candidate-org",
      "race-org",
      "visibility-host",
      "visibility-partner",
    ].map((name) => `partnership-${name}-canonical`),
    projectNames: [
      "Managed Project",
      "Foreign Managed Project",
      "partnership-visibility-own-canonical",
      "partnership-visibility-other-canonical",
    ],
    participationIds: ["partnership-participation-canonical"],
  },
  costTrackerEntitySearch: {
    suffix: "canonical",
    userIds: [
      "picker-user-canonical",
      "picker-coordinator-canonical",
      "picker-unassigned-coordinator-canonical",
      "picker-participant-canonical",
    ],
    userEmails: [
      "user",
      "coordinator",
      "unassigned-coordinator",
      "participant",
    ].map((name) => `picker-${name}-canonical@example.com`),
    coordinatorUserId: "picker-coordinator-canonical",
    unassignedCoordinatorUserId: "picker-unassigned-coordinator-canonical",
    participantUserId: "picker-participant-canonical",
    organizationIds: [
      "picker-host-canonical",
      "picker-partner-canonical",
      "picker-foreign-canonical",
      ...Array.from({ length: 22 }, (_, i) => `picker-result-${i}-canonical`),
      ...Array.from({ length: 55 }, (_, i) => `owned-result-${i}-canonical`),
      ...SEED_ENTITY_SEARCH.manyOrganizations.map(({ id }) => id),
    ],
    projectNames: [
      "picker-assigned-canonical",
      "picker-unassigned-canonical",
      "picker-foreign-project-canonical",
    ].map((id) => `Project ${id}`),
    ownedOrganizations: SEED_ENTITY_SEARCH.ownedOrganizations,
    manyOrganizations: SEED_ENTITY_SEARCH.manyOrganizations,
  },
  costTrackerOnboardingProgress: {
    userIds: [
      "progress-coordinator-canonical",
      "progress-joined-canonical",
      "progress-pending-canonical",
      "progress-revoked-canonical",
      "progress-outsider-canonical",
    ],
    userEmails: ["coordinator", "joined", "pending", "revoked", "outsider"].map(
      (name) => `progress-${name}-canonical-canonical@example.org`,
    ),
    organizationIds: [
      "progress-host-canonical",
      "progress-partner-canonical",
      "progress-other-canonical",
    ],
    projectNames: [
      "Seed Onboarding Progress Project",
      "Seed Expired Onboarding Progress Project",
    ],
    projectIds: [
      "progress-project-canonical",
      "progress-expired-project-canonical",
    ],
    participationIds: [
      "progress-joined-participation-canonical",
      "progress-outsider-participation-canonical",
      "progress-unlinked-participation-canonical",
      "progress-expired-joined-participation-canonical",
    ],
    projectId: "progress-project-canonical",
    coordinatorId: "progress-coordinator-canonical",
    partnershipId: "progress-own-canonical",
    pendingInvitationId: "new-canonical",
    invitationExpiresAt: null,
    expiredPartnershipId: "progress-expired-partnership-canonical",
    expiredInvitationId: "progress-expired-invitation-canonical",
  },
  costTrackerClaims: {
    userIds: [
      "claim-coordinator-canonical",
      "claim-participant-canonical",
      "claim-owner-canonical",
    ],
    payoutAccountIds: [
      "claim-account-canonical",
      "claim-second-account-canonical",
      "claim-foreign-account-canonical",
    ],
    userEmails: [
      "claim-coordinator-canonical@example.org",
      "claim-participant-canonical@example.org",
      "claim-owner-canonical@example.org",
    ],
    organizationIds: [
      "claim-host-canonical",
      "claim-partner-canonical",
      "claim-other-canonical",
    ],
    projectNames: [
      "Seed Claim Project",
      "Seed Editable Claim Project",
      "Seed Submitted Claim Project",
      "Seed Submitted Selected Claim Project",
    ],
    projectId: "claim-project-canonical",
    coordinatorId: "claim-coordinator-canonical",
    participantId: "claim-participant-canonical",
    partnershipId: "claim-own-canonical",
    editablePartnershipId: "claim-editable-canonical",
    submittedPartnershipId: "claim-submitted-canonical",
    submittedSelectedPartnershipId: "claim-submitted-selected-canonical",
  },
  costTrackerCosts: {
    userIds: ["cost-coordinator-canonical", "cost-user-canonical"],
    userEmails: [
      "cost-coordinator-canonical@example.org",
      "cost-user-canonical@example.org",
    ],
    organizationIds: [
      "cost-host-canonical",
      "cost-partner-canonical",
      "cost-other-canonical",
    ],
    projectNames: [
      "Seed Cost Project",
      "Seed Second Cost Project",
      "Seed Submitted Cost Project",
    ],
    participationIds: [
      "cost-first-canonical",
      "cost-second-canonical",
      "cost-third-canonical",
      "cost-outside-canonical",
      "cost-later-canonical",
      "cost-locked-participant-canonical",
    ],
    projectId: "cost-project-canonical",
    coordinatorId: "cost-coordinator-canonical",
    participantId: "cost-user-canonical",
    partnershipId: "cost-own-canonical",
    claimId: "cost-claim-canonical",
    proofDocumentId: "cost-proof-canonical",
    submittedPartnershipId: "cost-locked-partnership-canonical",
    submittedClaimId: "cost-locked-claim-canonical",
    submittedEntryId: "cost-locked-entry-canonical",
    submittedProofDocumentId: "cost-locked-proof-canonical",
    submittedParticipantId: "cost-locked-participant-canonical",
  },
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
  costTrackerPartnerOwner: {
    kind: "user",
    email: "seed-cost-tracker-partner-owner@example.org",
    description:
      "Owner of the primary Partner Organization only; HTTP tenant-isolation actor with no Hosting Membership.",
  },
  ownerUser: {
    kind: "user",
    email: SEED_USER.email,
    name: SEED_USER.name,
    description:
      "Seed organization owner, host coordinator, partner coordinator, and showcase Participant.",
  },
  adminUser: {
    kind: "user",
    email: "seed-admin@example.org",
    name: "Seed Admin",
    hostingRole: ORGANIZATION_ROLES.OrganizationAdmin,
    description:
      "Seed Hosting Organization administrator for staff-invite and permission checks.",
  },
  coordinatorUser: {
    kind: "user",
    email: "seed-coordinator@example.org",
    name: "Seed Coordinator",
    hostingRole: ORGANIZATION_ROLES.ProjectCoordinator,
    description:
      "Seed Hosting Organization coordinator for staff/assignment scope checks.",
  },
  participantUser: {
    kind: "user",
    email: "seed-participant@example.org",
    name: "Seed Participant",
    hostingRole: ORGANIZATION_ROLES.Participant,
    description:
      "Seed Hosting Organization participant for negative authorization scenarios.",
  },
  hybridAdminUser: {
    kind: "user",
    email: "seed-hybrid-admin@example.org",
    name: "Seed Hybrid Admin",
    hostingRole: `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`,
    description:
      "Seed combined-authority administrator for membership role-matrix checks.",
  },
  hybridCoordinatorUser: {
    kind: "user",
    email: "seed-hybrid-coordinator@example.org",
    name: "Seed Hybrid Coordinator",
    hostingRole: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
    description:
      "Seed combined-authority coordinator for membership role-matrix checks.",
  },
  outsiderUser: {
    kind: "user",
    email: "seed-outsider@example.org",
    name: "Seed Outsider",
    description:
      "Seed membership-free user: outsider-denied scenarios and Cost Tracker case-Organization creator. Restore to memberless after use.",
  },
  creatorUser: {
    kind: "user",
    email: "seed-creator@example.org",
    name: "Seed Creator",
    description:
      "Second membership-free user so parallel creator files never contend on one memberless gate. Restore to memberless after use.",
  },
  participantEntryPreconditions: {
    kind: "participant-entry",
    description:
      "Assigned seed-coordinator on all entry Projects; login-free seed-entry-details@example.org Participation; pending seed-entry-colleague@example.org staff invitation (runtime ID, canonical expiry 9999-12-31). Dedicated seed-onboarding-{owner,admin,participant,coordinator,combined}@example.org and seed-invitation-coordinator@example.org Hosting role actors preserve Membership-grant coverage. Restore changed preconditions after every case.",
  },
  secondPartnerOrganization: {
    kind: "organization",
    slug: SEED_SECOND_PARTNER_ORGANIZATION.slug,
    name: SEED_SECOND_PARTNER_ORGANIZATION.name,
    country: SEED_SECOND_PARTNER_ORGANIZATION.country,
    description:
      "Second Partner Organization carrying the isolated entry, invitation, and onboarding Partnerships.",
  },
  thirdPartnerOrganization: {
    kind: "organization",
    slug: SEED_THIRD_PARTNER_ORGANIZATION.slug,
    name: SEED_THIRD_PARTNER_ORGANIZATION.name,
    country: SEED_THIRD_PARTNER_ORGANIZATION.country,
    description:
      "Third Partner Organization for second-join checks on the onboarding Project.",
  },
  inviteeUser: {
    kind: "user",
    email: "seed-invitee@example.org",
    name: "Seed Invitee",
    description:
      "Canonical Participant Invitation recipient; joins through procedures under test. Restore to no Membership/Participation after use.",
  },
  secondInviteeUser: {
    kind: "user",
    email: "seed-second-invitee@example.org",
    name: "Seed Second Invitee",
    description:
      "Second canonical joiner for wrong-account and multi-user link checks. Restore to no Membership/Participation after use.",
  },
  onboardingInviteeUser: {
    kind: "user",
    email: "seed-onboarding-invitee@example.org",
    name: "Seed Onboarding Invitee",
    description:
      "Canonical joiner for the onboarding Project; isolated from the invitation Project Invitees so parallel files never contend on one host Membership. Restore to no Membership/Participation after use.",
  },
  secondOnboardingInviteeUser: {
    kind: "user",
    email: "seed-second-onboarding-invitee@example.org",
    name: "Seed Second Onboarding Invitee",
    description:
      "Second canonical joiner for the onboarding Project multi-user link check. Restore to no Membership/Participation after use.",
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
  participantWithoutJourney: {
    kind: "participation",
    projectScenarioId: SEED_SHOWCASE.projectScenarioId,
    email: "seed-participant@example.org",
    displayName: "Seed Participant",
    description:
      "Seed linked Participation without a Participant Journey for journey-null reads.",
  },
  unlinkedParticipation: {
    kind: "participation",
    projectScenarioId: SEED_SHOWCASE.projectScenarioId,
    email: SEED_UNLINKED_PARTICIPANT.email,
    displayName: SEED_UNLINKED_PARTICIPANT.displayName,
    description:
      "Seed login-free Participation for Participation-owned display-field reads.",
  },
  unlinkedJourney: {
    kind: "journey",
    ...SEED_UNLINKED_JOURNEY,
    description: "Prague to Berlin one-way Participant Journey (350 km).",
  },
  partnerProject: {
    kind: "project",
    name: SEED_PARTNER_PROJECT.name,
    description:
      "Seed Partner Organization-owned Project for cross-Organization scoping checks.",
  },
  participantEntryProject: {
    kind: "project",
    scenarioId: SEED_PARTICIPANT_ENTRY_PROJECT.scenarioId,
    name: SEED_PARTICIPANT_ENTRY_PROJECT.name,
    description:
      "Isolated Project for participant-entry authorization checks; Partnership to the second Partner Organization.",
  },
  participantInvitationProject: {
    kind: "project",
    scenarioId: SEED_PARTICIPANT_INVITATION_PROJECT.scenarioId,
    name: SEED_PARTICIPANT_INVITATION_PROJECT.name,
    description:
      "Isolated Project for Participant Invitation lifecycle checks; Partnership to the second Partner Organization.",
  },
  participantOnboardingProject: {
    kind: "project",
    scenarioId: SEED_PARTICIPANT_ONBOARDING_PROJECT.scenarioId,
    name: SEED_PARTICIPANT_ONBOARDING_PROJECT.name,
    description:
      "Isolated Project for onboarding checks; Partnerships to the second and third Partner Organizations.",
  },
} as const;

export interface SeedSummary {
  userId: string;
  organizationId: string;
  partnerOrganizationId: string;
  /** Second Partner Organization for entry/invitation/onboarding flows (#268). */
  secondPartnerOrganizationId: string;
  /** Third Partner Organization for second-join checks (#268). */
  thirdPartnerOrganizationId: string;
  projectIds: string[];
  /** Partner-owned Project for cross-Organization scoping checks (#267). */
  partnerProjectId: string;
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
  const hashedPassword = await hashPassword(SEED_USER.password);
  const existing = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
  });
  if (existing) {
    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      );
    return;
  }
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
  definition:
    | typeof SEED_ORGANIZATION
    | typeof SEED_PARTNER_ORGANIZATION
    | typeof SEED_SECOND_PARTNER_ORGANIZATION
    | typeof SEED_THIRD_PARTNER_ORGANIZATION,
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

/**
 * Named Hosting Organization actors for #266 (find-or-create, never
 * rewrites developer-modified seed rows). The outsider intentionally keeps
 * zero Memberships so outsider-denied and first-Organization-creation
 * scenarios resolve seeded rows.
 */
async function ensureSeedOrgRoleUsers(
  db: SeedDatabase,
  orgId: string,
): Promise<void> {
  for (const entry of SEED_ORG_ROLE_USERS) {
    const existing = await db.query.user.findFirst({
      where: eq(user.email, entry.email),
    });
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      userId = createId();
      await db.insert(user).values({
        id: userId,
        name: entry.name,
        email: entry.email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ User created: ${entry.email} (ID: ${userId})`);
    }
    await ensurePasswordAccount(db, userId);
    if (entry.hostingRole !== null) {
      await ensureMembership(db, orgId, userId, entry.hostingRole, new Date());
    }
  }
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
 * Participant-entry preconditions (#268): isolated Partnerships plus Partner-side
 * role Memberships. Each file owns one Project so per-test token,
 * Participation, and assignment cleanup never touches the showcase slice or
 * another file's rows. Partnerships target only the second/third Partner
 * Organizations, never the primary one, so the showcase single-row read keeps
 * converging on one row. Entry-only assignment, staff-invitation and details
 * preconditions are named in SEED_SCENARIOS; no Participant entry tokens,
 * Claims, profiles or acceptances are pre-created. Partner Memberships mirror
 * the Hosting roles so the role matrix resolves fixed seeded users instead of
 * mutating one Membership. All steps are find-or-create and never rewrite
 * developer-modified rows.
 */
async function ensureParticipantEntryState(
  db: SeedDatabase,
  hostOrgId: string,
  ownerId: string,
  secondPartnerId: string,
  thirdPartnerId: string,
): Promise<void> {
  const hostMembership = await db.query.member.findFirst({
    where: (members, { and }) =>
      and(eq(members.userId, ownerId), eq(members.organizationId, hostOrgId)),
  });
  const secondMembershipAt = hostMembership
    ? new Date(hostMembership.createdAt.getTime() - 2000)
    : new Date();
  await ensureMembership(
    db,
    secondPartnerId,
    ownerId,
    ORGANIZATION_ROLES.OrganizationOwner,
    secondMembershipAt,
  );
  await ensureMembership(
    db,
    thirdPartnerId,
    ownerId,
    ORGANIZATION_ROLES.OrganizationOwner,
    secondMembershipAt,
  );
  const roleEntries = SEED_ORG_ROLE_USERS.filter(
    (entry) =>
      entry.hostingRole !== null &&
      !entry.key.startsWith("onboarding") &&
      !entry.key.startsWith("invitation"),
  );
  for (const entry of roleEntries) {
    const stored = await db.query.user.findFirst({
      where: eq(user.email, entry.email),
    });
    if (stored && entry.hostingRole !== null) {
      const hostRoleMembership = await db.query.member.findFirst({
        where: (members, { and }) =>
          and(
            eq(members.userId, stored.id),
            eq(members.organizationId, hostOrgId),
          ),
      });
      const secondAt = hostRoleMembership
        ? new Date(hostRoleMembership.createdAt.getTime() - 2000)
        : new Date();
      await ensureMembership(
        db,
        secondPartnerId,
        stored.id,
        entry.hostingRole,
        secondAt,
      );
    }
  }
  const pairs: { projectName: string; organizationId: string }[] = [
    {
      projectName: SEED_PARTICIPANT_ENTRY_PROJECT.name,
      organizationId: secondPartnerId,
    },
    {
      projectName: SEED_PARTICIPANT_INVITATION_PROJECT.name,
      organizationId: secondPartnerId,
    },
    {
      projectName: SEED_PARTICIPANT_ONBOARDING_PROJECT.name,
      organizationId: secondPartnerId,
    },
    {
      projectName: SEED_PARTICIPANT_ONBOARDING_PROJECT.name,
      organizationId: thirdPartnerId,
    },
  ];
  for (const pair of pairs) {
    const project = await db.query.projectsTable.findFirst({
      where: (projects, { and }) =>
        and(
          eq(projects.organizationId, hostOrgId),
          eq(projects.name, pair.projectName),
        ),
    });
    if (!project) continue;
    const existing = await db.query.projectPartnerOrganizationsTable.findFirst({
      where: (partnerships, { and }) =>
        and(
          eq(partnerships.projectId, project.id),
          eq(partnerships.organizationId, pair.organizationId),
        ),
    });
    if (!existing) {
      await db.insert(projectPartnerOrganizationsTable).values({
        id: createId(),
        projectId: project.id,
        organizationId: pair.organizationId,
      });
      console.log(
        `  ✅ Partnership: ${pair.projectName} ↔ ${pair.organizationId.slice(0, 8)}`,
      );
    }
    const partnership = await db.query.projectPartnerOrganizationsTable.findFirst(
      {
        where: and(
          eq(projectPartnerOrganizationsTable.projectId, project.id),
          eq(
            projectPartnerOrganizationsTable.organizationId,
            pair.organizationId,
          ),
        ),
      },
    );
    const coordinator = await db.query.user.findFirst({
      where: eq(user.email, "seed-coordinator@example.org"),
    });
    if (coordinator && partnership && pair.organizationId === secondPartnerId) {
      const assignment =
        await db.query.partnerCoordinatorAssignmentsTable.findFirst({
          where: and(
            eq(partnerCoordinatorAssignmentsTable.partnershipId, partnership.id),
            eq(partnerCoordinatorAssignmentsTable.userId, coordinator.id),
          ),
        });
      if (!assignment)
        await db
          .insert(partnerCoordinatorAssignmentsTable)
          .values({ partnershipId: partnership.id, userId: coordinator.id });
      const hostAssignment = await db.query.hostProjectAssignmentsTable.findFirst(
        {
          where: and(
            eq(hostProjectAssignmentsTable.projectId, project.id),
            eq(hostProjectAssignmentsTable.userId, coordinator.id),
          ),
        },
      );
      if (!hostAssignment)
        await db
          .insert(hostProjectAssignmentsTable)
          .values({ projectId: project.id, userId: coordinator.id });
    }
    if (pair.projectName === SEED_PARTICIPANT_ENTRY_PROJECT.name) {
      const participation = await db.query.projectParticipantsTable.findFirst({
        where: and(
          eq(projectParticipantsTable.projectId, project.id),
          eq(projectParticipantsTable.email, "seed-entry-details@example.org"),
        ),
      });
      if (!participation)
        await db.insert(projectParticipantsTable).values({
          projectId: project.id,
          representedOrganizationId: secondPartnerId,
          displayName: "Joining Participant",
          email: "seed-entry-details@example.org",
        });
    }
  }
  // Staff invitation is a list precondition, never participant issuance. Its ID is
  // generated at runtime. Pending-list checks do not redeem it; a far-future
  // canonical expiry keeps this reference-calendar scenario independent of today.
  const staffInvitation = await db.query.invitation.findFirst({
    where: and(
      eq(schema.invitation.organizationId, secondPartnerId),
      eq(schema.invitation.email, "seed-entry-colleague@example.org"),
    ),
  });
  if (!staffInvitation)
    await db.insert(schema.invitation).values({
      id: createId(),
      organizationId: secondPartnerId,
      email: "seed-entry-colleague@example.org",
      role: ORGANIZATION_ROLES.OrganizationAdmin,
      status: "pending",
      expiresAt: new Date("9999-12-31T00:00:00Z"),
      inviterId: ownerId,
    });
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

  console.log("👥 Ensuring named Hosting Organization role actors...");
  await ensureSeedOrgRoleUsers(db, orgId);

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
    // Journey-null reads (#267): a linked Participation that intentionally
    // keeps no Participant Journey. Looked up by stable email, never duplicated.
    const participantActor = await tx.query.user.findFirst({
      where: eq(user.email, "seed-participant@example.org"),
    });
    const existingBareParticipation =
      await tx.query.projectParticipantsTable.findFirst({
        where: (participants, { and }) =>
          and(
            eq(participants.projectId, projectId),
            eq(participants.email, "seed-participant@example.org"),
          ),
      });
    if (!existingBareParticipation && participantActor) {
      await tx.insert(projectParticipantsTable).values({
        id: createId(),
        projectId,
        representedOrganizationId: partnerId,
        userId: participantActor.id,
        displayName: participantActor.name,
        email: participantActor.email,
        country: SEED_PARTNER_ORGANIZATION.country,
      });
    }
    // Participation-owned display fields (#267): a login-free Participation
    // with its own Journey. No User row, no allocation, so the showcase
    // claim slice keeps resolving to exactly one row.
    const existingUnlinkedParticipation =
      await tx.query.projectParticipantsTable.findFirst({
        where: (participants, { and }) =>
          and(
            eq(participants.projectId, projectId),
            eq(participants.email, SEED_UNLINKED_PARTICIPANT.email),
          ),
      });
    let unlinkedParticipationId: string | null = null;
    if (existingUnlinkedParticipation) {
      unlinkedParticipationId = existingUnlinkedParticipation.id;
    } else {
      unlinkedParticipationId = createId();
      await tx.insert(projectParticipantsTable).values({
        id: unlinkedParticipationId,
        projectId,
        representedOrganizationId: partnerId,
        userId: null,
        displayName: SEED_UNLINKED_PARTICIPANT.displayName,
        email: SEED_UNLINKED_PARTICIPANT.email,
        country: SEED_PARTNER_ORGANIZATION.country,
      });
    }
    const existingUnlinkedJourney =
      await tx.query.participantJourneysTable.findFirst({
        where: eq(
          participantJourneysTable.projectParticipantId,
          unlinkedParticipationId,
        ),
      });
    if (!existingUnlinkedJourney && unlinkedParticipationId) {
      await tx.insert(participantJourneysTable).values({
        projectParticipantId: unlinkedParticipationId,
        origin: SEED_UNLINKED_JOURNEY.origin,
        destination: SEED_UNLINKED_JOURNEY.destination,
        tripType: SEED_UNLINKED_JOURNEY.tripType,
        erasmusDistanceKm: SEED_UNLINKED_JOURNEY.erasmusDistanceKm,
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

  const costTrackerPartnerOwner = await db.query.user.findFirst({
    where: eq(user.email, SEED_SCENARIOS.costTrackerPartnerOwner.email),
  });
  if (partnerOrganization && costTrackerPartnerOwner) {
    await ensureMembership(
      db,
      partnerOrganization.id,
      costTrackerPartnerOwner.id,
      ORGANIZATION_ROLES.OrganizationOwner,
      new Date(),
    );
  }

  // Partner-owned Project for cross-Organization scoping checks (#267).
  // Find-or-create by stable name inside the Partner Organization; it carries
  // no partnership, legs, or participations so showcase counts keep converging.
  let partnerProjectId = "";
  if (partnerOrganization) {
    const existingPartnerProject = await db.query.projectsTable.findFirst({
      where: (projects, { and }) =>
        and(
          eq(projects.organizationId, partnerOrganization.id),
          eq(projects.name, SEED_PARTNER_PROJECT.name),
        ),
    });
    if (existingPartnerProject) {
      partnerProjectId = existingPartnerProject.id;
    } else {
      partnerProjectId = createId();
      await db.insert(projectsTable).values({
        id: partnerProjectId,
        name: SEED_PARTNER_PROJECT.name,
        startDate: new Date(`${SEED_PARTNER_PROJECT.startDate}T00:00:00Z`),
        endDate: new Date(`${SEED_PARTNER_PROJECT.endDate}T00:00:00Z`),
        location: SEED_PARTNER_PROJECT.city,
        country: SEED_PARTNER_PROJECT.country,
        welcomeMessage: `Welcome to ${SEED_PARTNER_PROJECT.name}!`,
        organizationId: partnerOrganization.id,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`  ✅ Partner Project: ${SEED_PARTNER_PROJECT.name}`);
    }
  }

  console.log("🤝 Ensuring participant-entry Partnerships and Partner roles...");
  const secondPartnerId = await ensureSeedOrganization(
    db,
    SEED_SECOND_PARTNER_ORGANIZATION,
  );
  const thirdPartnerId = await ensureSeedOrganization(
    db,
    SEED_THIRD_PARTNER_ORGANIZATION,
  );
  if (secondPartnerId && thirdPartnerId) {
    await ensureParticipantEntryState(
      db,
      orgId,
      userId,
      secondPartnerId,
      thirdPartnerId,
    );
  }
  console.log(
    "✅ Participant-entry Projects share seeded Partnerships; Invitees stay membership-free",
  );

  const reviewUserId = await ensureReviewScenarios(
    db,
    orgId,
    partnerOrganization!.id,
    secondPartnerId,
    userId,
    SEED_ORG_ROLE_USERS.filter(({ hostingRole }) => hostingRole !== null).map(
      ({ email }) => email,
    ),
  );
  for (const scenarioUserId of [
    reviewUserId,
    ...(await ensureCostTrackerScenarios(db)),
  ]) {
    await ensurePasswordAccount(db, scenarioUserId);
  }

  return {
    userId,
    organizationId: orgId,
    partnerOrganizationId: partnerOrganization?.id ?? "",
    secondPartnerOrganizationId: secondPartnerId,
    thirdPartnerOrganizationId: thirdPartnerId,
    projectIds,
    partnerProjectId,
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
  const remainingPayoutAccounts = await db.query.payoutAccountsTable.findMany({
    where: inArray(payoutAccountsTable.organizationId, seedOrgIds),
  });
  const blockedOrgIds = new Set([
    ...remainingPayoutAccounts.map(
      (payoutAccount) => payoutAccount.organizationId,
    ),
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
  const seedEmails = [
    SEED_USER.email,
    ...SEED_ORG_ROLE_EMAILS,
    SEED_REVIEW_SCENARIOS.newestMembership.email,
    ...SEED_SCENARIOS.costTrackerSetupLinks.userEmails,
    ...SEED_SCENARIOS.costTrackerSubmission.userEmails,
    ...SEED_SCENARIOS.costTrackerParticipations.userEmails,
    ...SEED_SCENARIOS.costTrackerProjects.userEmails,
    ...SEED_SCENARIOS.costTrackerJourneys.userEmails,
    ...SEED_SCENARIOS.costTrackerPartnerships.userEmails,
    ...SEED_SCENARIOS.costTrackerEntitySearch.userEmails,
    ...SEED_SCENARIOS.costTrackerClaims.userEmails,
    ...SEED_SCENARIOS.costTrackerCosts.userEmails,
    ...SEED_SCENARIOS.costTrackerOnboardingProgress.userEmails,
  ];
  const seedUsers = await db.query.user.findMany({
    where: inArray(user.email, seedEmails),
  });
  const seedUserByEmail = new Map(seedUsers.map((entry) => [entry.email, entry]));
  const seedUser = seedUserByEmail.get(SEED_USER.email);
  const seedOrganizations = await db.query.organization.findMany({
    where: inArray(organization.slug, [
      SEED_ORGANIZATION.slug,
      SEED_PARTNER_ORGANIZATION.slug,
      SEED_SECOND_PARTNER_ORGANIZATION.slug,
      SEED_THIRD_PARTNER_ORGANIZATION.slug,
      SEED_REVIEW_SCENARIOS.staffInvitations.organizationId,
      SEED_REVIEW_SCENARIOS.newestMembership.olderOrganizationId,
      SEED_REVIEW_SCENARIOS.newestMembership.newestOrganizationId,
      ...SEED_SCENARIOS.costTrackerSetupLinks.organizationIds,
      ...SEED_SCENARIOS.costTrackerSubmission.organizationIds,
      ...SEED_SCENARIOS.costTrackerParticipations.organizationIds,
      ...SEED_SCENARIOS.costTrackerProjects.organizationIds,
      ...SEED_SCENARIOS.costTrackerJourneys.organizationIds,
      ...SEED_SCENARIOS.costTrackerPartnerships.organizationIds,
      ...SEED_SCENARIOS.costTrackerEntitySearch.organizationIds,
      ...SEED_SCENARIOS.costTrackerClaims.organizationIds,
      ...SEED_SCENARIOS.costTrackerCosts.organizationIds,
      ...SEED_SCENARIOS.costTrackerOnboardingProgress.organizationIds,
    ]),
  });
  const seedOrgIds = seedOrganizations.map((org) => org.id);
  const canonicalNames = [
    ...SEED_PROJECTS.map((project) => project.name),
    SEED_PARTNER_PROJECT.name,
    ...SEED_REVIEW_SCENARIOS.restProjects.map(({ name }) => name),
    "Seed Submitted Registration Project",
    "Seed Travel Leg Management Project",
    ...SEED_SCENARIOS.costTrackerSetupLinks.projectNames,
    ...SEED_SCENARIOS.costTrackerSubmission.projectNames,
    ...SEED_SCENARIOS.costTrackerParticipations.projectNames,
    ...SEED_SCENARIOS.costTrackerProjects.projectNames,
    ...SEED_SCENARIOS.costTrackerJourneys.projectNames,
    ...SEED_SCENARIOS.costTrackerPartnerships.projectNames,
    ...SEED_SCENARIOS.costTrackerEntitySearch.projectNames,
    ...SEED_SCENARIOS.costTrackerClaims.projectNames,
    ...SEED_SCENARIOS.costTrackerCosts.projectNames,
    ...SEED_SCENARIOS.costTrackerOnboardingProgress.projectNames,
  ];
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
    await db
      .delete(participantEntryTokensTable)
      .where(
        inArray(participantEntryTokensTable.projectId, [
          ...SEED_SCENARIOS.costTrackerOnboardingProgress.projectIds,
        ]),
      );
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
      await db
        .delete(duplicateReviewTasksTable)
        .where(
          inArray(
            duplicateReviewTasksTable.partnershipId,
            partnershipIds as string[],
          ),
        );
      const claims = await db.query.claimsTable.findMany({
        where: inArray(claimsTable.partnershipId, partnershipIds as string[]),
      });
      const claimIds = claims.map((claim) => claim.id);
      if (claimIds.length > 0) {
        await db
          .delete(claimHistoryTable)
          .where(inArray(claimHistoryTable.claimId, claimIds as string[]));
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
    // Seed-owned Participations on canonical Projects: the showcase Owner
    // row plus the #267 journey-scenario rows (linked bare Participation,
    // login-free Participation) plus #268 Invitee rows left by interrupted
    // runs. Matched by stable seed email so developer Participations on the
    // same Projects survive a reset.
    const seedParticipationEmails = new Set([
      SEED_USER.email,
      "seed-participant@example.org",
      SEED_UNLINKED_PARTICIPANT.email,
      "seed-entry-details@example.org",
      "seed-invitee@example.org",
      "seed-second-invitee@example.org",
      "seed-onboarding-invitee@example.org",
      "seed-second-onboarding-invitee@example.org",
    ]);
    const costTrackerScenarioParticipationIds = new Set<string>([
      ...SEED_SCENARIOS.costTrackerSubmission.participationIds,
      ...SEED_SCENARIOS.costTrackerParticipations.participationIds,
      ...SEED_SCENARIOS.costTrackerProjects.participationIds,
      ...SEED_SCENARIOS.costTrackerJourneys.participationIds,
      ...SEED_SCENARIOS.costTrackerPartnerships.participationIds,
      ...SEED_SCENARIOS.costTrackerCosts.participationIds,
      ...SEED_SCENARIOS.costTrackerOnboardingProgress.participationIds,
    ]);
    const seedParticipations = participations.filter(
      (participation) =>
        costTrackerScenarioParticipationIds.has(participation.id) ||
        (participation.email !== null &&
          seedParticipationEmails.has(participation.email) &&
          (participation.email !== SEED_USER.email ||
            !seedUser ||
            participation.userId === seedUser.id)),
    );
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
  const seedUserIds = seedUsers.map((entry) => entry.id);
  if (seedUserIds.length > 0 && seedOrgIds.length > 0) {
    await db
      .delete(member)
      .where(
        and(
          inArray(member.userId, seedUserIds as string[]),
          inArray(member.organizationId, seedOrgIds as string[]),
        ),
      );
    for (const seedUserId of seedUserIds) {
      await db
        .delete(participantProfilesTable)
        .where(eq(participantProfilesTable.userId, seedUserId));
    }
  }
  // A canonical Payout Account can be reused by a developer Partnership.
  // Preserve it when a surviving selection references it, just like other dependents.
  const canonicalPayoutAccountIds = [
    ...SEED_SCENARIOS.costTrackerClaims.payoutAccountIds,
    ...SEED_SCENARIOS.costTrackerSubmission.payoutAccountIds,
  ];
  const survivingSelections =
    await db.query.partnershipPayoutAccountsTable.findMany({
      where: inArray(partnershipPayoutAccountsTable.payoutAccountId, [
        ...canonicalPayoutAccountIds,
      ]),
    });
  const referencedPayoutAccountIds = new Set(
    survivingSelections.map((selection) => selection.payoutAccountId),
  );
  const removablePayoutAccountIds = canonicalPayoutAccountIds.filter(
    (id) => !referencedPayoutAccountIds.has(id),
  );
  if (removablePayoutAccountIds.length > 0) {
    await db
      .delete(payoutAccountsTable)
      .where(inArray(payoutAccountsTable.id, removablePayoutAccountIds));
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
  if (seedUserIds.length > 0) {
    for (const seedUserId of seedUserIds) {
      await db.delete(account).where(eq(account.userId, seedUserId));
      await db.delete(user).where(eq(user.id, seedUserId));
    }
    users = seedUserIds.length;
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
