import "server-only";
import { db } from "@greendex/database";
import { duplicateReviewTasksTable as tasks } from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { authorized } from "@/lib/orpc/middleware";

const input = z.object({ partnershipId: coordinationId });
const rowInput = input.extend({ id: coordinationId });
const reviewTask = z.object({
  id: z.string(),
  partnershipId: z.string(),
  existingParticipationId: z.string(),
  candidateUserId: z.string(),
  candidateEmail: z.string(),
  status: z.enum(["open", "assigned", "resolved"]),
  assignedToUserId: z.string().nullable(),
  decision: z.enum(["same_person", "distinct_persons", "dismiss"]).nullable(),
  survivorParticipationId: z.string().nullable(),
  createdAt: z.date(),
  resolvedAt: z.date().nullable(),
});

async function requirePartnerSide(
  partnershipId: string,
  actorId: string,
  organizationId: string | null | undefined,
  errors: Parameters<typeof requirePartnerCoordination>[3],
) {
  const scope = await requirePartnerCoordination(
    partnershipId,
    actorId,
    organizationId,
    errors,
  );
  if (scope.partnerId !== organizationId)
    throw errors.FORBIDDEN({
      message: "Only the Partner Organization may review duplicate identities.",
    });
  return scope;
}

const list = authorized
  .input(input)
  .output(z.array(reviewTask))
  .handler(async ({ input, context, errors }) => {
    await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.partnershipId, input.partnershipId));
  });

const assign = authorized
  .input(rowInput)
  .output(reviewTask)
  .handler(async ({ input, context, errors }) => {
    await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [assigned] = await db
      .update(tasks)
      .set({ status: "assigned", assignedToUserId: context.user.id })
      .where(
        and(
          eq(tasks.id, input.id),
          eq(tasks.partnershipId, input.partnershipId),
          eq(tasks.status, "open"),
        ),
      )
      .returning();
    if (!assigned)
      throw errors.BAD_REQUEST({
        message: "Review Task is not open or unavailable.",
      });
    return assigned;
  });

const resolve = authorized
  .input(
    rowInput.extend({
      decision: z.enum(["same_person", "distinct_persons", "dismiss"]),
      survivorParticipationId: coordinationId,
    }),
  )
  .output(reviewTask)
  .handler(async ({ input, context, errors }) => {
    await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    // The duplicate attempt never creates a second Participation; the existing
    // Participation is the only survivor available to a later manual merge.
    const [resolved] = await db
      .update(tasks)
      .set({
        status: "resolved",
        decision: input.decision,
        survivorParticipationId: input.survivorParticipationId,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, input.id),
          eq(tasks.partnershipId, input.partnershipId),
          eq(tasks.status, "assigned"),
          eq(tasks.assignedToUserId, context.user.id),
          eq(tasks.existingParticipationId, input.survivorParticipationId),
        ),
      )
      .returning();
    if (!resolved)
      throw errors.BAD_REQUEST({
        message: "Review Task cannot be resolved with this survivor.",
      });
    return resolved;
  });

export const duplicateReviews = { list, assign, resolve };
