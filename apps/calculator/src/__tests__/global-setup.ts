import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { assertLocalTestUrls } from "../../scripts/assert-local-test-url";

// Load environment variables from monorepo root BEFORE any tests run
// Calculator owns the environment used by its test suite.
const envPath = resolve(process.cwd(), ".env");

if (!existsSync(envPath)) {
  console.error(`❌ .env file not found at: ${envPath}`);
  process.exit(1);
}

config({ path: envPath });

console.log(`✅ Loaded environment variables from: ${envPath}`);

// Fail fast when the loaded env points tests at a non-local server
// (e.g. a production URL copied over from Coolify).
assertLocalTestUrls();
console.log(`✅ Test URLs are local — production is out of reach.`);

export default function setup() {
  // Global setup function - runs before all tests
}
