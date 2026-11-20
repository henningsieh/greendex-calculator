import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

interface FixtureResult {
  error?: Error;
  status: number | null;
  stdout: string;
  stderr: string;
}

function runFixture(
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
  },
): Promise<FixtureResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ error, status: null, stdout, stderr });
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

it.concurrent.each([
  ["unit", 0],
  ["unit", 1],
  ["integration", 0],
  ["integration", 1],
  ["e2e", 0],
  ["e2e", 1],
] as const)(
  "reports scoped %s results with subprocess exit %i",
  async (suite, exit) => {
    const root = await mkdtemp(resolve(tmpdir(), "greendex-app-tests-"));
    try {
      for (const directory of [
        "scripts",
        "bin",
        "packages/database",
        "apps/cost-tracker/src",
      ]) {
        await mkdir(resolve(root, directory), { recursive: true });
      }
      for (const file of ["test.ts", "existing-integration-environment.ts"]) {
        await cp(
          resolve(import.meta.dirname, file),
          resolve(root, "scripts", file),
        );
      }
      await writeFile(
        resolve(root, "packages/database/.env"),
        "DATABASE_URL=postgres://localhost/greendex_development\n",
      );
      await writeFile(
        resolve(root, "apps/cost-tracker/.env"),
        "NEXT_PUBLIC_BASE_URL=http://localhost:3002\n",
      );
      for (const file of ["pure.test.ts", "service.integration.test.ts"]) {
        await writeFile(resolve(root, "apps/cost-tracker/src", file), "");
      }
      await writeFile(
        resolve(root, "bin/pnpm"),
        "#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),reuse:process.env.GREENDEX_VITEST_REUSE_WORKERS}));process.exit(Number(process.env.FIXTURE_EXIT));\n",
        { mode: 0o755 },
      );
      await writeFile(
        resolve(root, "fetch.mjs"),
        'globalThis.fetch = async () => new Response("null");\n',
      );
      const result = await runFixture(
        [
          "--import",
          fileURLToPath(import.meta.resolve("tsx/esm")),
          "--import",
          resolve(root, "fetch.mjs"),
          resolve(root, "scripts/test.ts"),
          suite,
          "--app",
          "cost-tracker",
        ],
        {
          cwd: resolve(root, "apps/cost-tracker"),
          env: {
            ...process.env,
            PATH: `${resolve(root, "bin")}:${process.env.PATH}`,
            DATABASE_URL: "postgres://localhost/greendex_development",
            NEXT_PUBLIC_BASE_URL: "http://localhost:3002",
            GREENDEX_TEST_WORKERS: "2",
            GREENDEX_VITEST_REUSE_WORKERS: "0",
            FIXTURE_EXIT: String(exit),
          },
          timeout: 15_000,
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(exit);
      const invocation = result.stdout
        .split("\n")
        .find((line) => line.startsWith('{"args":'));
      expect(invocation).toBeDefined();
      expect(JSON.parse(invocation!)).toEqual({
        cwd: resolve(root, "apps/cost-tracker"),
        reuse: suite === "unit" ? "1" : "0",
        args:
          suite === "e2e"
            ? [
                "exec",
                "playwright",
                "test",
                "--config=playwright.config.ts",
                "--workers=1",
              ]
            : [
                "exec",
                "vitest",
                "run",
                suite === "integration" ? "--maxWorkers=1" : "--maxWorkers=2",
                "--no-color",
                "--retry=0",
                ...(suite === "integration"
                  ? ["--no-file-parallelism", "--isolate", "--pool=forks"]
                  : ["--pool=threads", "--file-parallelism=true"]),
                suite === "integration"
                  ? "src/service.integration.test.ts"
                  : "src/pure.test.ts",
              ],
      });
      expect(result.stdout).toMatch(
        new RegExp(
          `${suite} exit ${exit}\\n${suite} ${exit ? "FAILED" : "PASSED"} \\(\\d+\\.\\ds\\)\\ncandidate commit .* branch .* tree .*\\noverall exit ${exit}\\n$`,
        ),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
