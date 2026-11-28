import "server-only";
import type { NotificationEvent } from "@greendex/notifications";

import {
  persistNotifications,
  type NotificationRecipient,
  type NotificationTransaction,
  type PersistedNotification,
} from "@/features/notifications/procedures/writes";

/**
 * A notification intent is an action's declared event plus the recipient
 * resolver that runs inside the action's own transaction. Actions that emit
 * nothing declare `null` explicitly; an absent declaration is a defect the
 * repository check catches.
 */
export type NotificationIntent<TFacts> = {
  event: (facts: TFacts) => NotificationEvent;
  recipients: (
    tx: NotificationTransaction,
    facts: TFacts,
  ) => Promise<readonly NotificationRecipient[]>;
};

export type PersistedNotificationBatch = {
  event: NotificationEvent;
  notifications: PersistedNotification[];
};

const declarations = new WeakMap<object, NotificationIntent<never> | null>();

/**
 * Records the action's declaration next to the procedure object it describes.
 * The procedure is returned unchanged, so builders chain as before.
 */
export function declareNotifications<TProcedure extends object, TFacts = unknown>(
  procedure: TProcedure,
  intent: NotificationIntent<TFacts> | null,
): TProcedure {
  declarations.set(procedure, intent as NotificationIntent<never> | null);
  return procedure;
}

/**
 * `undefined` means undeclared; `null` is a deliberate "emits nothing".
 */
export function notificationIntentFor(
  procedure: object,
): NotificationIntent<never> | null | undefined {
  return declarations.get(procedure);
}

/**
 * Resolves recipients and persists one row per recipient in the caller's
 * transaction, so the inbox entry commits or rolls back with the domain change.
 */
export async function persistDeclaredNotifications<TFacts extends object>(
  tx: NotificationTransaction,
  intent: NotificationIntent<TFacts>,
  facts: TFacts & { actorUserId: string },
): Promise<PersistedNotificationBatch> {
  const event = intent.event(facts);
  const recipients = await intent.recipients(tx, facts);
  const notifications = await persistNotifications(tx, {
    event,
    actorUserId: facts.actorUserId,
    recipients,
  });
  return { event, notifications };
}
