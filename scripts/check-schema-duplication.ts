/**
 * Repository check: the same Zod object shape must not be declared in more
 * than one feature schema module.
 *
 * Report-only by default; pass `--gate` to fail on duplicates.
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { findDuplicates } from "./schema-duplication";
import { findSchemaModules } from "./schema-files";

const root = resolve(import.meta.dirname, "..");
const gate = process.argv.includes("--gate");

const modules = findSchemaModules(root);
const files = modules.map((file) => ({
  file: relative(root, file),
  source: readFileSync(file, "utf8"),
}));
const duplicates = findDuplicates(files);

if (duplicates.length === 0) {
  console.log(
    `check:schema-duplication passed — ${modules.length} schema modules export distinct shapes.`,
  );
  process.exit(0);
}

console.log(
  `check:schema-duplication found ${duplicates.length} shape(s) declared in more than one module:\n`,
);
for (const group of duplicates) {
  console.log(`  { ${group.keys.join(", ")} }`);
  for (const entry of group.entries) {
    console.log(`    ${entry.file}:${entry.line}  ${entry.schema}`);
  }
  console.log("");
}
if (gate) {
  console.log("Failing because --gate is set. Keep one schema and import it.");
  process.exit(1);
}
console.log(
  "Report-only while the existing duplicates are consolidated; rerun with --gate to enforce.",
);
process.exit(0);
