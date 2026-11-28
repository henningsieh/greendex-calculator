import "server-only";
import { db } from "@greendex/database";
import { notificationsTable as notifications } from "@greendex/database/schema";
import { parseNotificationEvent } from "@greendex/notifications";
import { openapi } from "@orpc/openapi";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  ListUnreadNotificationsInputSchema,
  MarkNotificationsReadInputSchema,
  MarkNotificationsReadOutputSchema,
  NOTIFICATION_PAGE_SIZE,
  UnreadNotificationsOutputSchema,
  type NotificationItem,
} from "@/features/notifications/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

/**
 * The caller's inbox is their own rows in their active Organization. Partner
 * recipients are resolved by the action that records the payment; these reads
 * never widen beyond the authenticated User.
 */
function unreadNotificationsFilter(
  recipientUserId: string,
  organizationId: string,
) {
  return and(
    eq(notifications.recipientUserId, recipientUserId),
    eq(notifications.organizationId, organizationId),
    isNull(notifications.readAt),
  );
}

async function countUnread(
  recipientUserId: string,
  organizationId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(unreadNotificationsFilter(recipientUserId, organizationId));
  return row?.value ?? 0;
}

/**
 * Projects persisted rows through the event catalog. A row whose payload no
 * longer validates is skipped and logged rather than breaking the whole inbox.
 */
export async function readUnreadNotifications(
  recipientUserId: string,
  organizationId: string,
  limit: number,
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([
    db
      .select({
        id: notifications.id,
        eventType: notifications.eventType,
        eventVersion: notifications.eventVersion,
        payload: notifications.payload,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(unreadNotificationsFilter(recipientUserId, organizationId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit),
    countUnread(recipientUserId, organizationId),
  ]);

  const items = rows.flatMap((row): NotificationItem[] => {
    const event = parseNotificationEvent({
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      payload: row.payload,
    });
    if (!event) {
      console.error(`Notification ${row.id} has an unreadable event payload`);
      return [];
    }
    return [{ id: row.id, event, createdAt: row.createdAt }];
  });

  return { items, unreadCount };
}

export const listUnread = authorized
  .input(ListUnreadNotificationsInputSchema.optional())
  .output(UnreadNotificationsOutputSchema)
  .meta(
    openapi({
      tags: ["Notifications"],
      summary: "List the caller's unread notifications",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw createSituationErrors(errors).selectOrganization();
    return readUnreadNotifications(
      context.user.id,
      organizationId,
      input?.limit ?? NOTIFICATION_PAGE_SIZE,
    );
  });

export const markRead = authorized
  .input(MarkNotificationsReadInputSchema)
  .output(MarkNotificationsReadOutputSchema)
  .meta(
    openapi({
      tags: ["Notifications"],
      summary: "Mark the caller's notifications as read",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw createSituationErrors(errors).selectOrganization();
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          unreadNotificationsFilter(context.user.id, organizationId),
          inArray(notifications.id, input.ids),
        ),
      )
      .returning({ id: notifications.id });
    return {
      updated: updated.length,
      unreadCount: await countUnread(context.user.id, organizationId),
    };
  });

export const markAllRead = authorized
  .output(MarkNotificationsReadOutputSchema)
  .meta(
    openapi({
      tags: ["Notifications"],
      summary: "Mark all the caller's unread notifications as read",
    }),
  )
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw createSituationErrors(errors).selectOrganization();
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(unreadNotificationsFilter(context.user.id, organizationId))
      .returning({ id: notifications.id });
    return {
      updated: updated.length,
      unreadCount: await countUnread(context.user.id, organizationId),
    };
  });
