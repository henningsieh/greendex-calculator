import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

// Database tooling uses the consuming Calculator application's environment.
const envPath = "../../apps/calculator/.env";
if (existsSync(envPath)) loadEnvFile(envPath);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
