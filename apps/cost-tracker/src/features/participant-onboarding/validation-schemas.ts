import {
  IDENTIFIER_MAX_LENGTH,
  participantEntryTokensTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectPartnershipIdSchema } from "@/features/partnerships/validation-schemas";

const tokenColumns = createSelectSchema(participantEntryTokensTable);
const partnershipId = tokenColumns.shape.partnershipId
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);
const invitationId = tokenColumns.shape.id.min(1).max(IDENTIFIER_MAX_LENGTH);
export const NormalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export const ParticipantInvitationEmailInputSchema = z.object({
  partnershipId,
  email: NormalizedEmailSchema,
});
export const SetParticipantInvitationOpenInputSchema = z.object({
  invitationId,
  open: z.boolean(),
});
export const CreateParticipantRegistrationLinkInputSchema = z.object({
  partnershipId,
});
export const SetParticipantRegistrationLinkOpenInputSchema = z.object({
  id: invitationId,
  open: z.boolean(),
});
export const OnboardingProgressInputSchema = z.object({
  partnershipId: ProjectPartnershipIdSchema,
});
