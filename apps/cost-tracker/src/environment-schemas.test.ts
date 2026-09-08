import { describe, expect, it } from "vitest";

import {
  CostTrackerClientEnvironmentSchema,
  CostTrackerServerEnvironmentSchema,
} from "@/environment-schemas";

const validServerEnvironment = {
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/greendex",
  BETTER_AUTH_SECRET: "a-secure-secret-with-at-least-32-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_SENDER: "cost-tracker@example.com",
  SMTP_USERNAME: "mailer",
  SMTP_PASSWORD: "mailer-password",
  SMTP_SECURE: "false",
};

describe("Cost Tracker environment", () => {
  it("parses the complete server and public application configuration", () => {
    expect(
      CostTrackerServerEnvironmentSchema.parse(validServerEnvironment),
    ).toEqual({
      ...validServerEnvironment,
      SMTP_PORT: 587,
      SMTP_SECURE: false,
    });
    expect(
      CostTrackerClientEnvironmentSchema.parse({
        NEXT_PUBLIC_BASE_URL: "https://costs.greendex.example",
      }),
    ).toEqual({ NEXT_PUBLIC_BASE_URL: "https://costs.greendex.example" });
  });

  it.each([
    ["BETTER_AUTH_SECRET", "short"],
    ["GOOGLE_CLIENT_ID", ""],
    ["GOOGLE_CLIENT_SECRET", ""],
    ["SMTP_HOST", ""],
    ["SMTP_PORT", "0"],
    ["SMTP_SENDER", "not-an-email"],
    ["SMTP_USERNAME", ""],
    ["SMTP_PASSWORD", ""],
    ["SMTP_SECURE", "sometimes"],
  ])("rejects invalid %s configuration", (key, value) => {
    expect(
      CostTrackerServerEnvironmentSchema.safeParse({
        ...validServerEnvironment,
        [key]: value,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-URL public application origin", () => {
    expect(
      CostTrackerClientEnvironmentSchema.safeParse({
        NEXT_PUBLIC_BASE_URL: "cost-tracker",
      }).success,
    ).toBe(false);
  });
});
