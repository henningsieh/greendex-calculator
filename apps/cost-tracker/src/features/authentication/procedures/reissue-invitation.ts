import "server-only";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  participantInvitationBridgesTable as bridges,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { deliverParticipantInvitation } from "@/features/authentication/procedures/invitation-delivery";
import {
  id,
  invitationResult,
  newNativeParticipantInvitation,
  normalizedEmail,
  partnershipForIssuer,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildReissueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const target = await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existingParticipation] = await db
        .select({ id: participants.id })
        .from(participants)
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, target.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw errors.BAD_REQUEST({
          message: "This person already participates in this Project.",
        });
      const { invitationId } = await db.transaction(async (tx) => {
        // Serialize rotations across every Partnership in this Project.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, target.projectId))
          .for("update");
        const [previous] = await tx
          .select({
            invitationId: bridges.invitationId,
            partnershipId: bridges.partnershipId,
          })
          .from(bridges)
          .where(
            and(
              eq(bridges.projectId, target.projectId),
              eq(bridges.email, input.email),
              eq(bridges.status, "pending"),
            ),
          )
          .limit(1);
        if (!previous)
          throw errors.BAD_REQUEST({
            message: "No active Participant Invitation to replace.",
          });
        if (previous.partnershipId !== target.id)
          await partnershipForIssuer(
            previous.partnershipId,
            context.user.id,
            context.session.activeOrganizationId,
            errors,
          );
        await tx
          .update(invitation)
          .set({ status: "canceled" })
          .where(
            and(
              eq(invitation.id, previous.invitationId),
              eq(invitation.status, "pending"),
            ),
          );
        await tx
          .update(bridges)
          .set({ status: "revoked" })
          .where(eq(bridges.invitationId, previous.invitationId));
        const invitationId = randomUUID();
        await tx
          .insert(invitation)
          .values(
            newNativeParticipantInvitation(
              invitationId,
              target.hostId,
              input.email,
              context.user.id,
            ),
          );
        await tx.insert(bridges).values({
          invitationId,
          partnershipId: target.id,
          projectId: target.projectId,
          email: input.email,
          issuedByUserId: context.user.id,
        });
        return { invitationId };
      });
      // Only explicit reissue creates a new identity and triggers another delivery.
      return deliverParticipantInvitation(input.email, invitationId);
    });
}
