import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth-schema";

/**
 * Persistent notification inbox.
 *
 * A row belongs to exactly one recipient User and one Organization (the
 * recipient's Partner Organization at the time of the domain change). Rows are
 * written in the same transaction as the domain change they announce; delivery
 * is best-effort afterwards, so persistence is the source of truth for offline
 * catch-up.
 *
 * `(recipient, event type, event version, dedupe key)` is unique: repeating the
 * same confirmed domain change never creates a second inbox entry. The dedupe
 * key is owned by the event catalog, not by this table.
 */
export const notificationsTable = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_recipient_event_uq").on(
      table.recipientUserId,
      table.eventType,
      table.eventVersion,
      table.dedupeKey,
    ),
    // Unread listing and the unread count both filter on recipient and
    // Organization; the partial predicate keeps the index to open rows only.
    index("notification_recipient_unread_idx")
      .on(table.recipientUserId, table.organizationId, table.createdAt)
      .where(sql`${table.readAt} is null`),
    check("notification_event_version_positive", sql`${table.eventVersion} > 0`),
  ],
);
