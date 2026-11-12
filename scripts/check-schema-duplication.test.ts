import { describe, expect, it } from "vitest";

import { findDuplicates } from "./schema-duplication";

const fileA = "apps/cost-tracker/src/features/a/validation-schemas.ts";
const fileB = "apps/cost-tracker/src/features/b/validation-schemas.ts";

function source(body: string) {
  return ['import { z } from "zod";', body].join("\n");
}

describe("findDuplicates", () => {
  it("reports one shape declared in two modules", () => {
    const groups = findDuplicates([
      {
        file: fileA,
        source: source(
          [
            "export const ClaimScopeInputSchema = z.object({",
            "  partnershipId: CoordinationIdSchema,",
            "  projectParticipantId: CoordinationIdSchema,",
            "});",
          ].join("\n"),
        ),
      },
      {
        file: fileB,
        source: source(
          [
            "export const JourneyInputSchema = z.object({",
            "  partnershipId: CoordinationIdSchema,",
            "  projectParticipantId: CoordinationIdSchema,",
            "});",
          ].join("\n"),
        ),
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keys).toEqual(["partnershipId", "projectParticipantId"]);
    expect(groups[0].entries.map((entry) => entry.schema)).toEqual([
      "ClaimScopeInputSchema",
      "JourneyInputSchema",
    ]);
  });

  it("ignores repeats inside one module", () => {
    const groups = findDuplicates([
      {
        file: fileA,
        source: source(
          [
            "export const FirstSchema = z.object({ id: z.string(), note: z.string() });",
            "export const SecondSchema = z.object({ id: z.string(), note: z.string() });",
          ].join("\n"),
        ),
      },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignores shapes whose values differ", () => {
    const groups = findDuplicates([
      {
        file: fileA,
        source: source(
          "export const A = z.object({ id: z.string(), note: z.string() });",
        ),
      },
      {
        file: fileB,
        source: source(
          "export const B = z.object({ id: z.string(), note: z.string().max(10) });",
        ),
      },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignores single-property literals", () => {
    const groups = findDuplicates([
      {
        file: fileA,
        source: source(
          "export const A = z.object({ partnershipId: CoordinationIdSchema });",
        ),
      },
      {
        file: fileB,
        source: source(
          "export const B = z.object({ partnershipId: CoordinationIdSchema });",
        ),
      },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("treats key order and formatting as the same shape", () => {
    const groups = findDuplicates([
      {
        file: fileA,
        source: source(
          "export const A = z.object({ id: z.string(), note: z.string() });",
        ),
      },
      {
        file: fileB,
        source: source(
          [
            "export const B = z.object({",
            "  note: z.string(),",
            "  id: z.string(),",
            "});",
          ].join("\n"),
        ),
      },
    ]);
    expect(groups).toHaveLength(1);
  });
});
