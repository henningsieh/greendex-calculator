/** Shared AST helpers for the repository schema checks. */
import type { Expression, Node, ObjectProperty, Program } from "oxc-parser";

export type ZodObjectCall = Extract<Expression, { type: "CallExpression" }>;

export function walk(value: unknown, visit: (node: Node) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visit);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type === "string") visit(value as Node);
  for (const [key, child] of Object.entries(record)) {
    if (key === "parent") continue;
    walk(child, visit);
  }
}

export function propertyName(property: ObjectProperty): string | undefined {
  if (property.computed) return undefined;
  const { key } = property;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

const zodModules = new Set(["zod", "zod/mini", "zod/v4"]);
const defaultZodNamespaces: ReadonlySet<string> = new Set(["z"]);
const zodObjectBuilders = new Set(["looseObject", "object", "strictObject"]);

function isZodModule(source: string): boolean {
  return zodModules.has(source);
}

export function importsZodSchema(program: Program): boolean {
  return program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      isZodModule(statement.source.value) &&
      statement.specifiers.length > 0,
  );
}

/** Locals that hold the zod module: namespace, default and `{ z }` imports. */
export function zodNamespaceNames(program: Program): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    if (!isZodModule(statement.source.value)) continue;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === "ImportNamespaceSpecifier" ||
        specifier.type === "ImportDefaultSpecifier"
      ) {
        names.add(specifier.local.name);
        continue;
      }
      if (
        specifier.type === "ImportSpecifier" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "z"
      ) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

/**
 * Base object call of a schema expression, unwrapping modifiers such as
 * `z.object({…}).partial()` to the `z.object({…})` they refine.
 */
export function getZodObjectCall(
  expression: Expression | null,
  namespaces: ReadonlySet<string> = defaultZodNamespaces,
): ZodObjectCall | undefined {
  let current = expression;
  while (
    current !== null &&
    current.type === "CallExpression" &&
    current.callee.type === "MemberExpression" &&
    current.callee.object.type === "CallExpression"
  ) {
    current = current.callee.object;
  }
  if (current === null || current.type !== "CallExpression") return undefined;
  const { callee } = current;
  if (callee.type !== "MemberExpression" || callee.computed === true) {
    return undefined;
  }
  if (
    callee.object.type !== "Identifier" ||
    !namespaces.has(callee.object.name)
  ) {
    return undefined;
  }
  if (
    callee.property.type !== "Identifier" ||
    !zodObjectBuilders.has(callee.property.name)
  ) {
    return undefined;
  }
  return current;
}

export function isZodObjectCall(
  expression: Expression | null,
  namespaces: ReadonlySet<string> = defaultZodNamespaces,
): expression is ZodObjectCall {
  return getZodObjectCall(expression, namespaces) !== undefined;
}

export function lineStarts(source: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

export function lineAt(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return low + 1;
}
