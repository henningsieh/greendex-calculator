import { describe, expect, it } from "vitest";

import {
  assertExistingHttpTarget,
  assertExistingIntegrationDatabase,
  existingIntegrationApp,
  nonbrowserTestNeedsServices,
  sharedDevelopmentDatabaseUrl,
} from "./existing-integration-environment";

const databaseUrl = sharedDevelopmentDatabaseUrl();

function mutatedDatabaseUrl(mutate: (url: URL) => void): string {
  const url = new URL(databaseUrl);
  mutate(url);
  return url.toString();
}

describe("test selection", () => {
  it.each([
    ["src/__tests__/db-connection.test.ts", "", true],
    ["src/__tests__/openapi-http.test.ts", "", true],
    ["src/__tests__/openapi-rest.test.ts", "", true],
    ["src/lib/proof-storage.test.ts", "", true],
    ["src/feature.test.ts", 'import { db } from "@greendex/database";', true],
    ["src/feature.test.ts", 'import { router } from "@/lib/orpc/router";', true],
    ["src/feature.test.ts", 'import { Pool } from "pg";', true],
    [
      "src/components/input.test.tsx",
      'import { render } from "@testing-library/react";',
      false,
    ],
  ])("classifies %s %#", (file, source, expected) => {
    expect(nonbrowserTestNeedsServices(file, source)).toBe(expected);
  });
});

describe("existing environment boundary", () => {
  it("accepts the shared development database and an existing loopback app without ownership markers", () => {
    expect(() =>
      assertExistingHttpTarget({
        DATABASE_URL: databaseUrl,
        COST_TRACKER_TEST_BASE_URL: "http://127.0.0.1:3002",
      }),
    ).not.toThrow();
    expect(
      existingIntegrationApp({ NEXT_PUBLIC_BASE_URL: "http://localhost:3000/" }),
    ).toEqual({
      baseUrl: "http://localhost:3000",
      environment: { NEXT_PUBLIC_BASE_URL: "http://localhost:3000/" },
    });
  });

  it.each([
    mutatedDatabaseUrl((url) => (url.port = "5432")),
    mutatedDatabaseUrl((url) => (url.hostname = "localhost")),
    mutatedDatabaseUrl((url) => (url.pathname = "/other_database")),
    `${databaseUrl}?host=other`,
    `${databaseUrl}?options=-csearch_path=other`,
    "not-a-url",
  ])(
    "rejects other database targets without exposing credentials %#",
    (value) => {
      expect(() => assertExistingIntegrationDatabase(value)).toThrow(
        /(?:shared Coolify|database configuration)/,
      );
    },
  );

  it.each([
    "https://example.org",
    "http://localhost:3002/path",
    "http://localhost:3002?target=other",
    "http://private:password@localhost:3002",
    "",
  ])("rejects non-loopback origins and embedded credentials %#", (baseUrl) => {
    expect(() =>
      existingIntegrationApp({ NEXT_PUBLIC_BASE_URL: baseUrl }),
    ).toThrow(/(?:loopback|application URL)/);
  });
});
