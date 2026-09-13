import { projectPartnerOrganizationsTable } from "@greendex/database/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  AssignProjectPartnershipInputSchema,
  RemoveProjectPartnershipInputSchema,
} from "@/features/projects/validation-schemas";

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
      RemoveProjectPartnershipInputSchema.safeParse({ id: " ".repeat(129) })
        .success,
    ).toBe(false);
  });
});
