import { projectPartnerOrganizationsTable } from "@greendex/database/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  AssignProjectPartnershipInputSchema,
  CoordinationIdSchema,
  CreateSetupLinkInputSchema,
  SetupLinkEmailSchema,
  RemoveProjectPartnershipInputSchema,
} from "@/features/partnerships/validation-schemas";
import { ProjectDetailInputSchema } from "@/features/projects/validation-schemas";

type ProjectPartnershipInsert =
  typeof projectPartnerOrganizationsTable.$inferInsert;
type ProjectPartnershipSelect =
  typeof projectPartnerOrganizationsTable.$inferSelect;
type AssignProjectPartnershipInput = z.infer<
  typeof AssignProjectPartnershipInputSchema
>;
type RemoveProjectPartnershipInput = z.infer<
  typeof RemoveProjectPartnershipInputSchema
>;

describe("Project Partnership persisted form schemas", () => {
  it("validates shared coordination IDs and setup-link emails without trimming emails", () => {
    expect(CoordinationIdSchema.parse("  id  ")).toBe("id");
    expect(CoordinationIdSchema.safeParse(" ").success).toBe(false);
    expect(CoordinationIdSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(SetupLinkEmailSchema.parse("User@Example.com")).toBe(
      "user@example.com",
    );
    expect(SetupLinkEmailSchema.safeParse(" User@Example.com ").success).toBe(
      false,
    );
  });

  it.each([
    [{ projectId: "project", recipientEmail: "" }, "emailRequired"],
    [{ projectId: "project", recipientEmail: "bad" }, "emailInvalid"],
    [{ projectId: "  ", recipientEmail: "a@b.com" }, "projectIdRequired"],
    [
      { projectId: "x".repeat(129), recipientEmail: "a@b.com" },
      "projectIdTooLong",
    ],
  ])("emits semantic validation IDs", (input, id) => {
    const result = CreateSetupLinkInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(id);
  });

  it.each([
    ["project-1", "project-1"],
    ["  clh3am3gl0000qzrmn831i7rn  ", "clh3am3gl0000qzrmn831i7rn"],
    ["  " + "a".repeat(128) + "  ", "a".repeat(128)],
  ])("normalizes Project IDs across inputs", (projectId, expected) => {
    expect(ProjectDetailInputSchema.parse({ projectId }).projectId).toBe(
      expected,
    );
    expect(
      AssignProjectPartnershipInputSchema.parse({
        projectId,
        organizationId: "org",
      }).projectId,
    ).toBe(expected);
    expect(
      CreateSetupLinkInputSchema.parse({
        projectId,
        recipientEmail: "User@Example.com",
      }),
    ).toEqual({ projectId: expected, recipientEmail: "user@example.com" });
  });

  it.each([
    undefined,
    12,
    "",
    "   ",
    "a".repeat(129),
    "  " + "a".repeat(129) + "  ",
  ])("rejects invalid Project IDs across inputs", (projectId) => {
    expect(ProjectDetailInputSchema.safeParse({ projectId }).success).toBe(false);
    expect(
      AssignProjectPartnershipInputSchema.safeParse({
        projectId,
        organizationId: "org",
      }).success,
    ).toBe(false);
    expect(
      CreateSetupLinkInputSchema.safeParse({
        projectId,
        recipientEmail: "user@example.com",
      }).success,
    ).toBe(false);
  });

  it.each(["invalid", " user@example.com "])(
    "rejects invalid setup-link email",
    (recipientEmail) => {
      expect(
        CreateSetupLinkInputSchema.safeParse({
          projectId: "project-1",
          recipientEmail,
        }).success,
      ).toBe(false);
    },
  );

  it("keeps assignment aligned with the Project Partnership table insert fields", () => {
    expectTypeOf<AssignProjectPartnershipInput>().toEqualTypeOf<
      Pick<ProjectPartnershipInsert, "projectId" | "organizationId">
    >();

    expect(
      AssignProjectPartnershipInputSchema.parse({
        projectId: " project-id ",
        organizationId: " organization-id ",
        id: "server-generated-id",
        createdAt: new Date(),
      }),
    ).toEqual({
      projectId: "project-id",
      organizationId: "organization-id",
    });
  });

  it("keeps removal aligned with the persisted Project Partnership ID", () => {
    expectTypeOf<RemoveProjectPartnershipInput>().toEqualTypeOf<
      Pick<ProjectPartnershipSelect, "id">
    >();

    expect(
      RemoveProjectPartnershipInputSchema.parse({ id: " partnership-id " }),
    ).toEqual({
      id: "partnership-id",
    });
    expect(
      RemoveProjectPartnershipInputSchema.safeParse({ id: "a".repeat(129) })
        .success,
    ).toBe(false);
  });
});
