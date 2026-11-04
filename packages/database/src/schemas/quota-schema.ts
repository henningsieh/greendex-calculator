import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const principalQuotaCounters = pgTable(
  "principal_quota_counters",
  {
    kind: text("kind").notNull().$type<"upload_bytes" | "listing_calls">(),
    organizationId: text("organization_id").notNull(),
    userKey: text("user_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: bigint("used", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.organizationId, table.userKey] }),
    check(
      "principal_quota_kind_key",
      sql`(${table.kind} = 'upload_bytes' and ${table.userKey} = '') or (${table.kind} = 'listing_calls' and ${table.userKey} <> '')`,
    ),
    check("principal_quota_used_nonnegative", sql`${table.used} >= 0`),
    check(
      "principal_quota_window_valid",
      sql`${table.expiresAt} > ${table.windowStart} or (${table.windowStart} = '1970-01-01T00:00:00Z'::timestamptz and ${table.expiresAt} = ${table.windowStart} and ${table.used} = 0)`,
    ),
    index("principal_quota_expiry_idx").on(table.expiresAt),
  ],
);
