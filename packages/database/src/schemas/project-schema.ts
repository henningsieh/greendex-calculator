import { EUCountryCode } from "@greendex/config/eu-countries";
import {
  DECIMAL_PRECISION,
  DECIMAL_SCALE,
} from "@greendex/config/project-shared-travel";
import {
  PROJECT_SHARED_TRANSPORT_EMISSION_PROFILES,
  ProjectSharedTransportEmissionProfile,
} from "@greendex/config/transport-emission-profiles";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization, user, member } from "./auth-schema";

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
export const projectsTable = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  location: text("location").notNull(),
  country: text("country").$type<EUCountryCode>().notNull(),
  welcomeMessage: text("welcome_message"),

  // Foreign key to user (responsible team member)
  responsibleUserId: text("responsible_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Foreign key to organization - projects are scoped to organizations
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),

  // Archived flag - projects can be archived instead of deleted
  archived: boolean("archived").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
 * Project Participant table
 *
 * Links project participants (members of the organization) to projects.
 * Country is stored here because it comes from the participation questionnaire,
 * not from the user's account registration.
 */
export const projectParticipantsTable = pgTable("project_participant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Country code from participation questionnaire (EU member state)
  country: text("country").$type<EUCountryCode>().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

// project - relations
export const projectRelations = relations(projectsTable, ({ one, many }) => ({
  responsibleUser: one(user, {
    fields: [projectsTable.responsibleUserId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [projectsTable.organizationId],
    references: [organization.id],
  }),
  sharedTravelLegs: many(projectSharedTravelLegsTable),
  participants: many(projectParticipantsTable),
}));

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

// projectParticipant - relations
export const projectParticipantRelations = relations(
  projectParticipantsTable,
  ({ one }) => ({
    project: one(projectsTable, {
      fields: [projectParticipantsTable.projectId],
      references: [projectsTable.id],
    }),
    member: one(member, {
      fields: [projectParticipantsTable.memberId],
      references: [member.id],
    }),
    user: one(user, {
      fields: [projectParticipantsTable.userId],
      references: [user.id],
    }),
  }),
);
