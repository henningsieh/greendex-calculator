import { describe, expect, it } from "vitest";

import { EditNameSchema } from "@/features/user-settings/validation-schemas";

describe("EditNameSchema", () => {
  it("accepts and trims a valid name", () => {
    expect(EditNameSchema.parse({ name: "  Alex Morgan  " })).toEqual({
      name: "Alex Morgan",
    });
  });

  it.each(["", " ", "A"])("rejects the short name %j", (name) => {
    const result = EditNameSchema.safeParse({ name });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Enter at least 2 characters.",
      );
    }
  });

  it("accepts a name at the maximum length", () => {
    expect(EditNameSchema.safeParse({ name: "A".repeat(80) }).success).toBe(true);
  });

  it("rejects a name beyond the maximum length", () => {
    const result = EditNameSchema.safeParse({ name: "A".repeat(81) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Enter no more than 80 characters.",
      );
    }
  });

  it("requires the name field", () => {
    expect(EditNameSchema.safeParse({}).success).toBe(false);
  });
});
