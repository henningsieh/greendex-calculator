import { addOrganizationRole } from "@greendex/auth";
import "server-only";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantProfilesTable as profiles,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { participantGrantChangedCode } from "@/features/organizations/participant-membership-grant";
import { requireCostTrackerRole } from "@/features/organizations/roles";
import {
  consumeEntryToken,
  recheckEntryToken,
  requireTokenRedeemable,
  resolveEntryToken,
} from "@/features/participant-onboarding/procedures/entry-tokens";
import {
  agreementInput,
  profileInput,
  success,
  shouldGrantParticipantRole,
  joinInput,
  type RequirePublishedAgreement,
} from "@/features/participant-onboarding/procedures/shared";
import { auth } from "@/lib/auth";
import {
  normalizeParticipantMembershipError,
  normalizeParticipantMembershipResponse,
} from "@/lib/orpc/better-auth-errors";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
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

/**
 * True when the join transaction failed because the entry token itself is
 * dead (revoked, expired or removed). Only then is compensation safe: no
 * legitimate retry of this join can ever succeed, so the membership this
 * join created must not survive. Every other failure (identity conflict,
 * transient outage) keeps the membership for the established safe retry.
 */
const TOKEN_DEAD_REASONS = new Set([
  "PARTICIPANT_INVITATION_CLOSED",
  "PARTICIPANT_INVITATION_EXPIRED",
  "PARTICIPANT_INVITATION_NOT_FOUND",
  "REGISTRATION_LINK_CLOSED",
  "REGISTRATION_LINK_NOT_FOUND",
]);

function isDeadTokenRejection(error: unknown): boolean {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    typeof (error as { code: unknown }).code !== "string"
  )
    return false;
  const situation = getSafeErrorSituation(
    error as { code: string; data?: unknown },
  );
  return !!situation && TOKEN_DEAD_REASONS.has(situation.reason);
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
      // #372: compensate the membership this join creates when the join
      // transaction fails because the entry token is dead (revoked, expired
      // or removed between the unlocked pre-check above and the row-locked
      // recheck inside the transaction). No legitimate retry can ever
      // consume such a join, so the fresh membership must not survive it.
      // Any other transaction failure keeps the established behavior
      // (membership retained for a safe retry), which
      // "retries app writes after the membership grant but the app
      // transaction failed" pins down. The grant path needs no
      // compensation at all: it appends to a pre-existing membership and a
      // retry converges idempotently through the grant endpoint.
      let createdMembershipId: string | null = null;
      const membershipWriteStartedAt = new Date();
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
        // Remember exactly the row this join created so a later transaction
        // failure can remove it again. The guards in the compensation delete
        // below (same id, same user/org, still the bare Participant role,
        // created after this join started) make sure a concurrently changed
        // row is never touched.
        const [createdMembership] = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.userId, context.user.id),
              eq(member.organizationId, partnership.hostId),
            ),
          )
          .limit(1);
        createdMembershipId = createdMembership?.id ?? null;
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
          newRole: addOrganizationRole(
            membership.role,
            ORGANIZATION_ROLES.Participant,
          ),
          at: new Date().toISOString(),
        });
      }
      try {
        return await db.transaction(async (tx) => {
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
      } catch (error) {
        // #372: see above. Only a dead token triggers compensation; every
        // other failure rethrows with the membership intact for retry.
        if (createdMembershipId && isDeadTokenRejection(error)) {
          try {
            await db
              .delete(member)
              .where(
                and(
                  eq(member.id, createdMembershipId),
                  eq(member.userId, context.user.id),
                  eq(member.organizationId, partnership.hostId),
                  eq(member.role, ORGANIZATION_ROLES.Participant),
                  gte(member.createdAt, membershipWriteStartedAt),
                ),
              );
            console.info("Participant membership compensated after failed join", {
              actor: context.user.id,
              membershipId: createdMembershipId,
              at: new Date().toISOString(),
            });
          } catch (compensationError) {
            console.error(
              "Failed to compensate participant membership after failed join",
              {
                actor: context.user.id,
                membershipId: createdMembershipId,
                compensationError,
              },
            );
          }
        }
        throw error;
      }
    });
  return join;
}

export function buildSaveProfile() {
  const saveProfile = authorized
    .input(profileInput)
    .output(success)
    .handler(async ({ context, input }) => {
      await db
        .insert(profiles)
        .values({ userId: context.user.id, fullName: input.fullName })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { fullName: input.fullName, updatedAt: new Date() },
        });
      return { success: true as const };
    });
  return saveProfile;
}

export function buildAcceptAgreement(
  requirePublishedAgreement: RequirePublishedAgreement,
) {
  const acceptAgreement = authorized
    .input(agreementInput)
    .output(z.object({ version: z.string() }))
    .handler(async ({ context, errors }) => {
      const version = requirePublishedAgreement(errors);
      await db
        .insert(acceptances)
        .values({
          userId: context.user.id,
          version: version.id,
          contentHash: version.contentHash,
          answers: JSON.stringify({ accepted: true }),
        })
        .onConflictDoNothing();
      return { version: version.id };
    });
  return acceptAgreement;
}
