import "server-only";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  participantInvitationBridgesTable as bridges,
  projectParticipantsTable as participants,
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
import { auth } from "@/lib/auth";
import {
  normalizeBetterAuthError,
  normalizeBetterAuthResponse,
} from "@/lib/orpc/better-auth-errors";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildIssueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const partnership = await partnershipForIssuer(
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
            eq(participants.projectId, partnership.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw createSituationErrors(errors).participantAlreadyParticipates();
      const [existingBridge] = await db
        .select({
          invitationId: bridges.invitationId,
          partnershipId: bridges.partnershipId,
        })
        .from(bridges)
        .where(
          and(
            eq(bridges.projectId, partnership.projectId),
            eq(bridges.email, input.email),
            eq(bridges.status, "pending"),
          ),
        )
        .limit(1);
      if (existingBridge) {
        if (existingBridge.partnershipId !== partnership.id)
          throw createSituationErrors(errors).participantAlreadyInvited();
        const [native] = await db
          .select({
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          })
          .from(invitation)
          .where(eq(invitation.id, existingBridge.invitationId))
          .limit(1);
        if (
          native &&
          native.status === "pending" &&
          native.expiresAt > new Date()
        )
          // Idempotent issuance never resends: only explicit reissue delivers again.
          return {
            invitationId: existingBridge.invitationId,
            delivery: "already-issued" as const,
          };
        // Stale bridge: the native invitation is missing, expired, or closed.
        // Retire it and fall through to fresh issuance below.
        await db.transaction(async (tx) => {
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(
                eq(invitation.id, existingBridge.invitationId),
                eq(invitation.status, "pending"),
              ),
            );
          await tx
            .update(bridges)
            .set({ status: "revoked" })
            .where(eq(bridges.invitationId, existingBridge.invitationId));
        });
      }
      let invitationId: string;
      if (partnership.hostCanInvite) {
        const response = await auth.api
          .createInvitation({
            asResponse: true,
            headers: context.headers,
            body: {
              email: input.email,
              role: "participant",
              organizationId: partnership.hostId,
            },
          })
          .catch((error: unknown) => {
            throw normalizeBetterAuthError(
              error,
              createSituationErrors(errors),
              context.resHeaders,
            );
          });
        if (!response.ok)
          throw await normalizeBetterAuthResponse(
            response,
            createSituationErrors(errors),
            context.resHeaders,
          );
        invitationId = z
          .object({ id: z.string() })
          .parse(await response.json()).id;
        await db.insert(bridges).values({
          invitationId,
          partnershipId: partnership.id,
          projectId: partnership.projectId,
          email: input.email,
          issuedByUserId: context.user.id,
        });
      } else {
        // Partner issuers cannot call BA's host-only invite endpoint. Write the native
        // invitation shape plus bridge atomically, under the verified issuer guard.
        invitationId = randomUUID();
        await db.transaction(async (tx) => {
          await tx
            .insert(invitation)
            .values(
              newNativeParticipantInvitation(
                invitationId,
                partnership.hostId,
                input.email,
                context.user.id,
              ),
            );
          await tx.insert(bridges).values({
            invitationId,
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: input.email,
            issuedByUserId: context.user.id,
          });
        });
      }
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, invitationId);
    });
}
