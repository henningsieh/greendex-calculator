import {
  IDENTIFIER_MAX_LENGTH,
  duplicateReviewTasksTable,
  participantJourneysTable,
  projectParticipantsTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectPartnershipIdSchema } from "@/features/partnerships/validation-schemas";

export const ProjectParticipationIdSchema = createSelectSchema(
  projectParticipantsTable,
)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const ReviewTaskIdSchema = createSelectSchema(duplicateReviewTasksTable)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

const journeyColumns = createSelectSchema(participantJourneysTable);

// numeric(12, 2) stores at most ten integer digits plus two decimals.
export const ErasmusDistanceKmSchema = z
  .string({ error: "journeyDistanceRequired" })
  .pipe(
    journeyColumns.shape.erasmusDistanceKm
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "journeyDistanceRequired")
      .refine((value) => Number(value) > 0, "journeyDistanceRequired"),
  );

export const JourneyInputSchema = z.object({
  partnershipId: ProjectPartnershipIdSchema,
  projectParticipantId: ProjectParticipationIdSchema,
  origin: z
    .string({ error: "journeyOriginRequired" })
    .pipe(journeyColumns.shape.origin.trim().min(1, "journeyOriginRequired")),
  destination: z
    .string({ error: "journeyDestinationRequired" })
    .pipe(
      journeyColumns.shape.destination
        .trim()
        .min(1, "journeyDestinationRequired"),
    ),
  tripType: z.enum(journeyColumns.shape.tripType.options, {
    error: "journeyTripTypeRequired",
  }),
  erasmusDistanceKm: ErasmusDistanceKmSchema,
});
