import { claimsTable } from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { coordinationId } from "@/features/partnerships/procedures/coordination";

export const ClaimStatusSchema = createSelectSchema(claimsTable).shape.status;
export const ClaimPartnershipInputSchema = z.object({
  partnershipId: coordinationId,
});
export const ClaimScopeInputSchema = z.object({ partnershipId: coordinationId });
export const ClaimInputSchema = z.object({ partnershipId: coordinationId });

// Starting a draft can only return a Claim that the Partner may edit.
export const ClaimDraftSchema = z.object({
  id: z.string(),
  partnershipId: z.string(),
  status: z.enum(["editable", "correction_requested"]),
});
