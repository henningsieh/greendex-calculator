import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

// Load environment variables from monorepo root BEFORE any tests run
// Calculator owns the environment used by its test suite.
const databaseEnvPath = resolve(process.cwd(), "../../packages/database/.env");
if (existsSync(databaseEnvPath)) loadEnvFile(databaseEnvPath);

const envPath = resolve(process.cwd(), ".env");

if (!existsSync(envPath)) {
  console.error(`❌ .env file not found at: ${envPath}`);
  process.exit(1);
}

loadEnvFile(envPath);

console.log(`✅ Loaded environment variables from: ${envPath}`);

export default function setup() {
  // Global setup function - runs before all tests
}
