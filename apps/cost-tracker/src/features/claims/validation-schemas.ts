import {
  IDENTIFIER_MAX_LENGTH,
  claimsTable,
  payoutAccountsTable,
  proofDocumentsTable,
  travelCostEntriesTable,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { getCountrySpecifications, isValidIBAN } from "ibantools";
import { z } from "zod";

import { ProjectPartnershipIdSchema } from "@/features/partnerships/validation-schemas";

const ibanCountries = getCountrySpecifications();
const PayoutAccountSelectSchema = createSelectSchema(payoutAccountsTable);

export const PayoutAccountCreateSchema = z.object({
  accountHolder: PayoutAccountSelectSchema.shape.accountHolder
    .trim()
    .min(1, "accountHolderRequired")
    .max(200, "accountHolderTooLong"),
  iban: PayoutAccountSelectSchema.shape.iban
    .trim()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .refine(
      (value) =>
        ibanCountries[value.slice(0, 2)]?.IBANRegistry === true &&
        isValidIBAN(value),
      "ibanInvalid",
    ),
  bic: PayoutAccountSelectSchema.shape.bic
    .unwrap()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) =>
        value === "" ||
        /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(value),
      "bicInvalid",
    ),
});

export type PayoutAccountCreateValues = z.infer<typeof PayoutAccountCreateSchema>;

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
  status: ClaimStatusSchema.extract(["in_preparation", "correction_requested"]),
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
