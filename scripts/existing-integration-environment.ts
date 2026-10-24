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

export function assertExistingIntegrationDatabase(databaseUrl: string): void {
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
    target.hostname !== "188.245.144.137" ||
    target.port !== "5489" ||
    target.pathname !== "/greendex_development" ||
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
