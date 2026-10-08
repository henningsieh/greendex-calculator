import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const databaseEnvPath = resolve(process.cwd(), "../../packages/database/.env");
if (existsSync(databaseEnvPath)) loadEnvFile(databaseEnvPath);

const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

export default function setup() {}
