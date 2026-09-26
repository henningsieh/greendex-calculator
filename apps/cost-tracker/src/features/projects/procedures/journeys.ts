import "server-only";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  participantJourneysTable as journeys,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { claimLocksPartnerEdits } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { authorized } from "@/lib/orpc/middleware";

const scopeInput = z.object({ partnershipId: coordinationId });
const journeyInput = scopeInput.extend({
  projectParticipantId: coordinationId,
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  tripType: z.enum(["one-way", "round-trip"]),
  erasmusDistanceKm: z
    .string()
    .regex(
      /^\d+(?:\.\d{1,2})?$/,
      "Enter a positive distance with at most two decimal places.",
    )
    .refine(
      (value) => Number(value) > 0 && Number(value) <= 9999999999.99,
      "Distance must be positive and fit the supported precision.",
    ),
});
const journeyOutput = journeyInput
  .omit({ partnershipId: true })
  .extend({ id: z.string() });
const selected = {
  id: journeys.id,
  projectParticipantId: journeys.projectParticipantId,
  origin: journeys.origin,
  destination: journeys.destination,
  tripType: journeys.tripType,
  erasmusDistanceKm: journeys.erasmusDistanceKm,
};

async function requirePartnerSide(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Parameters<typeof requirePartnerCoordination>[3],
) {
  const scope = await requirePartnerCoordination(
    partnershipId,
    actorId,
    activeOrganizationId,
    errors,
  );
  if (scope.partnerId !== activeOrganizationId)
    throw errors.FORBIDDEN({
      message: "Only the Partner Organization may manage Participant Journeys.",
    });
  return scope;
}

/** Read only the Partnership's represented Participations, never Claims. */
export const list = authorized
  .input(scopeInput)
  .output(z.array(journeyOutput))
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db
      .select(selected)
      .from(journeys)
      .innerJoin(participants, eq(participants.id, journeys.projectParticipantId))
      .where(
        and(
          eq(participants.projectId, scope.projectId),
          eq(participants.representedOrganizationId, scope.partnerId),
          isNull(participants.mergedIntoParticipantId),
        ),
      );
  });

/** Serialize first snapshot and journey creation by locking the Project in one transaction. */
export const save = authorized
  .input(journeyInput)
  .output(journeyOutput)
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db.transaction(async (tx) => {
      const [lockedProject] = await tx
        .select({ id: projects.id })
        .from(projects)
        .innerJoin(
          partnerships,
          and(
            eq(partnerships.projectId, projects.id),
            eq(partnerships.id, input.partnershipId),
            eq(partnerships.organizationId, scope.partnerId),
          ),
        )
        .where(
          and(eq(projects.id, scope.projectId), eq(projects.archived, false)),
        )
        .for("update")
        .limit(1);
      if (!lockedProject)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
      const [lockedPartnership] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(eq(partnerships.id, input.partnershipId))
        .for("update")
        .limit(1);
      if (!lockedPartnership)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
      const [claim] = await tx
        .select({ status: claims.status })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (claim && claimLocksPartnerEdits(claim.status))
        throw errors.BAD_REQUEST({
          message: "Claim is locked; Participant Journeys cannot change.",
        });
      const [participation] = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.id, input.projectParticipantId),
            eq(participants.projectId, scope.projectId),
            eq(participants.representedOrganizationId, scope.partnerId),
            isNull(participants.mergedIntoParticipantId),
          ),
        )
        .limit(1);
      if (!participation)
        throw errors.BAD_REQUEST({
          message: "Select a Participation in this Project Partnership.",
        });
      const [existing] = await tx
        .select({ id: journeys.id })
        .from(journeys)
        .where(eq(journeys.projectParticipantId, participation.id))
        .limit(1);
      if (existing)
        throw errors.BAD_REQUEST({
          message: "This Participation already has a Participant Journey.",
        });
      const [snapshot] = await tx
        .select({ projectId: snapshots.projectId })
        .from(snapshots)
        .where(eq(snapshots.projectId, scope.projectId))
        .limit(1);
      if (!snapshot) {
        await tx.insert(snapshots).values({
          projectId: scope.projectId,
          rulesVersion: TRAVEL_FUNDING_RULES.version,
          participantTransportProfiles: [
            ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
          ],
        });
        await tx.insert(bands).values(
          TRAVEL_FUNDING_RULES.bands.map((band) => ({
            projectId: scope.projectId,
            minKm: String(band.minKm),
            maxKm: String(band.maxKm),
            standardEur: String(band.standardEur),
            greenEur: String(band.greenEur),
          })),
        );
      }
      const [saved] = await tx
        .insert(journeys)
        .values({
          projectParticipantId: participation.id,
          origin: input.origin,
          destination: input.destination,
          tripType: input.tripType,
          erasmusDistanceKm: input.erasmusDistanceKm,
        })
        .returning(selected);
      return saved;
    });
  });
