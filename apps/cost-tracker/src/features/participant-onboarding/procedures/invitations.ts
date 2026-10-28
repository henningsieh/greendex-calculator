import "server-only";
import { createHash } from "node:crypto";

import { db } from "@greendex/database";
import {
  participantEntryTokensTable as tokens,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  findPendingInvitationToken,
  invitationTokenExpiry,
  issueEntryToken,
  revokeEntryTokenInTransaction,
} from "@/features/participant-onboarding/procedures/entry-tokens";
import { requirePartnerScopeAuthority } from "@/features/participant-onboarding/procedures/participant-entry";
import {
  id,
  invitationResult,
  INVITATION_TTL_MS,
  normalizedEmail,
  secretHash,
} from "@/features/participant-onboarding/procedures/shared";
import { sendParticipantInvitation } from "@/lib/email";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildIssueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const partnership = await requirePartnerScopeAuthority(
        context.headers,
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
      const result = await db.transaction(async (tx) => {
        // Share the Project lock with reissue: only the winning issuer delivers.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, partnership.projectId))
          .for("update");
        const existing = await findPendingInvitationToken(
          partnership.projectId,
          input.email,
          tx,
        );
        if (existing) {
          if (existing.partnershipId !== partnership.id)
            throw createSituationErrors(errors).participantAlreadyInvited();
          if (existing.expiresAt !== null && existing.expiresAt > new Date())
            return { kind: "already-issued", id: existing.id } as const;
          await revokeEntryTokenInTransaction(tx, existing.id);
        }
        const issued = await issueEntryToken(
          errors,
          {
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: input.email,
            expiresAt: invitationTokenExpiry(INVITATION_TTL_MS),
            issuedByUserId: context.user.id,
          },
          tx,
        );
        return { kind: "issued", ...issued } as const;
      });
      if (result.kind === "already-issued")
        return {
          invitationId: result.id,
          secret: null,
          delivery: "already-issued" as const,
        };
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, result.id, result.secret);
    });
}

export function buildReissueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const target = await requirePartnerScopeAuthority(
        context.headers,
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
        throw createSituationErrors(errors).participantAlreadyParticipates();
      const issued = await db.transaction(async (tx) => {
        // Serialize rotations across every Partnership in this Project.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, target.projectId))
          .for("update");
        const [previous] = await tx
          .select({
            id: tokens.id,
            partnershipId: tokens.partnershipId,
          })
          .from(tokens)
          .where(
            and(
              eq(tokens.projectId, target.projectId),
              eq(tokens.email, input.email),
              eq(tokens.status, "pending"),
            ),
          )
          .limit(1);
        if (!previous)
          throw createSituationErrors(errors).participantInvitationNotFound();
        if (previous.partnershipId !== target.id)
          await requirePartnerScopeAuthority(
            context.headers,
            previous.partnershipId,
            context.user.id,
            context.session.activeOrganizationId,
            errors,
          );
        // Newest wins: the previous identity can no longer be redeemed.
        await revokeEntryTokenInTransaction(tx, previous.id);
        return issueEntryToken(
          errors,
          {
            partnershipId: target.id,
            projectId: target.projectId,
            email: input.email,
            expiresAt: invitationTokenExpiry(INVITATION_TTL_MS),
            issuedByUserId: context.user.id,
          },
          tx,
        );
      });
      // Only explicit reissue creates a new identity and triggers another delivery.
      return deliverParticipantInvitation(input.email, issued.id, issued.secret);
    });
}

export function buildSetInvitationOpen() {
  return authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [token] = await db
        .select({
          partnershipId: tokens.partnershipId,
          email: tokens.email,
          status: tokens.status,
          expiresAt: tokens.expiresAt,
        })
        .from(tokens)
        .where(eq(tokens.id, input.invitationId))
        .limit(1);
      if (!token || token.email === null)
        throw createSituationErrors(errors).participantInvitationNotFound();
      await requirePartnerScopeAuthority(
        context.headers,
        token.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (token.status === "accepted")
        throw createSituationErrors(errors).participantInvitationAccepted();
      if (token.status !== "pending")
        throw createSituationErrors(errors).participantInvitationClosed();
      if (token.expiresAt !== null && token.expiresAt <= new Date())
        throw createSituationErrors(errors).participantInvitationExpired();
      // Revocation is terminal: reopening never resurrects a revoked identity
      // — reissue after revoke instead, mirroring newest-wins rotation.
      if (input.open) return { open: true };
      await db
        .update(tokens)
        .set({ status: "revoked" })
        .where(eq(tokens.id, input.invitationId));
      return { open: input.open };
    });
}

/**
 * Sends the invitation email only for a durably issued, still-live identity.
 * The invitation row is committed before this runs, so a delivery failure
 * stays retryable through reissue without duplicate or inconsistent grants.
 */
export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
  secret: string,
) {
  try {
    const [live] = await db
      .select({ id: tokens.id })
      .from(tokens)
      .where(
        and(
          eq(tokens.id, invitationId),
          eq(tokens.status, "pending"),
          sql`${tokens.expiresAt} > now()`,
          sql`lower(${tokens.email}) = ${email}`,
          eq(tokens.secretHash, secretHash(secret)),
        ),
      )
      .limit(1);
    if (!live) {
      console.info("Superseded Participant Invitation delivery skipped.");
      return { invitationId, secret, delivery: "failed" as const };
    }
    // Do not hold a DB lock across SMTP latency. A rotation in the check-to-send
    // window can deliver a dead link, but acceptance rejects it without state change.
    await sendParticipantInvitation({ email, invitationId, secret });
    return { invitationId, secret, delivery: "sent" as const };
  } catch {
    // The invitation is committed; correlate failures without logging bearer or error content.
    console.error("Participant Invitation email delivery failed.", {
      invitationIdHashPrefix: createHash("sha256")
        .update(invitationId)
        .digest("hex")
        .slice(0, 8),
    });
    return { invitationId, secret, delivery: "failed" as const };
  }
}
