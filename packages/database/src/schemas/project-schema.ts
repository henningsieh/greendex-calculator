import { EUCountryCode } from "@greendex/config/eu-countries";
import {
  DECIMAL_PRECISION,
  DECIMAL_SCALE,
} from "@greendex/config/project-shared-travel";
import {
  PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES,
  ProjectSharedTransportEmissionProfile,
  PARTICIPANT_TRANSPORT_EMISSION_PROFILES,
  type ParticipantTransportEmissionProfile,
} from "@greendex/config/transport-emission-profiles";
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  bigint,
  numeric,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { invitation, organization, user } from "./auth-schema";

/**
 * Custom Drizzle type for distance values.
 *
 * `data` is the application-facing TypeScript type (`number`), while
 * `driverData` is the database-driver representation (`string`). PostgreSQL
 * returns DECIMAL values as strings to preserve their precision.
 * Values are stored as DECIMAL(10,1) in the database, with precision and
 * scale enforced by PostgreSQL.
 */
const distanceKmType = customType<{ data: number; driverData: string }>({
  /**
   * Returns the SQL type declaration used when Drizzle creates the column.
   * This describes the database representation; it does not convert values.
   */
  dataType() {
    return `decimal(${DECIMAL_PRECISION}, ${DECIMAL_SCALE})`;
  },
  /**
   * Converts a value read from the database driver into the application type.
   *
   * @param value The DECIMAL value returned by PostgreSQL, represented as a
   * string by the database driver.
   * @returns The distance as a JavaScript number.
   */
  fromDriver(value: string): number {
    return Number.parseFloat(value);
  },
  /**
   * Converts the application value into the representation expected by the
   * database driver before an insert or update.
   *
   * @param value The distance in kilometers as a JavaScript number.
   * @returns The distance serialized as a string for PostgreSQL DECIMAL.
   */
  toDriver(value: number): string {
    return value.toString();
  },
});

// ============================================================================
// TABLES
// ============================================================================

/**
 * Project table
 *
 * Projects belong to organizations and access is controlled through
 * Better Auth's organization membership system.
 *
 * Project Participants can read projects in their organization.
 * Project Coordinators can create projects and manage only projects for which
 * they are responsible. Organization Administrators can manage every project.
 * Only Organization Administrators can delete projects.
 */
export const projectsTable = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    location: text("location").notNull(),
    country: text("country").$type<EUCountryCode>().notNull(),
    welcomeMessage: text("welcome_message"),

    // Foreign key to organization - projects are scoped to organizations
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Archived flag - projects can be archived instead of deleted
    archived: boolean("archived").default(false).notNull(),
    costSubmissionWindowOpen: boolean("cost_submission_window_open")
      .default(false)
      .notNull(),
    completedAt: timestamp("completed_at"),
    completedByUserId: text("completed_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_hosted_overview_operational_idx").on(
      table.organizationId,
      table.archived,
      table.costSubmissionWindowOpen.desc(),
      table.startDate,
      table.id,
    ),
    index("project_hosted_overview_date_idx").on(
      table.organizationId,
      table.archived,
      table.startDate,
      table.endDate,
      table.id,
    ),
    index("project_name_trigram_idx")
      .using("gin", sql`lower(${table.name}) gin_trgm_ops`)
      .where(sql`${table.archived} = false`),
  ],
);

/**
 * Project Shared Travel Leg table
 *
 * Tracks travel owned by a project for carbon-footprint calculation. A project
 * can exist without shared travel legs.
 */
export const projectSharedTransportEmissionProfileEnum = pgEnum(
  "project_shared_transport_emission_profile",
  PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES,
);

