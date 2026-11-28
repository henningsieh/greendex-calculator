import {
  IDENTIFIER_MAX_LENGTH,
  notificationsTable,
} from "@greendex/database/schema";
import { NotificationEventSchema } from "@greendex/notifications";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

const NotificationSelectSchema = createSelectSchema(notificationsTable);

export const NotificationIdSchema = NotificationSelectSchema.shape.id
  .trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE_SIZE = 50;
export const MAX_NOTIFICATION_READ_BATCH = 100;

export const ListUnreadNotificationsInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_NOTIFICATION_PAGE_SIZE)
      .default(NOTIFICATION_PAGE_SIZE),
  })
  .strict();

export const NotificationItemSchema = z.object({
  id: NotificationSelectSchema.shape.id,
  event: NotificationEventSchema,
  createdAt: NotificationSelectSchema.shape.createdAt,
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const UnreadNotificationsOutputSchema = z.object({
  items: z.array(NotificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
});

export const MarkNotificationsReadInputSchema = z
  .object({
    ids: z.array(NotificationIdSchema).min(1).max(MAX_NOTIFICATION_READ_BATCH),
  })
  .strict();

export const MarkNotificationsReadOutputSchema = z.object({
  updated: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
});
