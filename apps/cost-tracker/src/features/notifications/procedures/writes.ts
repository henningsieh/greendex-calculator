import "server-only";
import { db } from "@greendex/database";
import { notificationsTable } from "@greendex/database/schema";
import {
  notificationDedupeKey,
  type NotificationEvent,
} from "@greendex/notifications";

type NotificationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** One recipient User in the Organization that scopes their inbox. */
export type NotificationRecipient = {
  userId: string;
  organizationId: string;
};

export type NotificationWrite = {
  event: NotificationEvent;
  actorUserId: string;
  /**
   * Resolved by the action that owns the domain change, inside its transaction.
   * The write path performs no authorization and no recipient discovery.
   */
  recipients: readonly NotificationRecipient[];
};

/**
 * Inserts one inbox row per recipient inside the caller's transaction, so the
 * notification commits or rolls back with the domain change it announces.
 *
 * Duplicate-safe: `(recipient, event type, event version, dedupe key)` is
 * unique. Repeating the same confirmed change inserts nothing and returns no
 * id. Delivery is not attempted here; callers emit after commit and best-effort.
 */
export async function persistNotifications(
  tx: NotificationTransaction,
  write: NotificationWrite,
): Promise<string[]> {
  const recipients = new Map(
    write.recipients.map((recipient) => [
      `${recipient.userId}\u0000${recipient.organizationId}`,
      recipient,
    ]),
  );
  if (recipients.size === 0) return [];
  const dedupeKey = notificationDedupeKey(write.event);
  const inserted = await tx
    .insert(notificationsTable)
    .values(
      [...recipients.values()].map((recipient) => ({
        recipientUserId: recipient.userId,
        organizationId: recipient.organizationId,
        eventType: write.event.type,
        eventVersion: write.event.version,
        dedupeKey,
        payload: write.event.payload,
        actorUserId: write.actorUserId,
      })),
    )
    .onConflictDoNothing({
      target: [
        notificationsTable.recipientUserId,
        notificationsTable.eventType,
        notificationsTable.eventVersion,
        notificationsTable.dedupeKey,
      ],
    })
    .returning({ id: notificationsTable.id });
  return inserted.map(({ id }) => id);
}
