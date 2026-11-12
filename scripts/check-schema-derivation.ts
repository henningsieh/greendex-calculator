/**
 * Repository gate: feature schema modules must derive entity attributes from
 * the database tables instead of retyping them.
 *
 * Report-only by default; pass `--gate` to fail on violations.
 */
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import * as schemaModule from "@greendex/database/schema";
import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import {
  type SchemaViolation,
  type TableIndex,
  scanSource,
} from "./schema-derivation";
import { findSchemaModules } from "./schema-files";

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

function report(violations: readonly SchemaViolation[]): void {
  for (const violation of violations) {
    console.log(`  ${violation.file}:${violation.line}  ${violation.schema}`);
    console.log(
      `    mirrors ${violation.tables.join(" / ")}: ${violation.attributes.join(", ")} hand-typed`,
    );
    console.log(
      `    derive: createSelectSchema(${violation.tables[0]}) or ${violation.tables[0]}.shape.<column>`,
    );
  }
}

const tables = collectTables();
const modules = findSchemaModules(root);
const violations = modules.flatMap((file) =>
  scanSource(relative(root, file), readFileSync(file, "utf8"), tables),
);

if (violations.length === 0) {
  console.log(
    `check:schema-derivation passed — ${modules.length} schema modules derive from ${tables.size} tables.`,
  );
  process.exit(0);
}

console.log(
  `check:schema-derivation found ${violations.length} object literal(s) that retype database attributes:\n`,
);
report(violations);
console.log("");
if (gate) {
  console.log(
    "Failing because --gate is set. Derive these attributes or fix the match.",
  );
  process.exit(1);
}
console.log(
  "Report-only while the existing schemas are migrated; rerun with --gate to enforce.",
);
process.exit(0);
