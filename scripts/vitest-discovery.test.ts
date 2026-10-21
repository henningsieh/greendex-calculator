import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";

import { expect, it } from "vitest";
import { createVitest, type Vitest } from "vitest/node";

it("discovers repository tests once and excludes managed images and vendor copies", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "greendex-discovery-"));
  const files = [
    "scripts/example.test.ts",
    ".turbo/test-runs/run/snapshot/scripts/example.test.ts",
    ".turbo/test-runs/run/calculator/apps/calculator/src/example.test.ts",
    ".turbo/managed-app-runs/77cf527965d2471ea71428a44ef67a42-YaJApf/source/scripts/seed-tables.test.ts",
    "apps/cost-tracker/.turbo/run/src/example.test.ts",
    "node_modules/vendor/example.test.ts",
  ];
  let runner: Vitest | undefined;
  try {
    for (const file of files) {
      await mkdir(dirname(resolve(root, file)), { recursive: true });
      await writeFile(resolve(root, file), "");
    }
    runner = await createVitest({
      root,
      config: resolve(import.meta.dirname, "../vitest.config.mts"),
      watch: false,
      maxWorkers: 1,
    });
    const specifications = await runner.globTestSpecifications();
    expect(specifications.map((spec) => relative(root, spec.moduleId))).toEqual([
      "scripts/example.test.ts",
    ]);
  } finally {
    await runner?.close();
    await rm(root, { recursive: true, force: true });
  }
});