/** The database enum is the persistence boundary for the shared profile set. */
export const projectSharedTravelLegsTable = pgTable("project_shared_travel_leg", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),

  transportEmissionProfile: projectSharedTransportEmissionProfileEnum(
    "transport_emission_profile",
  )
    .$type<ProjectSharedTransportEmissionProfile>()
    .notNull(),

  // Distance in kilometers (scale 1 supports 0.1 km increments)
  distanceKm: distanceKmType("distance_km").notNull(),

  description: text("description"),
  travelDate: timestamp("travel_date"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Assigns an Organization as a Project-specific Partner Organization.
 */
export const projectPartnerOrganizationsTable = pgTable(
  "project_partner_organization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_partner_organization_project_org_unique").on(
      table.projectId,
      table.organizationId,
    ),
    index("project_partner_organization_project_idx").on(table.projectId),
    index("project_partner_organization_organization_idx").on(
      table.organizationId,
    ),
  ],
);

/** Explicit Host-side coordination assignment; membership alone is not authority. */
export const hostProjectAssignmentsTable = pgTable(
  "host_project_assignment",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

/** Explicit Partner-side coordination assignment; membership alone is not authority. */
export const partnerCoordinatorAssignmentsTable = pgTable(
  "partner_coordinator_assignment",
  {
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.partnershipId, table.userId] })],
);

/** App-owned, email-specific invitation to set up a Project Partnership. */
export const partnerOrganizationSetupLinksTable = pgTable(
  "partner_organization_setup_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    secretHash: text("secret_hash").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    consumedAt: timestamp("consumed_at"),
    consumedByUserId: text("consumed_by_user_id").references(() => user.id),
    partnershipId: text("partnership_id").references(
      () => projectPartnerOrganizationsTable.id,
    ),
  },
  (table) => [index("partner_setup_link_project_idx").on(table.projectId)],
);

/** Reusable, app-owned entry point bound to one Project Partnership. */
export const participantRegistrationLinksTable = pgTable(
  "participant_registration_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      }),
    secretHash: text("secret_hash").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedByUserId: text("closed_by_user_id").references(() => user.id),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    index("participant_registration_link_partnership_idx").on(
      table.partnershipId,
    ),
  ],
);

