import "server-only";
import { RealtimeEmitRequestSchema } from "@greendex/notifications";

import { env } from "@/env";
import type { PersistedNotificationBatch } from "@/features/notifications/procedures/actions";

const EMIT_TIMEOUT_MS = 2000;

/**
 * Best-effort live delivery after the domain transaction commits. A missing or
 * failing realtime service never rolls back the domain change and never removes
 * the persisted inbox rows that offline catch-up reads.
 */
export async function emitNotificationCreated(
  batch: PersistedNotificationBatch,
): Promise<void> {
  if (batch.notifications.length === 0) return;

  const baseUrl = env.REALTIME_INTERNAL_URL;
  const secret = env.REALTIME_EMIT_SECRET;
  if (!baseUrl || !secret) {
    console.warn(
      "Realtime emit skipped: REALTIME_INTERNAL_URL and REALTIME_EMIT_SECRET are not configured.",
    );
    return;
  }

  const parsed = RealtimeEmitRequestSchema.safeParse({
    notifications: batch.notifications.map((notification) => ({
      recipientUserId: notification.recipientUserId,
      notification: {
        id: notification.id,
        event: batch.event,
        createdAt: notification.createdAt.toISOString(),
      },
    })),
  });
  if (!parsed.success) {
    console.error(
      "Realtime emit skipped: the persisted notification envelope is invalid.",
    );
    return;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}/emit`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(EMIT_TIMEOUT_MS),
    });
    if (!response.ok)
      console.error(
        `Realtime emit failed with status ${response.status}; notification rows remain for catch-up.`,
      );
  } catch (error) {
    console.error(
      "Realtime emit failed; notification rows remain for catch-up.",
      error,
    );
  }
}
