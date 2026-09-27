import "server-only";
import { db } from "@greendex/database";
import {
  invitation,
  participantInvitationBridgesTable as bridges,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  id,
  partnershipForIssuer,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildSetInvitationOpen() {
  return authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [bridge] = await db
        .select({ partnershipId: bridges.partnershipId, status: bridges.status })
        .from(bridges)
        .where(eq(bridges.invitationId, input.invitationId))
        .limit(1);
      if (!bridge) throw errors.NOT_FOUND();
      await partnershipForIssuer(
        bridge.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (bridge.status === "accepted")
        throw errors.BAD_REQUEST({
          message: "Accepted invitations cannot be changed.",
        });
      const [native] = await db
        .select({ status: invitation.status, expiresAt: invitation.expiresAt })
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);
      if (
        !native ||
        native.status !== "pending" ||
        native.expiresAt <= new Date()
      )
        throw errors.BAD_REQUEST({ message: "Invitation is unavailable." });
      // Revocation also cancels the native invitation: a revoked bridge blocks
      // app join, but the native row would otherwise stay acceptable through
      // BA's public endpoint. Reopening never resurrects a canceled native row
      // (the pre-check above rejects it) — re-issue after revoke instead.
      await db.transaction(async (tx) => {
        await tx
          .update(bridges)
          .set({ status: input.open ? "pending" : "revoked" })
          .where(eq(bridges.invitationId, input.invitationId));
        if (!input.open) {
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(
                eq(invitation.id, input.invitationId),
                eq(invitation.status, "pending"),
              ),
            );
        }
      });
      return { open: input.open };
    });
}
