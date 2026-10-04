import "server-only";
import { createHash } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { z } from "zod";

import {
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import {
  createSituationErrors,
  type SituationErrorConstructors,
} from "@/lib/orpc/errors";

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
  return function requirePublishedAgreement(
    errors: Pick<SituationErrorConstructors, "BAD_REQUEST">,
  ) {
    const version = currentAgreement();
    if (!isPublishedAgreement(version))
      throw createSituationErrors(errors).agreementUnavailable();
    return version;
  };
}

export type RequirePublishedAgreement = ReturnType<
  typeof makeRequirePublishedAgreement
>;
