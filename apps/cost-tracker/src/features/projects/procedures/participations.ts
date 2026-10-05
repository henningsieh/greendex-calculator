import "server-only";
import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { db } from "@greendex/database";
import {
  costAllocationsTable as allocations,
  duplicateReviewTasksTable as reviewTasks,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantJourneysTable as journeys,
  participantProfilesTable as profiles,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, asc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { memberHasParticipantAccess } from "@/features/organizations/roles";
import { isPartnerEditLocked } from "@/features/projects/claim-lifecycle";
import {
  groupHostedParticipants,
  type HostedParticipantRow,
} from "@/features/projects/hosted-participant-report";
import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requireHostCoordination,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import {
  isPartnerCoordinatorAssigned,
  requirePartnerScopeAuthority,
} from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
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
/**
 * Non-secret Project Partnership scope a procedure reports to the browser, which
 * evaluates the shared policy with it and authorizes nothing on its own (ADR-0014).
 */
const scopeContext = z.object({
  partnerOrganizationId: z.string(),
  hostOrganizationId: z.string(),
  assignedCoordinator: z.boolean(),
});
const scopeInput = z.object({ partnershipId: coordinationId });
const rowInput = scopeInput.extend({ id: coordinationId });

/**
 * The Hosting Participant view (ADR-0016): one group per
 * represented Partner Organization, carrying only counts and read-only
 * Participant data. It carries no edit, invitation or removal capability.
 */
const hostedReportParticipant = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  country: z.string().nullable(),
  agreement: z.enum(["completed", "pending"]),
});
const hostedReport = z.object({
  projectId: z.string(),
  agreement: z.object({
    versionId: z.string(),
    published: z.boolean(),
  }),
  organizations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      country: z.string().nullable(),
      participantCount: z.number().int().nonnegative(),
      completedCount: z.number().int().nonnegative(),
      pendingCount: z.number().int().nonnegative(),
      participants: z.array(hostedReportParticipant),
    }),
  ),
});

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
        projectName: z.string(),
        participations: z.array(participation),
        invitations: z.array(
          z.object({
            invitationId: z.string(),
            email: z.string(),
            status: z.string(),
          }),
        ),
        registrationLinks: z.array(
          z.object({ id: z.string(), enabled: z.boolean() }),
        ),
        entryContext: scopeContext,
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [rows, issued, project] = await Promise.all([
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
            id: entryTokens.id,
            email: entryTokens.email,
            status: entryTokens.status,
          })
          .from(entryTokens)
          .where(eq(entryTokens.partnershipId, input.partnershipId)),
        db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, scope.projectId))
          .limit(1)
          .then((found) => found[0]),
      ]);
      // One token table, two flavours: a bound email is an invitation,
      // a null email is a shareable link (pending means open).
      const invitations = issued.flatMap((token) =>
        token.email === null
          ? []
          : [
              {
                invitationId: token.id,
                email: token.email,
                status: token.status,
              },
            ],
      );
      const registrationLinks = issued.flatMap((token) =>
        token.email === null
          ? [{ id: token.id, enabled: token.status === "pending" }]
          : [],
      );
      return {
        projectName: project?.name ?? "",
        participations: rows,
        invitations,
        registrationLinks,
        entryContext: {
          partnerOrganizationId: scope.partnerId,
          hostOrganizationId: scope.hostId,
          assignedCoordinator: await isPartnerCoordinatorAssigned(
            context.user.id,
            input.partnershipId,
          ),
        },
      };
    });

  /**
   * The one Participant details read (ADR-0016). Both coordination sides may read
   * it; the correction decision travels beside the data so the browser renders
   * edit controls only when the shared policy permits it for the active scope.
   */
  const get = authorized
    .input(rowInput)
    .output(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        participation: participation,
        correctionContext: scopeContext,
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [row] = await db
        .select({ ...selected, projectName: projects.name })
        .from(participants)
        .innerJoin(projects, eq(projects.id, participants.projectId))
        .where(
          and(
            eq(participants.id, input.id),
            eq(participants.projectId, scope.projectId),
            eq(participants.representedOrganizationId, scope.partnerId),
            isNull(participants.mergedIntoParticipantId),
          ),
        )
        .limit(1);
      if (!row) throw createSituationErrors(errors).participationNotFound();
      const { projectName, ...details } = row;
      return {
        projectId: details.projectId,
        projectName,
        participation: details,
        correctionContext: {
          partnerOrganizationId: scope.partnerId,
          hostOrganizationId: scope.hostId,
          assignedCoordinator: await isPartnerCoordinatorAssigned(
            context.user.id,
            input.partnershipId,
          ),
        },
      };
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
        throw createSituationErrors(errors).partnerParticipantSearchRequired();
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement))
        throw createSituationErrors(errors).agreementUnavailable();
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
            memberHasParticipantAccess(member.role),
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
        throw createSituationErrors(errors).partnerParticipationCreateRequired();
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement))
        throw createSituationErrors(errors).agreementUnavailable();
      try {
        const outcome = await db.transaction(async (tx) => {
          // Shared lock order: the Partnership's Claim state guards this write.
          const { claim } = await lockClaimScope(
            tx,
            {
              projectId: scope.projectId,
              partnershipId: input.partnershipId,
              partnerOrganizationId: scope.partnerId,
            },
            errors,
            "partnership",
          );
          if (claim && isPartnerEditLocked(claim.status))
            throw createSituationErrors(errors).participationCreateLocked();
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
                memberHasParticipantAccess(member.role),
              ),
            )
            .limit(1);
          if (!candidate)
            throw createSituationErrors(errors).eligibleParticipantRequired();
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
          if (!created) {
            console.error("Participation insert returned no row");
            throw createSituationErrors(errors).internalFailure();
          }
          return { duplicate: false as const, created };
        });
        if (outcome.duplicate)
          throw createSituationErrors(errors).participationDuplicate();
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
            if (duplicate) {
              await db
                .insert(reviewTasks)
                .values({
                  partnershipId: input.partnershipId,
                  existingParticipationId: duplicate.id,
                  candidateUserId: input.userId,
                  candidateEmail: email,
                })
                .onConflictDoNothing();
              throw createSituationErrors(errors).participationDuplicate();
            }
          }
          console.error("Participation unique conflict has no scoped duplicate");
          throw createSituationErrors(errors).internalFailure();
        }
        if (postgresCode(error) === "23514")
          throw createSituationErrors(
            errors,
          ).participationRepresentationConflict();
        throw error;
      }
    });

  const update = authorized
    .input(rowInput.extend({ country: z.enum(EU_COUNTRY_CODES).nullable() }))
    .output(participation)
    .handler(async ({ input, context, errors }) => {
      // The Partner Organization alone corrects `country`, through the shared
      // policy the browser also evaluates; the server never trusts that decision.
      const scope = await requirePartnerScopeAuthority(
        context.headers,
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
        {
          hostingSide: () =>
            createSituationErrors(errors).partnerParticipationUpdateRequired(),
        },
      );
      return db.transaction(async (tx) => {
        // Shared lock order: the Partnership's Claim state guards this write.
        const { claim } = await lockClaimScope(
          tx,
          {
            projectId: scope.projectId,
            partnershipId: input.partnershipId,
            partnerOrganizationId: scope.partnerOrganizationId,
          },
          errors,
          "partnership",
        );
        if (claim && isPartnerEditLocked(claim.status))
          throw createSituationErrors(errors).participationUpdateLocked();
        const [changed] = await tx
          .update(participants)
          .set({ country: input.country })
          .where(
            and(
              eq(participants.id, input.id),
              eq(participants.projectId, scope.projectId),
              eq(
                participants.representedOrganizationId,
                scope.partnerOrganizationId,
              ),
              isNull(participants.mergedIntoParticipantId),
            ),
          )
          .returning(selected);
        if (!changed) throw createSituationErrors(errors).participationNotFound();
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
        throw createSituationErrors(errors).partnerParticipationRemoveRequired();
      try {
        return await db.transaction(async (tx) => {
          // Shared lock order: the Partnership's Claim state guards this write.
          const { claim } = await lockClaimScope(
            tx,
            {
              projectId: scope.projectId,
              partnershipId: input.partnershipId,
              partnerOrganizationId: scope.partnerId,
            },
            errors,
            "partnership",
          );
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
          if (!row) throw createSituationErrors(errors).participationNotFound();
          if (claim && isPartnerEditLocked(claim.status))
            throw createSituationErrors(errors).participationRemoveLocked();
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
            throw createSituationErrors(
              errors,
            ).participationJourneyOrCostReferenced();
          await tx.delete(participants).where(eq(participants.id, input.id));
          return { removed: true as const };
        });
      } catch (error) {
        if (postgresCode(error) === "23503")
          throw createSituationErrors(errors).participationReferenced();
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

  /**
   * The read-only Hosting Participant view for one hosted Project. Hosting-side
   * coordination is the same authority the Projects list and Claims review
   * use, so an unrelated Organization and an unassigned coordinator are
   * refused here too.
   */
  const listHostedReport = authorized
    .input(z.object({ projectId: coordinationId }))
    .output(hostedReport)
    .handler(async ({ input, context, errors }) => {
      await requireHostCoordination(
        input.projectId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const agreement = currentAgreement();
      const rows: HostedParticipantRow[] = await db
        .select({
          participationId: participants.id,
          organizationId: participants.representedOrganizationId,
          organizationName: organization.name,
          organizationCountry: organization.country,
          displayName: participants.displayName,
          email: participants.email,
          accountEmail: user.email,
          country: participants.country,
          userId: participants.userId,
        })
        .from(participants)
        .innerJoin(
          organization,
          eq(organization.id, participants.representedOrganizationId),
        )
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, input.projectId),
            isNull(participants.mergedIntoParticipantId),
          ),
        );
      const userIds = [
        ...new Set(rows.flatMap((row) => (row.userId ? [row.userId] : []))),
      ];
      const published = isPublishedAgreement(agreement);
      const accepted =
        published && userIds.length
          ? await db
              .select({ userId: acceptances.userId })
              .from(acceptances)
              .where(
                and(
                  inArray(acceptances.userId, userIds),
                  eq(acceptances.version, agreement.id),
                  eq(acceptances.contentHash, agreement.contentHash),
                ),
              )
          : [];
      const acceptsCurrentVersion = new Set(accepted.map((row) => row.userId));
      return {
        projectId: input.projectId,
        agreement: { versionId: agreement.id, published },
        organizations: groupHostedParticipants(rows, (userId) =>
          acceptsCurrentVersion.has(userId),
        ),
      };
    });

  const listMine = authorized
    .input(z.object({ projectId: coordinationId }))
    .output(z.array(participation))
    .handler(async ({ input, context, errors }) => {
      const agreement = currentAgreement();
      if (!isPublishedAgreement(agreement))
        throw createSituationErrors(errors).agreementUnavailable();
      const [profile] = await db
        .select({ id: profiles.userId })
        .from(profiles)
        .where(eq(profiles.userId, context.user.id))
        .limit(1);
      if (!profile) throw createSituationErrors(errors).incompleteProfile();
      const [acceptance] = await db
        .select({ id: acceptances.userId })
        .from(acceptances)
        .where(
          and(
            eq(acceptances.userId, context.user.id),
            eq(acceptances.version, agreement.id),
            eq(acceptances.contentHash, agreement.contentHash),
          ),
        )
        .limit(1);
      if (!acceptance) throw createSituationErrors(errors).agreementRequired();
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
            memberHasParticipantAccess(member.role),
          ),
        );
    });

  return {
    create,
    searchOnboarded,
    get,
    listPartnership,
    listHosted,
    listHostedReport,
    listMine,
    update,
    remove,
  };
}

export const participations = createParticipationProcedures();
