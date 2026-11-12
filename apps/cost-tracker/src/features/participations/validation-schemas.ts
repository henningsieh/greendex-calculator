import {
  IDENTIFIER_MAX_LENGTH,
  participantJourneysTable,
  projectParticipantsTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { CoordinationIdSchema } from "@/features/partnerships/validation-schemas";

const journeyColumns = createSelectSchema(participantJourneysTable);

export const JourneyInputSchema = z.object({
  partnershipId: CoordinationIdSchema,
  projectParticipantId: CoordinationIdSchema,
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
  // numeric(12, 2) stores at most ten integer digits plus two decimals.
  erasmusDistanceKm: journeyColumns.shape.erasmusDistanceKm
    .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "journeyDistanceRequired")
    .refine((value) => Number(value) > 0, "journeyDistanceRequired"),
});

export const ProjectParticipationIdSchema = createSelectSchema(
  projectParticipantsTable,
)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);
