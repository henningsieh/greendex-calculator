import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

export const integrationApps = ["calculator", "cost-tracker"] as const;
export type IntegrationApp = (typeof integrationApps)[number];

export interface ExistingIntegrationApp {
  baseUrl: string;
  environment: Record<string, string>;
}

export interface ExistingIntegrationSeed {
  organizationId: string;
  secondPartnerOrganizationId: string;
}

export interface ExistingIntegrationContext {
  kind: "existing-environment";
  correlationId: string;
  databaseUrl: string;
  apps: Partial<Record<IntegrationApp, ExistingIntegrationApp>>;
  seed: ExistingIntegrationSeed;
}

export function sharedDevelopmentDatabaseUrl(): string {
  for (const path of [
    resolve(process.cwd(), "packages/database/.env"),
    resolve(process.cwd(), "../../packages/database/.env"),
  ]) {
    if (!existsSync(path)) continue;
    const value = parseEnv(readFileSync(path, "utf8")).DATABASE_URL;
    if (value) return value;
  }
  throw new Error("Missing shared development database configuration.");
}

export function assertExistingIntegrationDatabase(databaseUrl: string): void {
  const expected = new URL(sharedDevelopmentDatabaseUrl());
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Missing or invalid shared development database configuration.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.hostname !== expected.hostname ||
    target.port !== expected.port ||
    target.pathname !== expected.pathname ||
    target.hash ||
    [...target.searchParams.keys()].some((key) => key !== "sslmode")
  )
    throw new Error("Only the shared Coolify development database is permitted.");
}

export function existingIntegrationApp(
  environment: Record<string, string>,
): ExistingIntegrationApp {
  let target: URL;
  try {
    target = new URL(environment.NEXT_PUBLIC_BASE_URL);
  } catch {
    throw new Error("Missing or invalid existing application URL.");
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  )
    throw new Error("Existing application checks require a loopback origin.");
  return { baseUrl: target.origin, environment };
}

export function nonbrowserTestNeedsServices(
  file: string,
  source: string,
): boolean {
  return (
    /\.integration\.|openapi-(?:http|rest)|db-connection|(?:^|\/)proof-storage\.test\./.test(
      file,
    ) ||
    /@greendex\/database|from ["']pg["']|from ["'][^"']*(?:router|procedures|http-client)[^"']*["']/.test(
      source,
    )
  );
}

export function assertExistingHttpTarget(
  environment: Record<string, string | undefined>,
): void {
  assertExistingIntegrationDatabase(environment.DATABASE_URL ?? "");
  existingIntegrationApp({
    NEXT_PUBLIC_BASE_URL: environment.COST_TRACKER_TEST_BASE_URL ?? "",
  });
}
