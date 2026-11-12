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

export function importsZodSchema(program: Program): boolean {
  return program.body.some((statement) => {
    if (statement.type !== "ImportDeclaration") return false;
    if (statement.source.value !== "zod") return false;
    return statement.specifiers.some((specifier) => {
      if (specifier.type === "ImportSpecifier") {
        return specifier.imported.type === "Identifier"
          ? specifier.imported.name === "z"
          : false;
      }
      return specifier.local.name === "z";
    });
  });
}

export function isZodObjectCall(
  expression: Expression | null,
): expression is ZodObjectCall {
  if (!expression || expression.type !== "CallExpression") return false;
  const { callee } = expression;
  return (
    callee.type === "MemberExpression" &&
    callee.computed !== true &&
    callee.object.type === "Identifier" &&
    callee.object.name === "z" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "object"
  );
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
