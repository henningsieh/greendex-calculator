import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { z } from "zod";

import {
  decimalUnits,
  TOTAL_ALLOCATION_PERCENTAGE_UNITS,
} from "@/features/claims/payable";
import { CoordinationIdSchema } from "@/features/partnerships/coordination-id-schema";

const money = z
  .string({ error: "entryAmountRequired" })
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, "entryAmountRequired");
const allocationMoney = z
  .string({ error: "allocationSharesInvalid" })
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, "allocationSharesInvalid");
const percentage = z
  .string({ error: "allocationSharesInvalid" })
  .regex(/^\d{1,3}(?:\.\d{1,6})?$/, "allocationSharesInvalid");
const allocationInput = z.object({
  projectParticipantId: CoordinationIdSchema,
  percentage: percentage.optional(),
  amountEur: allocationMoney.optional(),
});

export const CostSaveInputSchema = z
  .object({
    partnershipId: CoordinationIdSchema,
    entryId: CoordinationIdSchema.optional(),
    transportProfile: z
      .string({ error: "transportProfileOutsideRules" })
      .min(1, "transportProfileOutsideRules"),
    amountEur: money,
    allocationMethod: z.enum(["equal", "percentage", "amount"]),
    allocations: z
      .array(allocationInput, { error: "allocationRequired" })
      .min(1, "allocationRequired"),
  })
  .superRefine((input, ctx) => {
    if (
      money.safeParse(input.amountEur).success &&
      decimalUnits(input.amountEur, 2) <= BigInt(0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["amountEur"],
        message: "entryAmountRequired",
      });
    if (
      !PARTICIPANT_TRANSPORT_EMISSION_PROFILES.some(
        (profile) => profile === input.transportProfile,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["transportProfile"],
        message: "transportProfileOutsideRules",
      });
    const seen = new Set<string>();
    let total = BigInt(0);
    input.allocations.forEach((allocation, index) => {
      if (seen.has(allocation.projectParticipantId))
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index, "projectParticipantId"],
          message: "allocationSharesInvalid",
        });
      seen.add(allocation.projectParticipantId);
      const share =
        input.allocationMethod === "percentage"
          ? allocation.percentage
          : allocation.amountEur;
      if (
        input.allocationMethod === "equal"
          ? allocation.percentage !== undefined ||
            allocation.amountEur !== undefined
          : !share ||
            (input.allocationMethod === "percentage"
              ? allocation.amountEur !== undefined
              : allocation.percentage !== undefined)
      )
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index],
          message: "allocationSharesInvalid",
        });
      if (
        share &&
        (input.allocationMethod === "percentage"
          ? percentage
          : allocationMoney
        ).safeParse(share).success &&
        decimalUnits(share, input.allocationMethod === "percentage" ? 6 : 2) <=
          BigInt(0)
      )
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index],
          message: "allocationSharesInvalid",
        });
      if (
        share &&
        (input.allocationMethod === "percentage"
          ? percentage
          : allocationMoney
        ).safeParse(share).success
      )
        total += decimalUnits(
          share,
          input.allocationMethod === "percentage" ? 6 : 2,
        );
    });
    if (input.allocationMethod !== "equal") {
      const expected =
        input.allocationMethod === "percentage"
          ? TOTAL_ALLOCATION_PERCENTAGE_UNITS
          : money.safeParse(input.amountEur).success
            ? decimalUnits(input.amountEur, 2)
            : BigInt(0);
      if (total !== expected)
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "allocationSharesInvalid",
        });
    }
  });
