import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ListProjectsInputSchema,
  ProjectIdInputSchema,
  UpdateProjectInputSchema,
  ArchiveProjectInputSchema,
  SetActiveProjectInputSchema,
  ProjectParticipantsInputSchema,
  BatchDeleteProjectsInputSchema,
} from "@/features/projects/validation-schemas";

describe("project procedure inputs", () => {
  it("preserves list optionality, default, stripping and errors", () => {
    expect(ListProjectsInputSchema.parse(undefined)).toBeUndefined();
    expect(ListProjectsInputSchema.parse({})).toEqual({ sort_by: "startDate" });
    expect(ListProjectsInputSchema.parse({ archived: false, extra: 1 })).toEqual({
      sort_by: "startDate",
      archived: false,
    });
    expect(
      ListProjectsInputSchema.safeParse(null).error?.issues.map(
        ({ path, message }) => ({ path, message }),
      ),
    ).toEqual([
      { path: [], message: "Invalid input: expected object, received null" },
    ]);
    expect(
      ListProjectsInputSchema.safeParse({ sort_by: "bad" }).error?.issues[0]
        ?.path,
    ).toEqual(["sort_by"]);
  });
  it("keeps described IDs required and accepts empty strings", () => {
    expect(ProjectIdInputSchema.parse({ id: "", extra: 1 })).toEqual({ id: "" });
    expect(ProjectIdInputSchema.shape.id.description).toBe("Project ID");
    expect(
      ProjectIdInputSchema.safeParse({}).error?.issues.map(
        ({ path, message }) => ({ path, message }),
      ),
    ).toEqual([
      {
        path: ["id"],
        message: "Invalid input: expected string, received undefined",
      },
    ]);
    expect(
      ProjectIdInputSchema.safeParse({ id: null }).error?.issues[0]?.message,
    ).toBe("Invalid input: expected string, received null");
  });
  it("keeps update data required and its existing custom errors", () => {
    expect(
      UpdateProjectInputSchema.safeParse({ id: "" }).error?.issues[0]?.path,
    ).toEqual(["data"]);
    expect(
      UpdateProjectInputSchema.parse({
        id: "",
        data: {
          name: "ok",
          startDate: new Date(0),
          endDate: new Date(0),
          archived: true,
        },
      }),
    ).toEqual({
      id: "",
      data: { name: "ok", startDate: new Date(0), endDate: new Date(0) },
    });
    expect(
      UpdateProjectInputSchema.safeParse({
        id: "x",
        data: { name: "", startDate: null, endDate: null, country: "XX" },
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      { path: ["data", "name"], message: "Name is required" },
      {
        path: ["data", "startDate"],
        message: "Please select a valid start date",
      },
      { path: ["data", "endDate"], message: "Please select a valid end date" },
      { path: ["data", "country"], message: "Please select a valid EU country" },
    ]);
  });
  it("exposes descriptions in the JSON schema used for API documentation", () => {
    expect(z.toJSONSchema(ArchiveProjectInputSchema).properties).toEqual({
      id: { type: "string", description: "Project ID" },
      archived: { type: "boolean", description: "Archive status" },
    });
    expect(z.toJSONSchema(ProjectParticipantsInputSchema).properties).toEqual({
      projectId: { type: "string", description: "Project ID" },
    });
    expect(z.toJSONSchema(SetActiveProjectInputSchema).properties).toEqual({
      projectId: { type: "string" },
    });
  });
  it("requires archive status and preserves descriptions", () => {
    expect(
      ArchiveProjectInputSchema.parse({ id: "", archived: false, extra: 1 }),
    ).toEqual({ id: "", archived: false });
    expect(ArchiveProjectInputSchema.shape.archived.description).toBe(
      "Archive status",
    );
    expect(
      ArchiveProjectInputSchema.safeParse({ id: "x" }).error?.issues[0]?.message,
    ).toBe("Invalid input: expected boolean, received undefined");
    expect(
      ArchiveProjectInputSchema.safeParse({ id: "x", archived: null }).success,
    ).toBe(false);
  });
  it("distinguishes an optional active ID from the required object", () => {
    expect(SetActiveProjectInputSchema.parse({ extra: true })).toEqual({});
    expect(SetActiveProjectInputSchema.parse({ projectId: "" })).toEqual({
      projectId: "",
    });
    expect(SetActiveProjectInputSchema.safeParse(undefined).success).toBe(false);
    expect(
      SetActiveProjectInputSchema.safeParse({ projectId: null }).success,
    ).toBe(false);
  });
  it("requires a described participant project ID", () => {
    expect(
      ProjectParticipantsInputSchema.parse({ projectId: "", extra: true }),
    ).toEqual({ projectId: "" });
    expect(ProjectParticipantsInputSchema.shape.projectId.description).toBe(
      "Project ID",
    );
    expect(
      ProjectParticipantsInputSchema.safeParse({}).error?.issues[0]?.path,
    ).toEqual(["projectId"]);
    expect(
      ProjectParticipantsInputSchema.safeParse({ projectId: null }).success,
    ).toBe(false);
  });
  it("requires at least one batch ID but accepts an empty ID", () => {
    expect(
      BatchDeleteProjectsInputSchema.parse({ projectIds: [""], extra: true }),
    ).toEqual({ projectIds: [""] });
    expect(
      BatchDeleteProjectsInputSchema.safeParse({
        projectIds: [],
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["projectIds"],
        message: "Too small: expected array to have >=1 items",
      },
    ]);
    expect(BatchDeleteProjectsInputSchema.safeParse({}).success).toBe(false);
    expect(
      BatchDeleteProjectsInputSchema.safeParse({ projectIds: null }).success,
    ).toBe(false);
  });
});
