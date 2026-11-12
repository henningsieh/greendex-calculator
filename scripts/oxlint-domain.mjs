/**
 * Greendex domain-structure rules.
 *
 * Encodes the single-source-of-truth standard from
 * `docs/agents/instructions/code-standards.md`: validation schemas live in the
 * owning feature's `validation-schemas.ts`, derived from the database tables,
 * and are imported everywhere else.
 */

/** Zod v4 schema builders. `z.infer` and friends are types, not calls. */
const schemaBuilders = new Set([
  "any",
  "array",
  "bigint",
  "boolean",
  "codec",
  "coerce",
  "custom",
  "date",
  "discriminatedUnion",
  "email",
  "enum",
  "function",
  "instanceof",
  "intersection",
  "lazy",
  "literal",
  "looseObject",
  "map",
  "nan",
  "nativeEnum",
  "never",
  "null",
  "nullish",
  "number",
  "object",
  "optional",
  "pipe",
  "preprocess",
  "promise",
  "record",
  "set",
  "strictObject",
  "string",
  "symbol",
  "templateLiteral",
  "tuple",
  "undefined",
  "union",
  "unknown",
  "url",
  "uuid",
  "void",
]);

const zodModules = new Set(["zod", "zod/mini", "zod/v4"]);

function importedBinding(context, identifier) {
  let scope = context.sourceCode.getScope(identifier);
  while (scope) {
    const variable = scope.set.get(identifier.name);
    if (variable) {
      return variable.defs.find(
        (definition) => definition.type === "ImportBinding",
      );
    }
    scope = scope.upper;
  }
  return undefined;
}

function isZodNamespace(context, identifier) {
  const imported = importedBinding(context, identifier);
  if (!imported) return false;
  return zodModules.has(imported.parent?.source?.value);
}

/** Left-most identifier of a member chain, skipping call continuations. */
function chainRoot(node) {
  let current = node;
  while (current.type === "MemberExpression") current = current.object;
  return current.type === "Identifier" ? current : undefined;
}

function isSchemaBuilderCall(context, node) {
  if (node.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  const { property } = callee;
  if (property.type !== "Identifier") return false;
  if (!schemaBuilders.has(property.name)) return false;
  const root = chainRoot(callee);
  return Boolean(root && isZodNamespace(context, root));
}

/** Outermost node of one schema expression: `z.string().min(1)` -> `min(1)`. */
function expressionTop(node) {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return current;
    const continuesChain =
      (parent.type === "MemberExpression" && parent.object === current) ||
      (parent.type === "CallExpression" && parent.callee === current) ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "ParenthesizedExpression";
    if (!continuesChain) return current;
    current = parent;
  }
}

export default {
  meta: { name: "greendex-domain" },
  rules: {
    "validation-schema-location": {
      meta: {
        type: "suggestion",
        messages: {
          local:
            "Declare this schema in the feature's validation-schemas module and import it here; use a create…Schema(t) factory when messages are translated.",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (!isSchemaBuilderCall(context, node)) return;
            const top = expressionTop(node);
            // One report per schema expression: nested builders such as
            // `z.object({ email: z.email() })` belong to their parent schema.
            for (
              let ancestor = top.parent;
              ancestor;
              ancestor = ancestor.parent
            ) {
              if (isSchemaBuilderCall(context, ancestor)) return;
            }
            context.report({ node: top, messageId: "local" });
          },
        };
      },
    },
  },
};
