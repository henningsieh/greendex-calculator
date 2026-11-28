import { z } from "zod";

/**
 * Versioned notification event catalog.
 *
 * Every event the Cost Tracker inbox may persist is declared here with its
 * payload schema and the projection that makes a write duplicate-safe. Writers
 * and readers share these definitions; transports (sockets, toasts) stay
 * outside this package.
 */

export const NOTIFICATION_EVENT_TYPES = ["claim.paid"] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/** EUR amounts travel as exact decimal strings, like every Cost Tracker amount. */
export const NotificationEurAmountSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Enter exact EUR cents.");

export const CLAIM_PAID_EVENT_VERSION = 1;

/**
 * One full transfer recorded for an approved Claim. The payload carries the
 * identities a recipient needs to open the Claim and understand the change;
 * it never carries the whole Claim, because the inbox is not a Claim cache.
 */
export const ClaimPaidPayloadV1Schema = z
  .object({
    projectId: z.string().min(1),
    partnershipId: z.string().min(1),
    claimId: z.string().min(1),
    amountEur: NotificationEurAmountSchema,
    actorUserId: z.string().min(1),
  })
  .strict();

export type ClaimPaidPayloadV1 = z.infer<typeof ClaimPaidPayloadV1Schema>;

export const ClaimPaidEventV1Schema = z
  .object({
    type: z.literal("claim.paid"),
    version: z.literal(CLAIM_PAID_EVENT_VERSION),
    payload: ClaimPaidPayloadV1Schema,
  })
  .strict();

/** Add one member per new event type or version; consumers stay exhaustive. */
export const NotificationEventSchema = z.union([ClaimPaidEventV1Schema]);

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
export type ClaimPaidNotificationEvent = Extract<
  NotificationEvent,
  { type: "claim.paid" }
>;

/** Socket event name and internal emit route share one persisted envelope. */
export const NOTIFICATION_CREATED_EVENT = "notification-created";

export const NotificationCreatedSchema = z
  .object({
    id: z.string().min(1),
    event: NotificationEventSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

export type NotificationCreated = z.infer<typeof NotificationCreatedSchema>;

/**
 * One broadcast unit: the personal room to reach and the inbox row that caused
 * it. The realtime service performs no authorization and re-implements no
 * recipient rules; it only validates this envelope and emits it.
 */
export const RealtimeEmitNotificationSchema = z
  .object({
    recipientUserId: z.string().min(1),
    notification: NotificationCreatedSchema,
  })
  .strict();

export const RealtimeEmitRequestSchema = z
  .object({
    notifications: z.array(RealtimeEmitNotificationSchema).min(1).max(1000),
  })
  .strict();

export type RealtimeEmitNotification = z.infer<
  typeof RealtimeEmitNotificationSchema
>;
export type RealtimeEmitRequest = z.infer<typeof RealtimeEmitRequestSchema>;

function unhandledEvent(event: NotificationEvent): never {
  throw new Error(`Unhandled notification event: ${JSON.stringify(event)}`);
}

/**
 * Stable identity of the domain change an event describes. A recipient can
 * receive the same event only once: `(recipient, event, version, dedupeKey)`
 * is unique in persistence.
 */
export function notificationDedupeKey(event: NotificationEvent): string {
  switch (event.type) {
    case "claim.paid":
      return event.payload.claimId;
  }
  return unhandledEvent(event);
}

/** Builds a validated event; writers must not hand-assemble payloads. */
export function createClaimPaidEvent(
  payload: ClaimPaidPayloadV1,
): ClaimPaidNotificationEvent {
  return ClaimPaidEventV1Schema.parse({
    type: "claim.paid",
    version: CLAIM_PAID_EVENT_VERSION,
    payload,
  });
}

/**
 * Rehydrates a stored or received event. Unknown types, versions, and payload
 * shapes return `undefined` so a corrupt row or message never crashes a
 * consumer and never reaches a recipient as an unvalidated payload.
 */
export function parseNotificationEvent(input: {
  eventType: string;
  eventVersion: number;
  payload: unknown;
}): NotificationEvent | undefined {
  const parsed = NotificationEventSchema.safeParse({
    type: input.eventType,
    version: input.eventVersion,
    payload: input.payload,
  });
  return parsed.success ? parsed.data : undefined;
}
