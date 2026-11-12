/**
 * Repository check: entity types must derive from the database tables rather
 * than restating their columns.
 *
 * Report-only by default; pass `--gate` to fail on violations.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import * as schemaModule from "@greendex/database/schema";
import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import type { TableIndex } from "./schema-derivation";
import { type TypeViolation, scanTypes } from "./schema-types";

const root = resolve(import.meta.dirname, "..");
const gate = process.argv.includes("--gate");

function collectTables(): TableIndex {
  const index = new Map<string, ReadonlySet<string>>();
  for (const [exportName, value] of Object.entries(schemaModule)) {
    if (!is(value, PgTable)) continue;
    index.set(exportName, new Set(Object.keys(getTableColumns(value))));
  }
  return index;
}

function findTypeModules(): string[] {
  const files: string[] = [];
  for (const workspace of ["apps", "packages"]) {
    const workspaceDirectory = join(root, workspace);
    if (!existsSync(workspaceDirectory)) continue;
    for (const entry of readdirSync(workspaceDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      for (const sourceDirectory of [
        join(workspaceDirectory, entry.name, "src", "features"),
        join(workspaceDirectory, entry.name, "src", "lib"),
      ]) {
        if (!existsSync(sourceDirectory)) continue;
        for (const file of readdirSync(sourceDirectory, {
          recursive: true,
          withFileTypes: true,
        })) {
          if (!file.isFile()) continue;
          if (!/\.tsx?$/u.test(file.name)) continue;
          if (/\.(test|spec|unit|integration)\./u.test(file.name)) continue;
          files.push(join(file.parentPath, file.name));
        }
      }
    }
  }
  return files.sort();
}

function report(violations: readonly TypeViolation[]): void {
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  ${violation.name}`);
    console.log(
      `    mirrors ${violation.tables.join(" / ")}: ${violation.attributes.join(", ")}`,
    );
    console.log(
      `    derive: typeof ${violation.tables[0]}.$inferSelect or Pick<typeof ${violation.tables[0]}, …>`,
    );
  }
}

const tables = collectTables();
const modules = findTypeModules();
const violations = modules.flatMap((file) =>
  scanTypes(relative(root, file), readFileSync(file, "utf8"), tables),
);

if (violations.length === 0) {
  console.log(
    `check:schema-types passed — ${modules.length} feature/lib modules avoid restating table columns.`,
  );
  process.exit(0);
}

console.log(
  `check:schema-types found ${violations.length} type(s) that restate table columns:\n`,
);
report(violations);
console.log("");
if (gate) {
  console.log("Failing because --gate is set. Derive these types instead.");
  process.exit(1);
}
console.log(
  "Report-only while the existing types are migrated; rerun with --gate to enforce.",
);
process.exit(0);
