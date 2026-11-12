import { describe, expect, it } from "vitest";

import type { TableIndex } from "./schema-derivation";
import { scanTypes } from "./schema-types";

const tables: TableIndex = new Map([
  [
    "projectsTable",
    new Set([
      "id",
      "name",
      "location",
      "archived",
      "startDate",
      "endDate",
      "costSubmissionWindowOpen",
    ]),
  ],
  [
    "projectFundingBandsTable",
    new Set(["minKm", "maxKm", "standardEur", "greenEur"]),
  ],
]);

const file = "apps/cost-tracker/src/features/projects/types.ts";

function scan(source: string) {
  return scanTypes(file, source, tables);
}

describe("scanTypes", () => {
  it("reports a type alias that restates table columns", () => {
    const violations = scan(
      [
        "export type ProjectRow = {",
        "  id: string;",
        "  name: string;",
        "  location: string;",
        "};",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      name: "ProjectRow",
      tables: ["projectsTable"],
      attributes: ["id", "location", "name"],
      line: 1,
    });
  });

  it("reports an interface without extends", () => {
    const violations = scan(
      [
        "export interface Band {",
        "  minKm: number;",
        "  maxKm: number;",
        "  standardEur: string;",
        "  greenEur: string;",
        "}",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].tables).toEqual(["projectFundingBandsTable"]);
  });

  it("accepts typeof table.$inferSelect", () => {
    const violations = scan(
      "export type ProjectRow = typeof projectsTable.$inferSelect;",
    );
    expect(violations).toHaveLength(0);
  });

  it("accepts Pick and inference helpers", () => {
    const violations = scan(
      [
        'export type ProjectRow = Pick<typeof projectsTable.$inferSelect, "id" | "name" | "location">;',
        "export type ProjectEntity = InferSelectModel<typeof projectsTable>;",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("accepts interfaces that extend another type", () => {
    const violations = scan(
      [
        "export interface ProjectRow extends ProjectBase {",
        "  id: string;",
        "  name: string;",
        "  location: string;",
        "}",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores types below the overlap threshold", () => {
    const violations = scan(
      ["export type Ref = {", "  id: string;", "  name: string;", "};"].join(
        "\n",
      ),
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores types that match no table", () => {
    const violations = scan(
      [
        "export type Feedback = {",
        "  title: string;",
        "  body: string;",
        "  severity: string;",
        "};",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });
});