/** Connects a Better Auth invitation to its Project Partnership without creating Participation early. */
export const participantInvitationBridgesTable = pgTable(
  "participant_invitation_bridge",
  {
    invitationId: text("invitation_id")
      .primaryKey()
      .references(() => invitation.id),
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status").default("pending").notNull(),
    issuedByUserId: text("issued_by_user_id")
      .notNull()
      .references(() => user.id),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    uniqueIndex("participant_invitation_live_email_unique")
      .on(table.projectId, table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/** One User-owned profile, shared across the User's Project Participations. */
export const participantProfilesTable = pgTable("participant_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Append-only acceptance evidence; versions and content hashes are never rewritten. */
export const participantAgreementAcceptancesTable = pgTable(
  "participant_agreement_acceptance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    contentHash: text("content_hash").notNull(),
    answers: text("answers").notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("participant_agreement_user_version_unique").on(
      table.userId,
      table.version,
    ),
  ],
);

/**
 * Project Participant table
 *
 * Links project participants (members of the organization) to projects.
 * Country is stored here because it comes from the participation questionnaire,
 * not from the user's account registration.
 */
export const projectParticipantsTable = pgTable(
  "project_participant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    representedOrganizationId: text("represented_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),

    // Country code from participation questionnaire (EU member state)
    country: text("country").$type<EUCountryCode>(),
    mergedIntoParticipantId: text("merged_into_participant_id").references(
      (): AnyPgColumn => projectParticipantsTable.id,
      { onDelete: "restrict" },
    ),
    mergedAt: timestamp("merged_at"),
    mergedByUserId: text("merged_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_participant_project_idx").on(table.projectId),
    index("project_participant_represented_org_idx").on(
      table.representedOrganizationId,
    ),
    uniqueIndex("project_participant_project_email_unique")
      .on(table.projectId, table.email)
      .where(sql`${table.email} is not null`),
    uniqueIndex("project_participant_project_user_unique")
      .on(table.projectId, table.userId)
      .where(sql`${table.userId} is not null`),
    check(
      "project_participant_email_normalized",
      sql`${table.email} is null or ${table.email} = lower(trim(${table.email}))`,
    ),
    check(
      "project_participant_not_merged_into_self",
      sql`${table.mergedIntoParticipantId} is null or ${table.mergedIntoParticipantId} <> ${table.id}`,
    ),
    check(
      "project_participant_merge_fields_consistent",
      sql`(${table.mergedIntoParticipantId} is null and ${table.mergedAt} is null and ${table.mergedByUserId} is null) or (${table.mergedIntoParticipantId} is not null and ${table.mergedAt} is not null and ${table.mergedByUserId} is not null)`,
    ),
  ],
);

export const duplicateReviewStatusEnum = pgEnum("duplicate_review_status", [
  "open",
  "assigned",
  "resolved",
]);
export const duplicateReviewDecisionEnum = pgEnum("duplicate_review_decision", [
  "same_person",
  "distinct_persons",
  "dismiss",
]);

/** A duplicate attempt is retained without creating a second Participation.
 *
 * Retention is intentional: existing/survivor references use the default
 * no-action behavior, so resolved tasks pin their Participation rows for the
 * future manual merge path. Task cleanup belongs to that merge work, not here. */
export const duplicateReviewTasksTable = pgTable(
  "duplicate_review_task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      }),
    existingParticipationId: text("existing_participation_id")
      .notNull()
      .references(() => projectParticipantsTable.id),
    candidateUserId: text("candidate_user_id")
      .notNull()
      .references(() => user.id),
    candidateEmail: text("candidate_email").notNull(),
    status: duplicateReviewStatusEnum("status").notNull().default("open"),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id),
    decision: duplicateReviewDecisionEnum("decision"),
    survivorParticipationId: text("survivor_participation_id").references(
      () => projectParticipantsTable.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    uniqueIndex("duplicate_review_attempt_unique").on(
      table.partnershipId,
      table.existingParticipationId,
      table.candidateUserId,
    ),
    check(
      "duplicate_review_lifecycle_check",
      sql`(
      (${table.status} = 'open' and ${table.assignedToUserId} is null and ${table.decision} is null and ${table.survivorParticipationId} is null and ${table.resolvedAt} is null) or
      (${table.status} = 'assigned' and ${table.assignedToUserId} is not null and ${table.decision} is null and ${table.survivorParticipationId} is null and ${table.resolvedAt} is null) or
      (${table.status} = 'resolved' and ${table.assignedToUserId} is not null and ${table.decision} is not null and ${table.survivorParticipationId} = ${table.existingParticipationId} and ${table.resolvedAt} is not null)
    )`,
    ),
  ],
);

// Claim persistence. Monetary values stay strings at the driver boundary: never
// round exact EUR or percentage values through JavaScript floating point.
export const claimStatusEnum = pgEnum("claim_status", [
  "editable",
  "submitted",
  "correction_requested",
  "approved",
  "rejected",
  "paid",
]);
export const journeyTripTypeEnum = pgEnum("journey_trip_type", [
  "one-way",
  "round-trip",
]);
export const costAllocationMethodEnum = pgEnum("cost_allocation_method", [
  "equal",
  "percentage",
  "amount",
]);
export const participantTransportProfileEnum = pgEnum(
  "participant_transport_profile",
  PARTICIPANT_TRANSPORT_EMISSION_PROFILES,
);
export const claimEventTypeEnum = pgEnum("claim_event_type", [
  "submitted",
  "correction_requested",
  "resubmitted",
  "approved",
  "rejected",
  "reopened",
  "paid",
  "payment_corrected",
  "journey_updated",
]);

export const participantJourneysTable = pgTable(
  "participant_journey",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectParticipantId: text("project_participant_id")
      .notNull()
      .references(() => projectParticipantsTable.id, { onDelete: "cascade" })
      .unique(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    tripType: journeyTripTypeEnum("trip_type").notNull(),
    erasmusDistanceKm: numeric("erasmus_distance_km", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "participant_journey_distance_positive",
      sql`${table.erasmusDistanceKm} > 0`,
    ),
  ],
);

/** Copy the complete configured bands on the first journey save, in the same transaction.
 * No updater should ever modify these rows; later config versions affect only new projects.
 */
