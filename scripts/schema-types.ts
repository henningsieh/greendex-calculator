/**
 * Detects hand-written entity types that mirror a database table instead of
 * deriving from it (`typeof table.$inferSelect`, `InferSelectModel<…>`,
 * `Pick<typeof table, …>`).
 *
 * Only plain object type aliases and interfaces without `extends` are
 * considered, and only when their members overlap a table the same way the
 * schema literal check requires.
 */
import type { Node } from "oxc-parser";
import { parseSync } from "oxc-parser";

import { lineAt, lineStarts, walk } from "./schema-ast";
import { type TableIndex, matchTable } from "./schema-derivation";

export type TypeViolation = {
  file: string;
  line: number;
  name: string;
  tables: readonly string[];
  attributes: readonly string[];
};

/** Reference types that already derive from a table are out of scope. */
const derivedTypeNames = new Set([
  "InferInsertModel",
  "InferSelectModel",
  "Omit",
  "Partial",
  "Pick",
  "Readonly",
  "Required",
  "ReturnType",
]);

function isDerivedReference(node: Node): boolean {
  if (node.type !== "TSTypeReference") return false;
  if (node.typeName.type !== "Identifier") return false;
  return derivedTypeNames.has(node.typeName.name);
}

function memberNames(members: readonly unknown[]): string[] {
  return members
    .map((member) => {
      const record = member as { type?: string; key?: unknown };
      if (record.type !== "TSPropertySignature") return undefined;
      const key = record.key as {
        type?: string;
        name?: string;
        value?: unknown;
      };
      if (key.type === "Identifier") return key.name;
      if (key.type === "Literal" && typeof key.value === "string") {
        return key.value;
      }
      return undefined;
    })
    .filter((name): name is string => Boolean(name));
}

export function scanTypes(
  file: string,
  source: string,
  tables: TableIndex,
): TypeViolation[] {
  const { program, errors } = parseSync(file, source);
  if (errors.length > 0) {
    throw new Error(`${file}: ${errors[0].message}`);
  }

  const starts = lineStarts(source);
  const violations: TypeViolation[] = [];

  walk(program as unknown as Node, (node) => {
    let name: string | undefined;
    let members: readonly unknown[] | undefined;

    if (node.type === "TSTypeAliasDeclaration") {
      if (isDerivedReference(node.typeAnnotation)) return;
      if (node.typeAnnotation.type !== "TSTypeLiteral") return;
      name = node.id.name;
      members = node.typeAnnotation.members as readonly unknown[];
    } else if (node.type === "TSInterfaceDeclaration") {
      if (node.extends.length > 0) return;
      name = node.id.name;
      members = node.body.body as readonly unknown[];
    }

    if (!name || !members) return;
    const keys = memberNames(members);
    if (keys.length === 0) return;

    const match = matchTable(keys, tables);
    if (!match) return;

    violations.push({
      file,
      line: lineAt(starts, node.start),
      name,
      tables: match.tables,
      attributes: [...match.shared].sort(),
    });
  });

  return violations;
}
