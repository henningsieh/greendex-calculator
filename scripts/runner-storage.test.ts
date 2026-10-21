import { describe, expect, it } from "vitest";

import { validatedDevelopmentGarageEnvironment } from "../apps/cost-tracker/scripts/garage-verification";
import {
  fullProductionGroups,
  type ProductionOperations,
} from "./full-production-groups";
import { runTestGroups, type TestGroup } from "./nonbrowser-test-groups";

const safe = {
  S3_ENDPOINT: "http://127.0.0.1:3900",
  S3_REGION: "garage",
  S3_BUCKET: "greendex-cost-tracker-development",
  S3_ACCESS_KEY_ID: "fixture-key",
  S3_SECRET_ACCESS_KEY: "fixture-secret",
  S3_FORCE_PATH_STYLE: "true",
};

describe("runner storage prerequisite", () => {
  it.each([
    { S3_BUCKET: "staging" },
    { S3_BUCKET: "production" },
    { S3_ENDPOINT: "https://staging.example.test" },
    { S3_ENDPOINT: "https://production.example.test" },
    { S3_SECRET_ACCESS_KEY: "" },
  ])(
    "blocks storage consumers while independent groups continue %#",
    async (unsafe) => {
      const events: string[] = [];
      const group = (name: string, prerequisites: string[] = []): TestGroup => ({
        name,
        prerequisites,
        execution: "serial",
        run: async () => {
          events.push(name);
        },
      });
      const groups: TestGroup[] = [
        group("calculator/pure"),
        group("cost-tracker/pure"),
        group("database/seed"),
        {
          ...group("storage/target"),
          run: async () => {
            validatedDevelopmentGarageEnvironment({ ...safe, ...unsafe }, {});
          },
        },
        group("managed-servers", ["database/seed", "storage/target"]),
        group("calculator/live", ["managed-servers"]),
        group("cost-tracker/live", ["managed-servers", "storage/target"]),
        group("live-mail", ["managed-servers"]),
        group("development-garage", ["storage/target"]),
      ];
      const operations: ProductionOperations = {
        create: async () => {
          events.push("create");
        },
        start: async (target) => {
          events.push(`start/${target}`);
        },
        pair: async () => {
          events.push("pair");
        },
        browser: async (suite) => {
          events.push(`browser/${suite.name}`);
        },
        releaseOrdinary: async () => {
          events.push("release");
        },
      };
      const results = await runTestGroups(
        fullProductionGroups(groups, operations),
      );
      expect(
        results
          .filter(({ status }) => status === "blocked")
          .map(({ group }) => group),
      ).toEqual([
        "production/cost-tracker",
        "managed-servers",
        "cost-tracker/live",
        "live-mail",
        "development-garage",
        "browser/cost-tracker",
        "browser/merge",
      ]);
      expect(events).toEqual([
        "calculator/pure",
        "cost-tracker/pure",
        "database/seed",
        "create",
        "start/calculator",
        "calculator/live",
        "browser/calculator",
        "release",
        "start/calculator-instant",
        "browser/instant",
      ]);
      expect(
        results.find(({ group }) => group === "storage/target")?.status,
      ).toBe("failed");
    },
  );

  it("validates the lifecycle's effective local-over-injected target and serializes it for every consumer", () => {
    const validated = validatedDevelopmentGarageEnvironment(safe, {
      ...safe,
      S3_BUCKET: "production",
    });
    expect(validated).toEqual(safe);
    expect(validated.S3_FORCE_PATH_STYLE).toBe("true");
    expect(() =>
      validatedDevelopmentGarageEnvironment(
        { ...safe, S3_BUCKET: "production" },
        safe,
      ),
    ).toThrow("Refusing non-development Garage bucket");
    expect(() => validatedDevelopmentGarageEnvironment({}, {})).toThrow();
  });
});