export const projectFundingSnapshotsTable = pgTable("project_funding_snapshot", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  rulesVersion: integer("rules_version").notNull(),
  // Bands stay relational for range lookups; freeze the exact profile set as JSON.
  participantTransportProfiles: jsonb("participant_transport_profiles")
    .$type<string[]>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const projectFundingBandsTable = pgTable(
  "project_funding_band",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    projectId: text("project_id")
      .notNull()
      .references(() => projectFundingSnapshotsTable.projectId, {
        onDelete: "cascade",
      }),
    minKm: numeric("min_km", { precision: 12, scale: 2 }).notNull(),
    maxKm: numeric("max_km", { precision: 12, scale: 2 }).notNull(),
    standardEur: numeric("standard_eur", { precision: 14, scale: 2 }).notNull(),
    greenEur: numeric("green_eur", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("project_funding_band_project_min_unique").on(
      table.projectId,
      table.minKm,
    ),
    check(
      "project_funding_band_range",
      sql`${table.minKm} >= 0 and ${table.maxKm} >= ${table.minKm}`,
    ),
    check(
      "project_funding_band_rates",
      sql`${table.standardEur} >= 0 and ${table.greenEur} >= 0`,
    ),
  ],
);

export const payoutAccountsTable = pgTable(
  "payout_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    accountHolder: text("account_holder").notNull(),
    iban: text("iban").notNull(),
    bic: text("bic"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("payout_account_organization_idx").on(table.organizationId)],
);

export const partnershipPayoutAccountsTable = pgTable(
  "partnership_payout_account",
  {
    partnershipId: text("partnership_id")
      .primaryKey()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      }),
    payoutAccountId: text("payout_account_id")
      .notNull()
      .references(() => payoutAccountsTable.id, { onDelete: "restrict" }),
  },
);

export const claimsTable = pgTable(
  "claim",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => projectPartnerOrganizationsTable.id, {
        onDelete: "cascade",
      })
      .unique(),
    status: claimStatusEnum("status").default("editable").notNull(),
    approvedAmountEur: numeric("approved_amount_eur", {
      precision: 14,
      scale: 2,
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "claim_approved_amount_nonnegative",
      sql`${table.approvedAmountEur} is null or ${table.approvedAmountEur} >= 0`,
    ),
  ],
);

export const travelCostEntriesTable = pgTable(
  "travel_cost_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    claimId: text("claim_id")
      .notNull()
      .references(() => claimsTable.id, { onDelete: "cascade" }),
    transportProfile: participantTransportProfileEnum("transport_profile")
      .$type<ParticipantTransportEmissionProfile>()
      .notNull(),
    amountEur: numeric("amount_eur", { precision: 14, scale: 2 }).notNull(),
    allocationMethod: costAllocationMethodEnum("allocation_method").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("travel_cost_entry_claim_idx").on(table.claimId),
    check("travel_cost_entry_positive", sql`${table.amountEur} > 0`),
  ],
);

export const costAllocationsTable = pgTable(
  "cost_allocation",
  {
    travelCostEntryId: text("travel_cost_entry_id")
      .notNull()
      .references(() => travelCostEntriesTable.id, { onDelete: "cascade" }),
    projectParticipantId: text("project_participant_id")
      .notNull()
      .references(() => projectParticipantsTable.id, { onDelete: "restrict" }),
    percentage: numeric("percentage", { precision: 12, scale: 6 }),
    amountEur: numeric("amount_eur", { precision: 14, scale: 2 }),
  },
  (table) => [
    primaryKey({
      columns: [table.travelCostEntryId, table.projectParticipantId],
    }),
    index("cost_allocation_participant_idx").on(table.projectParticipantId),
    check(
      "cost_allocation_nonnegative",
      sql`(${table.percentage} is null or ${table.percentage} >= 0) and (${table.amountEur} is null or ${table.amountEur} >= 0) and not (${table.percentage} is not null and ${table.amountEur} is not null)`,
    ),
  ],
);

