import "server-only";
import { createHash } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
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
export const joinProfileInput = profileInput.extend({
  // EU country from the participation questionnaire. Stored on the Project
  // Participation, never on the User profile (docs/domain-behavior.md).
  country: z.enum(EU_COUNTRY_CODES),
});
export const agreementInput = z.object({ accepted: z.literal(true) });
export const joinInput = z.object({
  profile: joinProfileInput,
  agreement: agreementInput,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("link"), id, secret: z.string().min(1) }),
    z.object({
      kind: z.literal("invitation"),
      invitationId: id,
      secret: z.string().min(1),
    }),
  ]),
});
export const invitationResult = z.object({
  invitationId: z.string(),
  // Returned once at issuance, like registration-link secrets: the emailed
  // link carries it, and the server only stores its hash. Duplicate issuance
  // reports the live identity with a null secret instead of resending.
  secret: z.string().nullable(),
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
