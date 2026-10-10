import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

// Tooling and both applications share one local database configuration.
// Platform-injected DATABASE_URL takes precedence over the local file.
const envPath = ".env";
if (existsSync(envPath)) loadEnvFile(envPath);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