export const proofDocumentsTable = pgTable(
  "proof_document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    claimId: text("claim_id")
      .notNull()
      .references(() => claimsTable.id, { onDelete: "cascade" }),
    fileReference: text("file_reference").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mediaType: text("media_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("proof_document_claim_idx").on(table.claimId),
    check("proof_document_size_positive", sql`${table.byteSize} > 0`),
  ],
);

export const travelCostEntryDocumentsTable = pgTable(
  "travel_cost_entry_document",
  {
    travelCostEntryId: text("travel_cost_entry_id")
      .notNull()
      .references(() => travelCostEntriesTable.id, { onDelete: "cascade" }),
    proofDocumentId: text("proof_document_id")
      .notNull()
      .references(() => proofDocumentsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.travelCostEntryId, table.proofDocumentId] }),
    index("travel_cost_entry_document_proof_idx").on(table.proofDocumentId),
  ],
);

/** Only insert history events; correction is a new event, never an edit of an old one. */
export const claimHistoryTable = pgTable(
  "claim_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    claimId: text("claim_id")
      .notNull()
      .references(() => claimsTable.id, { onDelete: "restrict" }),
    eventType: claimEventTypeEnum("event_type").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    reason: text("reason"),
  },
  (table) => [
    index("claim_history_claim_time_idx").on(table.claimId, table.occurredAt),
    check(
      "claim_history_reason_required",
      sql`${table.eventType} not in ('correction_requested', 'rejected', 'payment_corrected') or (nullif(trim(${table.reason}), '') is not null)`,
    ),
  ],
);

/** Deferred to procedure transactions: first journey + complete immutable funding snapshot;
 * payout account organization = partnership organization and locked after submission;
 * allocations match the entry method and total, and covered participations match both
 * project and partner organization; documents and entries share a Claim and each entry
 * has evidence; submission requires complete journeys, evidence and a payout account.
 * UI reads must not create Claims. History writes accompany every state transition.
 */

// ============================================================================
// RELATIONS
// ============================================================================

// project - relations
export const projectRelations = relations(projectsTable, ({ one, many }) => ({
  hostAssignments: many(hostProjectAssignmentsTable),
  organization: one(organization, {
    fields: [projectsTable.organizationId],
    references: [organization.id],
  }),
  sharedTravelLegs: many(projectSharedTravelLegsTable),
  participants: many(projectParticipantsTable),
  partnerOrganizations: many(projectPartnerOrganizationsTable),
}));

export const hostProjectAssignmentRelations = relations(
  hostProjectAssignmentsTable,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [hostProjectAssignmentsTable.projectId],
      references: [projectsTable.id],
    }),
    user: one(user, {
      fields: [hostProjectAssignmentsTable.userId],
      references: [user.id],
    }),
  }),
);

// projectSharedTravelLeg - relations
export const projectSharedTravelLegRelations = relations(
  projectSharedTravelLegsTable,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [projectSharedTravelLegsTable.projectId],
      references: [projectsTable.id],
    }),
  }),
);

export const projectPartnerOrganizationRelations = relations(
  projectPartnerOrganizationsTable,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [projectPartnerOrganizationsTable.projectId],
      references: [projectsTable.id],
    }),
    organization: one(organization, {
      fields: [projectPartnerOrganizationsTable.organizationId],
      references: [organization.id],
    }),
  }),
);

// projectParticipant - relations
export const projectParticipantRelations = relations(
  projectParticipantsTable,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [projectParticipantsTable.projectId],
      references: [projectsTable.id],
    }),
    representedOrganization: one(organization, {
      fields: [projectParticipantsTable.representedOrganizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [projectParticipantsTable.userId],
      references: [user.id],
      relationName: "projectParticipationUser",
    }),
    mergedIntoParticipant: one(projectParticipantsTable, {
      fields: [projectParticipantsTable.mergedIntoParticipantId],
      references: [projectParticipantsTable.id],
      relationName: "mergedProjectParticipation",
    }),
    mergedByUser: one(user, {
      fields: [projectParticipantsTable.mergedByUserId],
      references: [user.id],
      relationName: "projectParticipationMergedByUser",
    }),
  }),
);
