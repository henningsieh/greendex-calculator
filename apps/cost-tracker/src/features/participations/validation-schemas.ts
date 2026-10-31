import { z } from "zod";

import { CoordinationIdSchema } from "@/features/partnerships/coordination-id-schema";

export const JourneyInputSchema = z.object({
  partnershipId: CoordinationIdSchema,
  projectParticipantId: CoordinationIdSchema,
  origin: z
    .string({ error: "journeyOriginRequired" })
    .trim()
    .min(1, "journeyOriginRequired"),
  destination: z
    .string({ error: "journeyDestinationRequired" })
    .trim()
    .min(1, "journeyDestinationRequired"),
  tripType: z.enum(["one-way", "round-trip"], {
    error: "journeyTripTypeRequired",
  }),
  // numeric(12, 2) stores at most ten integer digits plus two decimals.
  erasmusDistanceKm: z
    .string({ error: "journeyDistanceRequired" })
    .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "journeyDistanceRequired")
    .refine((value) => Number(value) > 0, "journeyDistanceRequired"),
});
