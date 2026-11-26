import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  member,
  partnerCoordinatorAssignmentsTable as assignments,
} from "@greendex/database/schema";
import { createClaimPaidEvent } from "@greendex/notifications";
import { eq } from "drizzle-orm";

import type { NotificationIntent } from "@/features/notifications/procedures/actions";
import type {
  NotificationRecipient,
  NotificationTransaction,
} from "@/features/notifications/procedures/writes";

/**
 * Facts resolved by the payment action inside its transaction. Recipient rules
 * stay here, at the domain change, so the realtime service never re-implements
 * Partnership or Membership authorization.
 */
export type ClaimPaidFacts = {
  actorUserId: string;
  projectId: string;
  partnershipId: string;
  partnerOrganizationId: string;
  claimId: string;
  amountEur: string;
};

/**
 * Assigned Partner coordinators plus Owners and Admins of the Partner
 * Organization for this Partnership. Assigned users must be Members of that
 * Organization; the actor is not excluded, because a User may belong to both
 * sides and the declaration is about responsibility, not identity.
 */
export async function resolveClaimPaidRecipients(
  tx: NotificationTransaction,
  facts: ClaimPaidFacts,
): Promise<NotificationRecipient[]> {
  const [memberships, assigned] = await Promise.all([
    tx
      .select({ userId: member.userId, role: member.role })
      .from(member)
      .where(eq(member.organizationId, facts.partnerOrganizationId)),
    tx
      .select({ userId: assignments.userId })
      .from(assignments)
      .where(eq(assignments.partnershipId, facts.partnershipId)),
  ]);
  const assignedUserIds = new Set(assigned.map(({ userId }) => userId));
  const recipients = new Map<string, NotificationRecipient>();
  for (const { userId, role } of memberships) {
    if (
      assignedUserIds.has(userId) ||
      hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationOwner) ||
      hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationAdmin)
    )
      recipients.set(userId, {
        userId,
        organizationId: facts.partnerOrganizationId,
      });
  }
  return [...recipients.values()];
}

export const claimPaidNotificationIntent: NotificationIntent<ClaimPaidFacts> = {
  event: (facts) =>
    createClaimPaidEvent({
      projectId: facts.projectId,
      partnershipId: facts.partnershipId,
      claimId: facts.claimId,
      amountEur: facts.amountEur,
      actorUserId: facts.actorUserId,
    }),
  recipients: resolveClaimPaidRecipients,
};
