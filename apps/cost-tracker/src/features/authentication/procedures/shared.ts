import "server-only";
import { createHash } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
  member,
} from "@greendex/database/schema";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { requirePartnerCoordination } from "@/features/projects/procedures/coordination";

export const id = z.string().min(1).max(128);
export const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
export const secretHash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export const success = z.object({ success: z.literal(true) });
export const profileInput = z.object({
  fullName: z.string().trim().min(1).max(200),
});
export const agreementInput = z.object({ accepted: z.literal(true) });
export const joinInput = z.object({
  profile: profileInput,
  agreement: agreementInput,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("link"), id, secret: z.string().min(1) }),
    z.object({ kind: z.literal("invitation"), invitationId: id }),
  ]),
});
export const invitationResult = z.object({
  invitationId: z.string(),
  delivery: z.enum(["sent", "failed", "already-issued"]),
});

// Partner invitations stay redeemable for 48 hours from issuance.
export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

export function shouldGrantParticipantRole(role: string): boolean {
  return (
    hasOrganizationRole(role, "project-coordinator") &&
    !["participant", "owner", "admin"].some((existing) =>
      role.split(",").some((value) => value.trim() === existing),
    )
  );
}

export function newNativeParticipantInvitation(
  invitationId: string,
  hostId: string,
  email: string,
  issuerId: string,
) {
  return {
    id: invitationId,
    organizationId: hostId,
    email,
    role: "participant",
    status: "pending",
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    inviterId: issuerId,
  };
}

export function makeRequirePublishedAgreement(
  currentAgreement: () => ParticipantAgreementVersion = () =>
    CURRENT_PARTICIPANT_AGREEMENT_VERSION,
) {
  return function requirePublishedAgreement(errors: {
    BAD_REQUEST: (args: { message: string }) => Error;
  }) {
    const version = currentAgreement();
    if (!isPublishedAgreement(version))
      throw errors.BAD_REQUEST({
        message: "Participant agreement is not yet available.",
      });
    return version;
  };
}

export type RequirePublishedAgreement = ReturnType<
  typeof makeRequirePublishedAgreement
>;

export async function partnershipForIssuer(
  partnershipId: string,
  userId: string,
  activeOrganizationId: string | null | undefined,
  errors: { FORBIDDEN: (args: { message: string }) => Error },
) {
  const [partnership] = await db
    .select({
      id: partnerships.id,
      projectId: partnerships.projectId,
      partnerId: partnerships.organizationId,
      hostId: projects.organizationId,
      archived: projects.archived,
    })
    .from(partnerships)
    .innerJoin(projects, eq(projects.id, partnerships.projectId))
    .where(eq(partnerships.id, partnershipId))
    .limit(1);
  if (
    !partnership ||
    partnership.archived ||
    (activeOrganizationId !== partnership.partnerId &&
      activeOrganizationId !== partnership.hostId)
  )
    throw errors.FORBIDDEN({ message: "Project Partnership is unavailable." });
  const roles = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        or(
          eq(member.organizationId, partnership.partnerId),
          eq(member.organizationId, partnership.hostId),
        ),
      ),
    );
  const permitted = roles.some(
    ({ organizationId, role }) =>
      organizationId === activeOrganizationId &&
      (hasOrganizationRole(role, "owner") || hasOrganizationRole(role, "admin")),
  );
  if (!permitted) {
    await requirePartnerCoordination(
      partnershipId,
      userId,
      activeOrganizationId,
      errors,
    );
  }
  return {
    ...partnership,
    hostCanInvite:
      activeOrganizationId === partnership.hostId &&
      roles.some(
        ({ organizationId, role }) =>
          organizationId === partnership.hostId &&
          (hasOrganizationRole(role, "owner") ||
            hasOrganizationRole(role, "admin")),
      ),
  };
}

export type PartnershipForIssuer = typeof partnershipForIssuer;
