import "server-only";
import { addOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationBridgesTable as bridges,
  participantProfilesTable as profiles,
  participantRegistrationLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  shouldGrantParticipantRole,
  secretHash,
  joinInput,
  type RequirePublishedAgreement,
} from "@/features/authentication/procedures/shared";
import { participantGrantChangedCode } from "@/features/organizations/participant-membership-grant";
import { requireCostTrackerRole } from "@/features/organizations/roles";
import { auth } from "@/lib/auth";
import {
  normalizeBetterAuthError,
  normalizeBetterAuthResponse,
  normalizeParticipantMembershipError,
  normalizeParticipantMembershipResponse,
} from "@/lib/orpc/better-auth-errors";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

// The grant endpoint signals a stale expected role with its own fixed code, so a
// changed Membership retries against a fresh read instead of failing opaquely.
async function isGrantRoleStale(response: Response): Promise<boolean> {
  try {
    const parsed = z
      .object({ code: z.string() })
      .safeParse(await response.clone().json());
    return parsed.success && parsed.data.code === participantGrantChangedCode;
  } catch {
    return false;
  }
}

export function buildJoin(requirePublishedAgreement: RequirePublishedAgreement) {
  const join = authorized
    .input(joinInput)
    .output(z.object({ participationId: z.string() }))
    .handler(async ({ context, input, errors }) => {
      const version = requirePublishedAgreement(errors);
      if (!context.user.emailVerified)
        throw createSituationErrors(errors).verifyEmail();
      let partnershipId: string;
      let bridgeId: string | undefined;
      if (input.source.kind === "link") {
        const [link] = await db
          .select()
          .from(links)
          .where(eq(links.id, input.source.id))
          .limit(1);
        if (!link || link.secretHash !== secretHash(input.source.secret))
          throw createSituationErrors(errors).registrationLinkNotFound();
        if (!link.enabled)
          throw createSituationErrors(errors).registrationLinkClosed();
        partnershipId = link.partnershipId;
      } else {
        const [bridge] = await db
          .select()
          .from(bridges)
          .where(eq(bridges.invitationId, input.source.invitationId))
          .limit(1);
        if (!bridge)
          throw createSituationErrors(errors).participantInvitationNotFound();
        if (bridge.email !== context.user.email.trim().toLowerCase())
          throw createSituationErrors(errors).participantInvitationWrongAccount();
        if (bridge.status !== "pending" && bridge.status !== "accepted")
          throw createSituationErrors(errors).participantInvitationClosed();
        const [nativeInvitation] = await db
          .select({ expiresAt: invitation.expiresAt, status: invitation.status })
          .from(invitation)
          .where(eq(invitation.id, bridge.invitationId))
          .limit(1);
        if (!nativeInvitation)
          throw createSituationErrors(errors).participantInvitationNotFound();
        if (
          bridge.status === "pending" &&
          nativeInvitation.expiresAt <= new Date()
        )
          throw createSituationErrors(errors).participantInvitationExpired();
        if (
          bridge.status === "pending" &&
          nativeInvitation.status !== "pending" &&
          nativeInvitation.status !== "accepted"
        )
          throw createSituationErrors(errors).participantInvitationClosed();
        partnershipId = bridge.partnershipId;
        bridgeId = bridge.invitationId;
      }
      const [partnership] = await db
        .select({
          projectId: partnerships.projectId,
          partnerId: partnerships.organizationId,
          hostId: projects.organizationId,
          archived: projects.archived,
        })
        .from(partnerships)
        .innerJoin(projects, eq(projects.id, partnerships.projectId))
        .where(eq(partnerships.id, partnershipId))
        .limit(1);
      if (!partnership || partnership.archived)
        throw createSituationErrors(errors).partnershipNotFound();
      const [previous] = await db
        .select({
          id: participants.id,
          partnerId: participants.representedOrganizationId,
        })
        .from(participants)
        .where(
          and(
            eq(participants.projectId, partnership.projectId),
            eq(participants.userId, context.user.id),
          ),
        )
        .limit(1);
      if (previous && previous.partnerId !== partnership.partnerId)
        throw createSituationErrors(errors).joinedOtherPartner();
      if (bridgeId && !previous) {
        const [existingMembership] = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, partnership.hostId),
              eq(member.userId, context.user.id),
            ),
          )
          .limit(1);
        if (!existingMembership) {
          const response = await auth.api
            .acceptInvitation({
              asResponse: true,
              headers: context.headers,
              body: { invitationId: bridgeId },
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
        }
      }
      const [membership] = await db
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, partnership.hostId),
            eq(member.userId, context.user.id),
          ),
        )
        .limit(1);
      if (membership)
        requireCostTrackerRole(membership.role, () =>
          createSituationErrors(errors).invalidOrganizationRole(),
        );
      if (!membership) {
        const response = await auth.api
          .addMember({
            asResponse: true,
            body: {
              userId: context.user.id,
              organizationId: partnership.hostId,
              role: "participant",
            },
          })
          .catch((error: unknown) => {
            throw normalizeParticipantMembershipError(
              error,
              createSituationErrors(errors),
              context.resHeaders,
            );
          });
        if (!response.ok)
          throw await normalizeParticipantMembershipResponse(
            response,
            createSituationErrors(errors),
            context.resHeaders,
          );
        console.info("Participant membership created", {
          actor: context.user.id,
          linkId: input.source.kind === "link" ? input.source.id : bridgeId,
          previousRole: null,
          newRole: "participant",
          at: new Date().toISOString(),
        });
      } else if (shouldGrantParticipantRole(membership.role)) {
        // #183 appends coordinator to assigned members; joining must retain every existing role.
        // The grant runs through the server-only participant-membership endpoint (ADR-0013):
        // this procedure authorized the join, Better Auth owns the write and its role hooks.
        const response = await auth.api
          .grantParticipantMembership({
            asResponse: true,
            body: {
              userId: context.user.id,
              organizationId: partnership.hostId,
              expectedRole: membership.role,
            },
          })
          .catch((error: unknown) => {
            throw normalizeParticipantMembershipError(
              error,
              createSituationErrors(errors),
              context.resHeaders,
            );
          });
        if (!response.ok) {
          if (await isGrantRoleStale(response))
            throw createSituationErrors(errors).membershipChanged();
          throw await normalizeParticipantMembershipResponse(
            response,
            createSituationErrors(errors),
            context.resHeaders,
          );
        }
        console.info("Participant membership updated", {
          actor: context.user.id,
          linkId: input.source.kind === "link" ? input.source.id : bridgeId,
          previousRole: membership.role,
          newRole: addOrganizationRole(membership.role, "participant"),
          at: new Date().toISOString(),
        });
      }
      return db.transaction(async (tx) => {
        if (input.source.kind === "link") {
          const [link] = await tx
            .select({ enabled: links.enabled })
            .from(links)
            .where(
              and(
                eq(links.id, input.source.id),
                eq(links.partnershipId, partnershipId),
              ),
            )
            .for("update")
            .limit(1);
          if (!link)
            throw createSituationErrors(errors).registrationLinkNotFound();
          if (!link.enabled)
            throw createSituationErrors(errors).registrationLinkClosed();
        } else {
          const [bridge] = await tx
            .select({ status: bridges.status })
            .from(bridges)
            .where(eq(bridges.invitationId, bridgeId!))
            .for("update")
            .limit(1);
          if (!bridge)
            throw createSituationErrors(errors).participantInvitationNotFound();
          if (bridge.status !== "pending" && bridge.status !== "accepted")
            throw createSituationErrors(errors).participantInvitationClosed();
        }
        const [existing] = await tx
          .select({
            id: participants.id,
            partnerId: participants.representedOrganizationId,
          })
          .from(participants)
          .where(
            and(
              eq(participants.projectId, partnership.projectId),
              eq(participants.userId, context.user.id),
            ),
          )
          .limit(1);
        if (existing && existing.partnerId !== partnership.partnerId)
          throw createSituationErrors(errors).joinedOtherPartner();
        await tx
          .insert(profiles)
          .values({ userId: context.user.id, fullName: input.profile.fullName })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: { fullName: input.profile.fullName, updatedAt: new Date() },
          });
        await tx
          .insert(acceptances)
          .values({
            userId: context.user.id,
            version: version.id,
            contentHash: version.contentHash,
            answers: JSON.stringify(input.agreement),
          })
          .onConflictDoNothing();
        let participationId = existing?.id;
        if (!participationId) {
          const [created] = await tx
            .insert(participants)
            .values({
              projectId: partnership.projectId,
              representedOrganizationId: partnership.partnerId,
              userId: context.user.id,
              displayName: input.profile.fullName,
              email: context.user.email.trim().toLowerCase(),
            })
            .onConflictDoNothing()
            .returning({ id: participants.id });
          if (!created)
            throw createSituationErrors(errors).participationIdentityConflict();
          participationId = created.id;
        }
        if (bridgeId) {
          await tx
            .update(bridges)
            .set({ status: "accepted", acceptedAt: new Date() })
            .where(eq(bridges.invitationId, bridgeId));
          // Existing host members do not call BA accept; disable the unused native
          // invitation so its public endpoint cannot create a duplicate membership.
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(eq(invitation.id, bridgeId), eq(invitation.status, "pending")),
            );
        }
        return { participationId };
      });
    });
  return join;
}
