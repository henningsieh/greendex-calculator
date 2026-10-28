import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const databaseEnvPath = resolve(process.cwd(), "../../packages/database/.env");
if (existsSync(databaseEnvPath)) loadEnvFile(databaseEnvPath);

const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

// The scripts/test.ts harness injects COST_TRACKER_TEST_BASE_URL. For direct
// vitest runs, fall back to this app's own loopback origin. Never overrides
// harness values, and the loopback + shared-database guards downstream still run.
process.env.COST_TRACKER_TEST_BASE_URL ??= process.env.NEXT_PUBLIC_BASE_URL;

export default function setup() {}
