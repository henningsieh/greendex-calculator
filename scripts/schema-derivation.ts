/**
 * Detects Zod object literals that retype a database table's columns by hand
 * instead of deriving them from the table schema.
 *
 * A literal is reported when most of its keys are columns of one table and at
 * least one of those attributes is written as a new Zod schema rather than a
 * reference such as `table.shape.column`, `createSelectSchema(table)` or a
 * shared `<X>Schema`.
 */
import type { Expression, Node } from "oxc-parser";
import { parseSync } from "oxc-parser";

import {
  importsZodSchema,
  isZodObjectCall,
  lineAt,
  lineStarts,
  propertyName,
  walk,
} from "./schema-ast";

export type TableIndex = ReadonlyMap<string, ReadonlySet<string>>;

export type SchemaViolation = {
  file: string;
  line: number;
  schema: string;
  tables: readonly string[];
  attributes: readonly string[];
};

/** Fewer shared columns than this are ordinary coincidence, not an entity. */
const MIN_OVERLAP = 3;
/** Most of the literal's keys must belong to the matched table. */
const MIN_SHARE = 0.5;

/** Combinators that delegate validation to another schema. */
const derivedCombinators = new Set(["and", "or", "pipe"]);

/**
 * A value derives from the database when its callee chain reaches a table
 * column shape (`table.shape.column`) or a schema factory/reference, however
 * many refinements are chained on top (`…shape.name.trim().min(1)`).
 *
 * Two compositions keep deriving while carrying a local message:
 * `z.enum(derivedSchema.options, { error })` takes the value set from the
 * column, and `base.pipe(derivedSchema)` hands validation to the column.
 */
export function isDerivedExpression(expression: Expression | null): boolean {
  if (!expression) return false;
  let current: Node = expression;
  for (;;) {
    if (current.type === "MemberExpression") {
      if (
        current.computed !== true &&
        current.property.type === "Identifier" &&
        current.property.name === "shape"
      ) {
        return true;
      }
      current = current.object;
      continue;
    }
    if (current.type === "CallExpression") {
      const callee: Expression = current.callee;
      if (callee.type === "Identifier") {
        return /^create\w*Schema$/u.test(callee.name);
      }
      if (callee.type === "MemberExpression") {
        const name =
          callee.computed !== true && callee.property.type === "Identifier"
            ? callee.property.name
            : undefined;
        const delegates =
          name !== undefined &&
          (derivedCombinators.has(name) ||
            (name === "enum" &&
              callee.object.type === "Identifier" &&
              callee.object.name === "z"));
        if (
          delegates &&
          current.arguments.some(
            (argument) =>
              argument.type !== "SpreadElement" && isDerivedExpression(argument),
          )
        ) {
          return true;
        }
      }
      current = callee;
      continue;
    }
    if (current.type === "Identifier") {
      return current.name.endsWith("Schema");
    }
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ParenthesizedExpression"
    ) {
      current = current.expression;
      continue;
    }
    return false;
  }
}

export function matchTable(
  keys: readonly string[],
  tables: TableIndex,
): { tables: string[]; shared: string[] } | undefined {
  const scores = [...tables].map(([table, columns]) => {
    const shared = keys.filter((key) => columns.has(key));
    // A narrow table explains more of itself than a wide one does.
    const coverage = columns.size === 0 ? 0 : shared.length / columns.size;
    return { table, shared, coverage };
  });
  if (scores.length === 0) return undefined;
  const bestOverlap = Math.max(...scores.map((score) => score.shared.length));
  if (bestOverlap < MIN_OVERLAP) return undefined;
  if (bestOverlap / keys.length < MIN_SHARE) return undefined;

  const leaders = scores.filter((score) => score.shared.length === bestOverlap);
  const bestCoverage = Math.max(...leaders.map((leader) => leader.coverage));
  const finalists = leaders.filter((leader) => leader.coverage === bestCoverage);
  return {
    tables: finalists.map((finalist) => finalist.table),
    shared: leaders[0].shared,
  };
}

export function scanSource(
  file: string,
  source: string,
  tables: TableIndex,
): SchemaViolation[] {
  const { program, errors } = parseSync(file, source);
  if (errors.length > 0) {
    throw new Error(`${file}: ${errors[0].message}`);
  }
  if (!importsZodSchema(program)) return [];

  const starts = lineStarts(source);
  const violations: SchemaViolation[] = [];

  walk(program as unknown as Node, (node) => {
    if (node.type !== "VariableDeclarator") return;
    if (node.id.type !== "Identifier") return;
    const init = node.init;
    if (!isZodObjectCall(init)) return;

    const literal = init.arguments[0];
    if (!literal || literal.type !== "ObjectExpression") return;

    const entries = literal.properties
      .filter((property) => property.type === "Property")
      .map((property) => ({
        key: propertyName(property),
        derived: isDerivedExpression(property.value),
      }))
      .filter((entry): entry is { key: string; derived: boolean } =>
        Boolean(entry.key),
      );
    if (entries.length === 0) return;

    const match = matchTable(
      entries.map((entry) => entry.key),
      tables,
    );
    if (!match) return;

    const handTyped = entries
      .filter((entry) => match.shared.includes(entry.key) && !entry.derived)
      .map((entry) => entry.key);
    if (handTyped.length === 0) return;

    violations.push({
      file,
      line: lineAt(starts, node.start),
      schema: node.id.name,
      tables: match.tables,
      attributes: handTyped.sort(),
    });
  });

  return violations;
}
