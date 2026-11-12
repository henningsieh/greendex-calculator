import {
  IDENTIFIER_MAX_LENGTH,
  claimsTable,
  payoutAccountsTable,
  proofDocumentsTable,
  travelCostEntriesTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectPartnershipIdSchema } from "@/features/partnerships/validation-schemas";

const ClaimSelectSchema = createSelectSchema(claimsTable);

export const ClaimStatusSchema = ClaimSelectSchema.shape.status;
const ClaimPartnershipIdSchema = z.object({
  partnershipId: ProjectPartnershipIdSchema,
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

export const TravelCostEntryIdSchema = createSelectSchema(travelCostEntriesTable)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const PayoutAccountIdSchema = createSelectSchema(payoutAccountsTable)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const ProofDocumentIdSchema = createSelectSchema(proofDocumentsTable)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);
