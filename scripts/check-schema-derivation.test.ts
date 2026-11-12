import { describe, expect, it } from "vitest";

import { type TableIndex, scanSource } from "./schema-derivation";

const tables: TableIndex = new Map([
  [
    "claimsTable",
    new Set([
      "id",
      "partnershipId",
      "status",
      "approvedAmountEur",
      "createdAt",
      "updatedAt",
    ]),
  ],
  [
    "projectsTable",
    new Set(["id", "name", "location", "archived", "startDate", "endDate"]),
  ],
  ["payoutAccountsTable", new Set(["id", "organizationId", "updatedAt", "iban"])],
  [
    "projectPartnerOrganizationsTable",
    new Set(["id", "organizationId", "projectId", "createdAt", "updatedAt"]),
  ],
  [
    "partnerAssignmentsTable",
    new Set(["id", "organizationId", "updatedAt", "actorUserId"]),
  ],
]);

const file = "apps/example/src/features/example/validation-schemas.ts";

function scan(source: string) {
  return scanSource(file, source, tables);
}

describe("scanSource", () => {
  it("reports a literal that retypes table columns", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const ClaimDraftSchema = z.object({",
        "  id: z.string(),",
        "  partnershipId: z.string(),",
        '  status: z.enum(["editable", "correction_requested"]),',
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      schema: "ClaimDraftSchema",
      tables: ["claimsTable"],
      attributes: ["id", "partnershipId", "status"],
      line: 2,
    });
  });

  it("accepts a literal whose attributes derive from the table", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const ProjectRowSchema = z.object({",
        "  id: projectsTable.shape.id,",
        "  name: persistedSelectSchema.shape.name,",
        "  location: persistedSelectSchema.shape.location,",
        "  archived: persistedSelectSchema.shape.archived,",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("reports only the hand-typed attributes of a mixed literal", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const ProjectRowSchema = z.object({",
        "  id: projectsTable.shape.id,",
        "  name: z.string(),",
        "  location: z.string(),",
        "  archived: z.boolean(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].attributes).toEqual(["archived", "location", "name"]);
  });

  it("accepts shared schema references and derived chains", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const PartnershipSchema = z.object({",
        "  id: PartnershipIdSchema,",
        "  projectId: ProjectIdSchema,",
        "  organizationId: createSelectSchema(organization).shape.id,",
        "  updatedAt: persistedSelectSchema.shape.updatedAt.nullable(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("accepts enum options taken from the derived column", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const DraftSchema = z.object({",
        "  id: claimsTable.shape.id,",
        "  partnershipId: claimsTable.shape.partnershipId,",
        '  status: z.enum(claimsTable.shape.status.options, { error: "draftStatus" }),',
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("accepts a pipe that validates through the derived column", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const JourneySchema = z.object({",
        '  origin: z.string({ error: "origin" }).pipe(',
        '    journeysTable.shape.origin.trim().min(1, "origin"),',
        "  ),",
        "  destination: journeysTable.shape.destination,",
        '  tripType: z.enum(journeysTable.shape.tripType.options, { error: "trip" }),',
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("reports a union mixing a hand-written and a derived branch", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const DraftSchema = z.object({",
        "  id: claimsTable.shape.id,",
        "  partnershipId: claimsTable.shape.partnershipId,",
        "  status: z.string().or(claimsTable.shape.status),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].attributes).toEqual(["status"]);
  });

  it("accepts a union whose branches all derive", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const DraftSchema = z.object({",
        "  id: claimsTable.shape.id,",
        "  partnershipId: claimsTable.shape.partnershipId,",
        "  status: claimsTable.shape.status",
        "    .or(claimsTable.shape.status)",
        "    .or(claimsTable.shape.status),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("still reports a hand-written enum list", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const DraftSchema = z.object({",
        "  id: claimsTable.shape.id,",
        "  partnershipId: claimsTable.shape.partnershipId,",
        '  status: z.enum(["editable", "correction_requested"]),',
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].attributes).toEqual(["status"]);
  });

  it("ignores literals below the overlap threshold", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const RefSchema = z.object({",
        "  id: z.string(),",
        "  name: z.string(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores literals that match no table", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const FeedbackSchema = z.object({",
        "  title: z.string(),",
        "  body: z.string(),",
        '  severity: z.enum(["info", "error"]),',
        "  dismissible: z.boolean(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("ignores extension patches on an existing schema", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const DetailSchema = BaseSchema.extend({",
        "  id: z.string(),",
        "  name: z.string(),",
        "  location: z.string(),",
        "  archived: z.boolean(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("recognizes a namespaced import of another zod module", () => {
    const violations = scan(
      [
        'import * as zod from "zod/v4";',
        "export const ClaimDraftSchema = zod.object({",
        "  id: zod.string(),",
        "  partnershipId: zod.string(),",
        "  status: zod.string(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].attributes).toEqual(["id", "partnershipId", "status"]);
  });

  it("ignores files that do not import zod", () => {
    const violations = scan(
      [
        'declare const z: typeof import("zod").z;',
        "export const ClaimDraftSchema = z.object({",
        "  id: z.string(),",
        "  partnershipId: z.string(),",
        "  status: z.string(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(0);
  });

  it("prefers the table the literal covers most tightly", () => {
    const violations = scan(
      [
        'import { z } from "zod";',
        "export const SummarySchema = z.object({",
        "  id: z.string(),",
        "  organizationId: z.string(),",
        "  updatedAt: z.date(),",
        "  organizationName: z.string(),",
        "});",
      ].join("\n"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].tables).toEqual([
      "payoutAccountsTable",
      "partnerAssignmentsTable",
    ]);
  });
});
