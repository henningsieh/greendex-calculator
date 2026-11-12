import { expect, it } from "vitest";

import {
  HostedProjectSearchInputSchema,
  ProjectDetailInputSchema,
} from "@/features/projects/validation-schemas";

it("pins hosted search normalization and limits", () => {
  for (const [input, output] of [
    ["", ""],
    ["  ", ""],
    [" ab ", "ab"],
    ["x".repeat(128), "x".repeat(128)],
  ]) {
    expect(
      HostedProjectSearchInputSchema.parse({ search: input, extra: 1 }),
    ).toEqual({ search: output });
  }
  for (const [input, message] of [
    [" x ", "Invalid input"],
    ["x".repeat(129), "Too big: expected string to have <=128 characters"],
  ]) {
    const result = HostedProjectSearchInputSchema.safeParse({ search: input });
    expect(
      result.success
        ? []
        : result.error.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([{ path: ["search"], message }]);
  }
});

it("preserves Project ID semantic messages and paths", () => {
  expect(
    ProjectDetailInputSchema.parse({ projectId: " x ", extra: true }),
  ).toEqual({ projectId: "x" });
  for (const [projectId, message] of [
    [" ", "projectIdRequired"],
    ["x".repeat(129), "projectIdTooLong"],
  ]) {
    const result = ProjectDetailInputSchema.safeParse({ projectId });
    expect(
      result.success
        ? []
        : result.error.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([{ path: ["projectId"], message }]);
  }
});
