import { describe, expect, it } from "vitest";

import {
  EditNameSchema,
  UserIdSchema,
} from "@/features/user-settings/validation-schemas";

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

describe("UserIdSchema", () => {
  it("trims identifiers before validating their length", () => {
    expect(UserIdSchema.parse("  id  ")).toBe("id");
    expect(UserIdSchema.parse("a".repeat(128))).toBe("a".repeat(128));
    expect(UserIdSchema.parse("  " + "a".repeat(128) + "  ")).toBe(
      "a".repeat(128),
    );
  });

  it.each(["", "   ", "a".repeat(129), "  " + "a".repeat(129) + "  "])(
    "rejects invalid identifier %s",
    (value) => {
      expect(UserIdSchema.safeParse(value).success).toBe(false);
    },
  );
});
