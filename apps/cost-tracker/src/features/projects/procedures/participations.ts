import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  costAllocationsTable as allocations,
  duplicateReviewTasksTable as reviewTasks,
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationBridgesTable as bridges,
  participantJourneysTable as journeys,
  participantProfilesTable as profiles,
  projectParticipantsTable as participants,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, asc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { isPartnerEditLocked } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requireHostCoordination,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { authorized } from "@/lib/orpc/middleware";

const participation = z.object({
  id: z.string(),
  projectId: z.string(),
  representedOrganizationId: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  userId: z.string().nullable(),
  country: z.string().nullable(),
});
const selected = {
  id: participants.id,
  projectId: participants.projectId,
  representedOrganizationId: participants.representedOrganizationId,
  displayName: participants.displayName,
  email: participants.email,
  userId: participants.userId,
  country: participants.country,
};
const scopeInput = z.object({ partnershipId: coordinationId });
const rowInput = scopeInput.extend({ id: coordinationId });
const mergeMessage =
  "Identity already participates in this Project; request merge review.";

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return postgresCode(error.cause);
}

export function createParticipationProcedures(
  currentAgreement: () => ParticipantAgreementVersion = () =>
    CURRENT_PARTICIPANT_AGREEMENT_VERSION,
) {
  const listPartnership = authorized
    .input(scopeInput)
    .output(
      z.object({
        participations: z.array(participation),
        invitations: z.array(
          z.object({
            invitationId: z.string(),
            email: z.string(),
            status: z.string(),
          }),
        ),
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [rows, invitations] = await Promise.all([
        db
          .select(selected)
          .from(participants)
          .where(
            and(
              eq(participants.projectId, scope.projectId),
              eq(participants.representedOrganizationId, scope.partnerId),
              isNull(participants.mergedIntoParticipantId),
            ),
          ),
        db
          .select({
            invitationId: bridges.invitationId,
            email: bridges.email,
            status: bridges.status,
          })
          .from(bridges)
          .where(eq(bridges.partnershipId, input.partnershipId)),
      ]);
      return { participations: rows, invitations };
    });

  const searchOnboarded = authorized
    .input(scopeInput.extend({ search: z.string().trim().min(2).max(128) }))
    .output(z.array(z.object({ id: z.string(), name: z.string() })).max(20))
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.partnerId !== context.session.activeOrganizationId)
        throw errors.FORBIDDEN({
          message:
            "Only the Partner Organization may search onboarded Participants.",
        });
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement))
        throw errors.BAD_REQUEST({
          message: "Participant agreement is not yet available.",
        });
      const escaped = input.search.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      return db
        .select({ id: user.id, name: profiles.fullName })
        .from(user)
        .innerJoin(profiles, eq(profiles.userId, user.id))
        .innerJoin(
          acceptances,
          and(
            eq(acceptances.userId, user.id),
            eq(acceptances.version, agreement.id),
            eq(acceptances.contentHash, agreement.contentHash),
          ),
        )
        .innerJoin(
          member,
          and(
            eq(member.userId, user.id),
            eq(member.organizationId, scope.hostId),
          ),
        )
        .where(
          and(
            eq(user.emailVerified, true),
            sql`(',' || ${member.role} || ',') ~ ',(participant|owner|admin),'`,
            or(
              sql`lower(${user.id}) like lower(${pattern}) escape '\\'`,
              sql`lower(${user.email}) like lower(${pattern}) escape '\\'`,
              sql`lower(${profiles.fullName}) like lower(${pattern}) escape '\\'`,
            ),
          ),
        )
        .orderBy(asc(profiles.fullName), asc(user.id))
        .limit(20);
    });

  const create = authorized
    .input(scopeInput.extend({ userId: coordinationId }))
    .output(participation)
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.partnerId !== context.session.activeOrganizationId)
        throw errors.FORBIDDEN({
          message: "Only the Partner Organization may create its Participation.",
        });
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement))
        throw errors.BAD_REQUEST({
          message:
            "Participant agreement is not yet available; use the invitation onboarding path later.",
        });
      try {
        const outcome = await db.transaction(async (tx) => {
          const [partnership] = await tx
            .select({ id: partnerships.id })
            .from(partnerships)
            .where(
              and(
                eq(partnerships.id, input.partnershipId),
                eq(partnerships.organizationId, scope.partnerId),
              ),
            )
            .for("update")
            .limit(1);
          if (!partnership)
            throw errors.FORBIDDEN({
              message: "Project Partnership is unavailable.",
            });
          const [claim] = await tx
            .select({ status: claims.status })
            .from(claims)
            .where(eq(claims.partnershipId, input.partnershipId))
            .limit(1);
          if (claim && isPartnerEditLocked(claim.status))
            throw errors.BAD_REQUEST({
              message: "Locked Claim prevents Participation creation.",
            });
          const [candidate] = await tx
            .select({
              id: user.id,
              email: user.email,
              emailVerified: user.emailVerified,
              name: profiles.fullName,
            })
            .from(user)
            .innerJoin(profiles, eq(profiles.userId, user.id))
            .innerJoin(
              acceptances,
              and(
                eq(acceptances.userId, user.id),
                eq(acceptances.version, agreement.id),
                eq(acceptances.contentHash, agreement.contentHash),
              ),
            )
            .innerJoin(
              member,
              and(
                eq(member.userId, user.id),
                eq(member.organizationId, scope.hostId),
              ),
            )
            .where(
              and(
                eq(user.id, input.userId),
                eq(user.emailVerified, true),
                sql`(',' || ${member.role} || ',') ~ ',(participant|owner|admin),'`,
              ),
            )
            .limit(1);
          if (!candidate)
            throw errors.BAD_REQUEST({
              message:
                "User has not completed onboarding; use a Participant invitation instead.",
            });
          const email = candidate.email.trim().toLowerCase();
          const [duplicate] = await tx
            .select({ id: participants.id })
            .from(participants)
            .leftJoin(user, eq(user.id, participants.userId))
            .where(
              and(
                eq(participants.projectId, scope.projectId),
                isNull(participants.mergedIntoParticipantId),
                or(
                  eq(participants.userId, candidate.id),
                  eq(participants.email, email),
                  sql`lower(trim(${user.email})) = ${email}`,
                ),
              ),
            )
            .limit(1);
          if (duplicate) {
            await tx
              .insert(reviewTasks)
              .values({
                partnershipId: input.partnershipId,
                existingParticipationId: duplicate.id,
                candidateUserId: candidate.id,
                candidateEmail: email,
              })
              .onConflictDoNothing();
            return { duplicate: true as const };
          }
          const [created] = await tx
            .insert(participants)
            .values({
              projectId: scope.projectId,
              representedOrganizationId: scope.partnerId,
              userId: candidate.id,
              email,
              displayName: candidate.name,
            })
            .returning(selected);
          if (!created) throw new Error("Participation insert returned no row");
          return { duplicate: false as const, created };
        });
        if (outcome.duplicate)
          throw errors.BAD_REQUEST({ message: mergeMessage });
        return outcome.created;
      } catch (error) {
        if (postgresCode(error) === "23505") {
          // A concurrent onboarding write can win the Participation unique key.
          // Recover its duplicate signal in a fresh transaction after rollback.
          const [candidate] = await db
            .select({ email: user.email })
            .from(user)
            .where(eq(user.id, input.userId))
            .limit(1);
          if (candidate) {
            const email = candidate.email.trim().toLowerCase();
            const [duplicate] = await db
              .select({ id: participants.id })
              .from(participants)
              .leftJoin(user, eq(user.id, participants.userId))
              .where(
                and(
                  eq(participants.projectId, scope.projectId),
                  isNull(participants.mergedIntoParticipantId),
                  or(
                    eq(participants.userId, input.userId),
                    eq(participants.email, email),
                    sql`lower(trim(${user.email})) = ${email}`,
                  ),
                ),
              )
              .limit(1);
            if (duplicate)
              await db
                .insert(reviewTasks)
                .values({
                  partnershipId: input.partnershipId,
                  existingParticipationId: duplicate.id,
                  candidateUserId: input.userId,
                  candidateEmail: email,
                })
                .onConflictDoNothing();
          }
          throw errors.BAD_REQUEST({ message: mergeMessage });
        }
        if (postgresCode(error) === "23514")
          throw errors.FORBIDDEN({
            message: "Project Partnership is unavailable.",
          });
        throw error;
      }
    });

  const update = authorized
    .input(
      rowInput.extend({
        country: z
          .enum([
            "AT",
            "BE",
            "BG",
            "HR",
            "CY",
            "CZ",
            "DK",
            "EE",
            "FI",
            "FR",
            "DE",
            "GR",
            "HU",
            "IE",
            "IT",
            "LV",
            "LT",
            "LU",
            "MT",
            "NL",
            "PL",
            "PT",
            "RO",
            "SK",
            "SI",
            "ES",
            "SE",
          ])
          .nullable(),
      }),
    )
    .output(participation)
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.partnerId !== context.session.activeOrganizationId)
        throw errors.FORBIDDEN({
          message: "Only the Partner Organization may update its Participation.",
        });
      return db.transaction(async (tx) => {
        const [partnership] = await tx
          .select({ id: partnerships.id })
          .from(partnerships)
          .where(
            and(
              eq(partnerships.id, input.partnershipId),
              eq(partnerships.organizationId, scope.partnerId),
            ),
          )
          .for("update")
          .limit(1);
        if (!partnership)
          throw errors.FORBIDDEN({
            message: "Project Partnership is unavailable.",
          });
        const [submitted] = await tx
          .select({ status: claims.status })
          .from(claims)
          .where(eq(claims.partnershipId, input.partnershipId))
          .limit(1);
        if (submitted && isPartnerEditLocked(submitted.status))
          throw errors.BAD_REQUEST({
            message: "Locked Claim prevents Participation changes.",
          });
        const [changed] = await tx
          .update(participants)
          .set({ country: input.country })
          .where(
            and(
              eq(participants.id, input.id),
              eq(participants.projectId, scope.projectId),
              eq(participants.representedOrganizationId, scope.partnerId),
              isNull(participants.mergedIntoParticipantId),
            ),
          )
          .returning(selected);
        if (!changed)
          throw errors.FORBIDDEN({ message: "Participation is unavailable." });
        return changed;
      });
    });

  const remove = authorized
    .input(rowInput)
    .output(z.object({ removed: z.literal(true) }))
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.partnerId !== context.session.activeOrganizationId)
        throw errors.FORBIDDEN({
          message: "Only the Partner Organization may remove its Participation.",
        });
      try {
        return await db.transaction(async (tx) => {
          const [partnership] = await tx
            .select({ id: partnerships.id })
            .from(partnerships)
            .where(
              and(
                eq(partnerships.id, input.partnershipId),
                eq(partnerships.organizationId, scope.partnerId),
              ),
            )
            .for("update")
            .limit(1);
          if (!partnership)
            throw errors.FORBIDDEN({
              message: "Project Partnership is unavailable.",
            });
          const [row] = await tx
            .select({ id: participants.id })
            .from(participants)
            .where(
              and(
                eq(participants.id, input.id),
                eq(participants.projectId, scope.projectId),
                eq(participants.representedOrganizationId, scope.partnerId),
                isNull(participants.mergedIntoParticipantId),
              ),
            )
            .for("update")
            .limit(1);
          if (!row)
            throw errors.FORBIDDEN({ message: "Participation is unavailable." });
          const [claim] = await tx
            .select({ status: claims.status })
            .from(claims)
            .where(eq(claims.partnershipId, input.partnershipId))
            .limit(1);
          if (claim && isPartnerEditLocked(claim.status))
            throw errors.BAD_REQUEST({
              message: "Locked Claim prevents Participation removal.",
            });
          const [reference] = await tx
            .select({ id: participants.id })
            .from(participants)
            .where(
              and(
                eq(participants.id, input.id),
                or(
                  exists(
                    tx
                      .select({ id: journeys.id })
                      .from(journeys)
                      .where(eq(journeys.projectParticipantId, participants.id)),
                  ),
                  exists(
                    tx
                      .select({ id: allocations.projectParticipantId })
                      .from(allocations)
                      .where(
                        eq(allocations.projectParticipantId, participants.id),
                      ),
                  ),
                ),
              ),
            )
            .limit(1);
          if (reference)
            throw errors.BAD_REQUEST({
              message:
                "Participation is referenced by Claim or merge data; request review instead.",
            });
          await tx.delete(participants).where(eq(participants.id, input.id));
          return { removed: true as const };
        });
      } catch (error) {
        if (postgresCode(error) === "23503")
          throw errors.BAD_REQUEST({
            message: "Participation is referenced; request review instead.",
          });
        throw error;
      }
    });

  const listHosted = authorized
    .input(z.object({ projectId: coordinationId }))
    .output(z.array(participation))
    .handler(async ({ input, context, errors }) => {
      await requireHostCoordination(
        input.projectId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      return db
        .select(selected)
        .from(participants)
        .where(
          and(
            eq(participants.projectId, input.projectId),
            isNull(participants.mergedIntoParticipantId),
          ),
        );
    });

  const listMine = authorized
    .input(z.object({ projectId: coordinationId }))
    .output(z.array(participation))
    .handler(async ({ input, context, errors }) => {
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement)) throw errors.FORBIDDEN();
      const [eligible] = await db
        .select({ id: profiles.userId })
        .from(profiles)
        .innerJoin(
          acceptances,
          and(
            eq(acceptances.userId, profiles.userId),
            eq(acceptances.version, agreement.id),
            eq(acceptances.contentHash, agreement.contentHash),
          ),
        )
        .where(eq(profiles.userId, context.user.id))
        .limit(1);
      if (!eligible) throw errors.FORBIDDEN();
      return db
        .select(selected)
        .from(participants)
        .innerJoin(projects, eq(projects.id, participants.projectId))
        .innerJoin(
          member,
          and(
            eq(member.organizationId, projects.organizationId),
            eq(member.userId, context.user.id),
          ),
        )
        .where(
          and(
            eq(participants.projectId, input.projectId),
            eq(participants.userId, context.user.id),
            isNull(participants.mergedIntoParticipantId),
            sql`(',' || ${member.role} || ',') ~ ',(participant|owner|admin),'`,
          ),
        );
    });

  return {
    create,
    searchOnboarded,
    listPartnership,
    listHosted,
    listMine,
    update,
    remove,
  };
}

export const participations = createParticipationProcedures();
