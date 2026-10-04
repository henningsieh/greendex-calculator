import "server-only";
import { db } from "@greendex/database";
import {
  member,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationsTable as invitations,
  participantProfilesTable as profiles,
  projectParticipantsTable as participants,
  user,
} from "@greendex/database/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const progress = z.object({
  email: z.string().nullable(),
  participationId: z.string().nullable(),
  participation: z.enum(["joined", "not-joined"]),
  invitationId: z.string().nullable(),
  profile: z.enum(["complete", "missing"]),
  agreement: z.enum(["current", "outdated", "missing", "unavailable"]),
  membership: z.enum(["participant", "missing"]),
  bridge: z.enum([
    "none",
    "pending",
    "accepted",
    "revoked",
    "expired",
    "canceled",
  ]),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

type InvitationRow = {
  status: string;
  expiresAt: Date;
};

function invitationState(
  row: InvitationRow | undefined,
  now: Date,
): z.infer<typeof progress>["bridge"] {
  if (!row) return "none";
  if (row.status === "accepted") return "accepted";
  if (row.status === "revoked") return "revoked";
  if (row.status !== "pending") return "canceled";
  return row.expiresAt <= now ? "expired" : "pending";
}

export function createOnboardingProgressProcedure(
  currentAgreement: () => ParticipantAgreementVersion = () =>
    CURRENT_PARTICIPANT_AGREEMENT_VERSION,
) {
  return authorized
    .input(z.object({ partnershipId: coordinationId }))
    .output(z.array(progress))
    .handler(async ({ input, context, errors }) => {
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.partnerId !== context.session.activeOrganizationId)
        throw createSituationErrors(errors).partnerOnboardingProgressRequired();

      const [joined, issued] = await Promise.all([
        db
          .select({
            id: participants.id,
            email: participants.email,
            userId: participants.userId,
            accountEmail: user.email,
          })
          .from(participants)
          .leftJoin(user, eq(user.id, participants.userId))
          .where(
            and(
              eq(participants.projectId, scope.projectId),
              eq(participants.representedOrganizationId, scope.partnerId),
              isNull(participants.mergedIntoParticipantId),
            ),
          ),
        db
          .select({
            invitationId: invitations.id,
            email: invitations.email,
            status: invitations.status,
            expiresAt: invitations.expiresAt,
            issuedAt: invitations.issuedAt,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.partnershipId, input.partnershipId),
              eq(invitations.projectId, scope.projectId),
            ),
          )
          .orderBy(desc(invitations.issuedAt), desc(invitations.id)),
      ]);

      // Historical reissues stay in persistence; only the latest invitation
      // describes the invitee's present state. A joined Participation takes
      // precedence.
      const latestByEmail = new Map<string, (typeof issued)[number]>();
      for (const row of issued) {
        const email = normalizeEmail(row.email);
        if (!latestByEmail.has(email)) latestByEmail.set(email, row);
      }
      const joinedByEmail = new Map<string, (typeof joined)[number]>();
      for (const row of joined) {
        joinedByEmail.set(
          row.email || row.accountEmail
            ? normalizeEmail(row.email ?? row.accountEmail!)
            : `participation:${row.id}`,
          row,
        );
      }
      const emails = [
        ...new Set([...latestByEmail.keys(), ...joinedByEmail.keys()]),
      ];
      if (!emails.length) return [];

      const linkedIds = joined.flatMap((row) => (row.userId ? [row.userId] : []));
      // An invitation alone does not prove account ownership: only verified
      // matching emails may expose User-owned onboarding state.
      const accounts = await db
        .select({
          id: user.id,
          email: user.email,
        })
        .from(user)
        .where(
          and(
            eq(user.emailVerified, true),
            sql`lower(trim(${user.email})) in (${sql.join(
              emails.map((email) => sql`${email}`),
              sql`, `,
            )})`,
          ),
        );
      const byEmail = new Map(
        accounts.map((row) => [normalizeEmail(row.email), row.id]),
      );
      const userIds = [
        ...new Set([...linkedIds, ...accounts.map((row) => row.id)]),
      ];
      const [profileRows, agreementRows, memberships] = userIds.length
        ? await Promise.all([
            db
              .select({ userId: profiles.userId })
              .from(profiles)
              .where(inArray(profiles.userId, userIds)),
            db
              .select({
                userId: acceptances.userId,
                version: acceptances.version,
                contentHash: acceptances.contentHash,
              })
              .from(acceptances)
              .where(inArray(acceptances.userId, userIds))
              .orderBy(desc(acceptances.acceptedAt), desc(acceptances.id)),
            db
              .select({ userId: member.userId, role: member.role })
              .from(member)
              .where(
                and(
                  eq(member.organizationId, scope.hostId),
                  inArray(member.userId, userIds),
                ),
              ),
          ])
        : [[], [], []];
      const profiled = new Set(profileRows.map((row) => row.userId));
      const latestAcceptance = new Map<string, (typeof agreementRows)[number]>();
      for (const row of agreementRows) {
        if (!latestAcceptance.has(row.userId))
          latestAcceptance.set(row.userId, row);
      }
      const roles = new Map(memberships.map((row) => [row.userId, row.role]));
      const version = currentAgreement();
      const published = isPublishedAgreement(version);
      const now = new Date();
      return emails.sort().map((email) => {
        const participation = joinedByEmail.get(email);
        const issued = latestByEmail.get(email);
        const userId = participation?.userId ?? byEmail.get(email);
        const accepted = userId ? latestAcceptance.get(userId) : undefined;
        const role = userId ? roles.get(userId) : undefined;
        return {
          email: participation?.email
            ? normalizeEmail(participation.email)
            : participation?.accountEmail
              ? normalizeEmail(participation.accountEmail)
              : issued
                ? email
                : null,
          participationId: participation?.id ?? null,
          participation: participation
            ? ("joined" as const)
            : ("not-joined" as const),
          invitationId: issued?.invitationId ?? null,
          profile:
            userId && profiled.has(userId)
              ? ("complete" as const)
              : ("missing" as const),
          agreement: !published
            ? ("unavailable" as const)
            : !accepted
              ? ("missing" as const)
              : accepted.version === version.id &&
                  accepted.contentHash === version.contentHash
                ? ("current" as const)
                : ("outdated" as const),
          membership: role
            ?.split(",")
            .some((value) =>
              ["participant", "owner", "admin"].includes(value.trim()),
            )
            ? ("participant" as const)
            : ("missing" as const),
          bridge: invitationState(issued, now),
        };
      });
    });
}

export const listOnboardingProgress = createOnboardingProgressProcedure();
