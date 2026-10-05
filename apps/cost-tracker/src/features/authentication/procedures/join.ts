import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import "server-only";
import { addOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantProfilesTable as profiles,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  consumeEntryToken,
  recheckEntryToken,
  requireTokenRedeemable,
  resolveEntryToken,
} from "@/features/authentication/procedures/entry-tokens";
import {
  shouldGrantParticipantRole,
  joinInput,
  type RequirePublishedAgreement,
} from "@/features/authentication/procedures/shared";
import { participantGrantChangedCode } from "@/features/organizations/participant-membership-grant";
import { requireCostTrackerRole } from "@/features/organizations/roles";
import { auth } from "@/lib/auth";
import {
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
      // One shared resolution for both flavours of the same app-owned entry
      // mechanism: the bound secret resolves the token, and an email-bound
      // token additionally requires the verified account to match. A forwarded
      // link grants nothing to other accounts.
      const token =
        input.source.kind === "link"
          ? await resolveEntryToken(errors, "link", {
              id: input.source.id,
              secret: input.source.secret,
            })
          : await resolveEntryToken(errors, "invitation", {
              id: input.source.invitationId,
              secret: input.source.secret,
            });
      requireTokenRedeemable(errors, token, context.user.email);
      const partnershipId = token.partnershipId;
      const invitationId = token.email !== null ? token.id : undefined;
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
          country: participants.country,
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
      // Both entry flavours complete Membership through the same supported
      // server calls (ADR-0013): no Better Auth invitation is ever accepted
      // for participant entry, so there is no branch-specific write here.
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
              role: ORGANIZATION_ROLES.Participant,
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
          linkId: input.source.kind === "link" ? input.source.id : invitationId,
          previousRole: null,
          newRole: ORGANIZATION_ROLES.Participant,
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
          linkId: input.source.kind === "link" ? input.source.id : invitationId,
          previousRole: membership.role,
          newRole: addOrganizationRole(membership.role, ORGANIZATION_ROLES.Participant),
          at: new Date().toISOString(),
        });
      }
      return db.transaction(async (tx) => {
        // One shared row-locked recheck for both flavours: a link revoked
        // mid-join refuses, an invitation consumed mid-join stays redeemable.
        await recheckEntryToken(tx, errors, token);
        const [existing] = await tx
          .select({
            id: participants.id,
            partnerId: participants.representedOrganizationId,
            country: participants.country,
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
        if (existing && !existing.country) {
          // Legacy rows predate the required country: a repeat join fills the
          // missing value instead of failing idempotency. Set values stay —
          // corrections belong to the administrator update path.
          await tx
            .update(participants)
            .set({ country: input.profile.country })
            .where(eq(participants.id, existing.id));
        }
        if (!participationId) {
          const [created] = await tx
            .insert(participants)
            .values({
              projectId: partnership.projectId,
              representedOrganizationId: partnership.partnerId,
              userId: context.user.id,
              displayName: input.profile.fullName,
              email: context.user.email.trim().toLowerCase(),
              country: input.profile.country,
            })
            .onConflictDoNothing()
            .returning({ id: participants.id });
          if (!created)
            throw createSituationErrors(errors).participationIdentityConflict();
          participationId = created.id;
        }
        if (invitationId) {
          // Repeat successful redemption is safe: an accepted invitation with
          // an existing Participation resolves to the same identity.
          await consumeEntryToken(tx, invitationId);
        }
        return { participationId };
      });
    });
  return join;
}
