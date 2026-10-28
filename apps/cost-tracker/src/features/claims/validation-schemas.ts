import { claimsTable } from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { CoordinationIdSchema } from "@/features/partnerships/validation-schemas";

export const ClaimStatusSchema = createSelectSchema(claimsTable).shape.status;
const ClaimPartnershipIdSchema = z.object({
  partnershipId: CoordinationIdSchema,
});
export const ClaimPartnershipInputSchema = ClaimPartnershipIdSchema;
export const ClaimScopeInputSchema = ClaimPartnershipIdSchema;
export const ClaimInputSchema = ClaimPartnershipIdSchema;

// Starting a draft can only return a Claim that the Partner may edit.
export const ClaimDraftSchema = z.object({
  id: z.string(),
  partnershipId: z.string(),
  status: z.enum(["editable", "correction_requested"]),
});
