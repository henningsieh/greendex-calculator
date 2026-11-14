import { createTranslator } from "@greendex/i18n/client";
import { describe, expect, it } from "vitest";

import {
  createCredentialsSchema,
  createForgotPasswordSchema,
  createMagicLinkSchema,
  createResetPasswordSchema,
  createSignupSchema,
} from "@/features/authentication/validation-schemas";
import de from "@/messages/de.json";
import en from "@/messages/en-GB.json";

const key = (value: string) => value;

describe("authentication validation factories", () => {
  it.each([createMagicLinkSchema, createForgotPasswordSchema])(
    "validates email without transforming it",
    (create) => {
      expect(create(key).parse({ email: "User@example.com" })).toEqual({
        email: "User@example.com",
      });
      expect(create(key).safeParse({ email: " User@example.com " }).success).toBe(
        false,
      );
      expect(
        create(key)
          .safeParse({ email: "" })
          .error?.issues.map(({ path, message }) => [path, message]),
      ).toEqual([[["email"], "validation.emailInvalid"]]);
    },
  );

  it("preserves credentials error keys and the six character boundary", () => {
    const schema = createCredentialsSchema(key);
    expect(
      schema
        .safeParse({ email: "", password: "12345" })
        .error?.issues.map(({ path, message }) => [path, message]),
    ).toEqual([
      [["email"], "validation.emailInvalid"],
      [["password"], "validation.passwordRequired"],
    ]);
    expect(
      schema.parse({ email: "User@example.com", password: " 12345" }),
    ).toEqual({ email: "User@example.com", password: " 12345" });
    expect(
      schema.safeParse({ email: " User@example.com", password: "123456" })
        .success,
    ).toBe(false);
  });

  it("preserves signup field and refinement issue order", () => {
    const schema = createSignupSchema(key);
    expect(
      schema
        .safeParse({
          name: "",
          email: "",
          password: "12345",
          confirmPassword: "",
        })
        .error?.issues.map(({ path, message }) => [path, message]),
    ).toEqual([
      [["name"], "validation.fullNameRequired"],
      [["email"], "validation.emailInvalid"],
      [["password"], "validation.passwordMinLength"],
      [["confirmPassword"], "validation.passwordConfirmRequired"],
      [["confirmPassword"], "validation.passwordsNoMatch"],
    ]);
    const data = {
      name: " ",
      email: "User@example.com",
      password: " 12345",
      confirmPassword: " 12345",
    };
    expect(schema.parse(data)).toEqual(data);
  });

  it("preserves reset refinement issue order and the six character boundary", () => {
    const schema = createResetPasswordSchema(key);
    expect(
      schema
        .safeParse({ password: "12345", confirmPassword: "" })
        .error?.issues.map(({ path, message }) => [path, message]),
    ).toEqual([
      [["password"], "validation.passwordMinLength"],
      [["confirmPassword"], "validation.passwordConfirmRequired"],
      [["confirmPassword"], "validation.passwordsNoMatch"],
    ]);
    expect(
      schema.parse({ password: "123456", confirmPassword: "123456" }),
    ).toEqual({ password: "123456", confirmPassword: "123456" });
  });

  it("does not report a mismatch when both passwords are empty", () => {
    expect(
      createResetPasswordSchema(key)
        .safeParse({ password: "", confirmPassword: "" })
        .error?.issues.map(({ path, message }) => [path, message]),
    ).toEqual([
      [["password"], "validation.passwordMinLength"],
      [["confirmPassword"], "validation.passwordConfirmRequired"],
    ]);
  });

  it("uses fresh English and German translators", () => {
    const english = createCredentialsSchema(
      createTranslator({
        locale: "en-GB",
        messages: en,
        namespace: "authentication",
      }),
    );
    const german = createCredentialsSchema(
      createTranslator({
        locale: "de",
        messages: de,
        namespace: "authentication",
      }),
    );
    const input = { email: "", password: "" };
    expect(
      english.safeParse(input).error?.issues.map((issue) => issue.message),
    ).toEqual([
      en.authentication.validation.emailInvalid,
      en.authentication.validation.passwordRequired,
    ]);
    expect(
      german.safeParse(input).error?.issues.map((issue) => issue.message),
    ).toEqual([
      de.authentication.validation.emailInvalid,
      de.authentication.validation.passwordRequired,
    ]);
  });
});
