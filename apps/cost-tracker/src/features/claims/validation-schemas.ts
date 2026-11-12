import { claimsTable } from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { CoordinationIdSchema } from "@/features/partnerships/validation-schemas";

const ClaimSelectSchema = createSelectSchema(claimsTable);

export const ClaimStatusSchema = ClaimSelectSchema.shape.status;
const ClaimPartnershipIdSchema = z.object({
  partnershipId: CoordinationIdSchema,
});
export const ClaimPartnershipInputSchema = ClaimPartnershipIdSchema;
export const ClaimScopeInputSchema = ClaimPartnershipIdSchema;
export const ClaimInputSchema = ClaimPartnershipIdSchema;

// Starting a draft can only return a Claim that the Partner may edit.
export const ClaimDraftSchema = ClaimSelectSchema.pick({
  id: true,
  partnershipId: true,
}).extend({
  status: ClaimStatusSchema.extract(["editable", "correction_requested"]),
});
