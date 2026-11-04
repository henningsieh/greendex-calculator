import "server-only";
import { db } from "@greendex/database";
import { principalQuotaCounters as counters } from "@greendex/database/schema";
import { and, eq, sql } from "drizzle-orm";

import {
  createSituationErrors,
  type SituationErrorConstructors,
} from "@/lib/orpc/errors";

export const DAILY_UPLOAD_BYTES = 500 * 1024 * 1024;
export const LISTING_CALLS_PER_MINUTE = 120;
const listingWindowSeconds = 60;
const uploadDaySeconds = 86400;
export const QUOTA_CLEANUP_BATCH_SIZE = 500;
const maximumLockAttempts = 3;
const epoch = new Date(0);
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Principal =
  | { kind: "upload_bytes"; organizationId: string; userKey: "" }
  | { kind: "listing_calls"; organizationId: string; userKey: string };

async function consume(tx: Transaction, principal: Principal, amount: number) {
  const key = and(
    eq(counters.kind, principal.kind),
    eq(counters.organizationId, principal.organizationId),
    eq(counters.userKey, principal.userKey),
  );
  let locked = false;
  for (let attempt = 0; attempt < maximumLockAttempts; attempt++) {
    await tx
      .insert(counters)
      .values({ ...principal, windowStart: epoch, expiresAt: epoch, used: 0n })
      .onConflictDoNothing();
    const rows = await tx
      .select({ kind: counters.kind })
      .from(counters)
      .where(key)
      .for("update");
    if (rows.length > 0) {
      locked = true;
      break;
    }
  }
  if (!locked)
    throw new Error("Quota principal lock unavailable after cleanup races");
  const limit =
    principal.kind === "upload_bytes"
      ? DAILY_UPLOAD_BYTES
      : LISTING_CALLS_PER_MINUTE;
  const seconds =
    principal.kind === "upload_bytes" ? uploadDaySeconds : listingWindowSeconds;
  // Sample the clock in a separate statement after the principal lock, never before a lock wait.
  const result = await tx.execute(sql`
    with sample as materialized (select clock_timestamp() as instant),
    candidate as materialized (
      select to_timestamp(floor(extract(epoch from instant) / ${seconds}) * ${seconds}) as start from sample
    )
    update ${counters} set
      used = case when candidate.start > window_start then ${amount} else used + ${amount} end,
      expires_at = case when candidate.start > window_start then candidate.start + ${seconds} * interval '1 second' else expires_at end,
      window_start = greatest(window_start, candidate.start)
    from candidate
    where kind = ${principal.kind} and organization_id = ${principal.organizationId} and user_key = ${principal.userKey}
      and (candidate.start > window_start or used <= ${limit - amount})
    returning used
  `);
  return result.rows.length > 0 ? "allowed" : "exhausted";
}

export function consumeUploadBytes(
  tx: Transaction,
  input: { partnerOrganizationId: string; bytes: number },
) {
  return consume(
    tx,
    {
      kind: "upload_bytes",
      organizationId: input.partnerOrganizationId,
      userKey: "",
    },
    input.bytes,
  );
}

export async function enforceListingLimit(
  principal: { userId: string; organizationId: string },
  errors: Partial<Pick<SituationErrorConstructors, "TOO_MANY_REQUESTS">>,
) {
  const outcome = await db.transaction((tx) =>
    consume(
      tx,
      {
        kind: "listing_calls",
        organizationId: principal.organizationId,
        userKey: principal.userId,
      },
      1,
    ),
  );
  await cleanupQuotasBestEffort();
  if (outcome === "exhausted") throw createSituationErrors(errors).rateLimited();
}

export async function deleteExpiredQuotaRows(
  executor: Pick<Transaction, "execute"> = db,
): Promise<number> {
  const result = await executor.execute(sql`
    with expired as materialized (
      select kind, organization_id, user_key from ${counters}
      where expires_at <= clock_timestamp()
      order by expires_at, kind, organization_id, user_key
      limit ${QUOTA_CLEANUP_BATCH_SIZE} for update skip locked
    )
    delete from ${counters} as target using expired
    where target.kind = expired.kind and target.organization_id = expired.organization_id and target.user_key = expired.user_key
      and target.expires_at <= clock_timestamp()
    returning target.kind
  `);
  return result.rows.length;
}

export async function cleanupQuotasBestEffort(): Promise<void> {
  try {
    await deleteExpiredQuotaRows();
  } catch {
    console.error("[Principal quotas] Expired counter cleanup failed");
  }
}
