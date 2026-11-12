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
  "datetime",
  "discriminatedUnion",
  "duration",
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
  "time",
  "tuple",
  "undefined",
  "union",
  "unknown",
  "url",
  "uuid",
  "void",
]);

const zodModules = new Set(["zod", "zod/mini", "zod/v4"]);

/** `id`, `projectId`, `completedByUserId` — but not `valid` or `grid`. */
const identifierKey = /^(?:id|[a-z][A-Za-z0-9]*Id)$/u;

/** `ProjectIdSchema`, `CoordinationIdSchema` — identifier schemas themselves. */
const identifierSchemaName = /^[A-Z][A-Za-z0-9]*IdSchema$/u;

/** Composite builders describe a shape, not one identifier. */
const compositeBuilders = new Set([
  "array",
  "discriminatedUnion",
  "intersection",
  "looseObject",
  "map",
  "object",
  "record",
  "set",
  "strictObject",
  "tuple",
  "union",
]);

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

/** Imported name of a binding: `import { object as shape }` -> `object`. */
function importedName(definition) {
  const specifier = definition.node;
  if (specifier?.type === "ImportDefaultSpecifier") return "default";
  if (specifier?.type !== "ImportSpecifier") return undefined;
  return specifier.imported?.type === "Identifier"
    ? specifier.imported.name
    : undefined;
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

/** First schema builder in a value expression: `z.string().min(1)` -> `z.string()`. */
function builderInChain(context, node) {
  let current = node;
  for (;;) {
    if (current.type === "CallExpression") {
      if (isSchemaBuilderCall(context, current)) return current;
      current = current.callee;
      continue;
    }
    if (current.type === "MemberExpression") {
      current = current.object;
      continue;
    }
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ParenthesizedExpression"
    ) {
      current = current.expression;
      continue;
    }
    return undefined;
  }
}

function propertyKey(node) {
  if (!("key" in node) || node.computed) return undefined;
  const { key } = node;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
}

function isSchemaBuilderCall(context, node) {
  if (node.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type === "Identifier") {
    const imported = importedBinding(context, callee);
    if (!imported) return false;
    if (!zodModules.has(imported.parent?.source?.value)) return false;
    return schemaBuilders.has(importedName(imported));
  }
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

/** A final `.pipe(...)` delegates validation to the derived schema. */
function endsInPipe(node) {
  const top = expressionTop(node);
  return (
    top.type === "CallExpression" &&
    top.callee.type === "MemberExpression" &&
    top.callee.computed !== true &&
    top.callee.property.type === "Identifier" &&
    top.callee.property.name === "pipe"
  );
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
    "schema-derived-identifier": {
      meta: {
        type: "suggestion",
        messages: {
          local:
            "Derive `{{key}}` from the table schema — reuse an <X>IdSchema or `createSelectSchema(table).shape.<column>` — instead of declaring a new Zod schema.",
          declaration:
            "Derive `{{key}}` from the table column (`createSelectSchema(table).shape.<column>`) instead of declaring a new Zod schema.",
        },
      },
      create(context) {
        return {
          VariableDeclarator(node) {
            if (node.id.type !== "Identifier") return;
            if (!identifierSchemaName.test(node.id.name)) return;
            if (!node.init) return;
            const builder = builderInChain(context, node.init);
            if (!builder || compositeBuilders.has(builder.callee.property.name)) {
              return;
            }
            if (endsInPipe(node.init)) return;
            context.report({
              node: node.init,
              messageId: "declaration",
              data: { key: node.id.name },
            });
          },
          Property(node) {
            const key = propertyKey(node);
            if (!key || !identifierKey.test(key)) return;
            if (!builderInChain(context, node.value)) return;
            if (endsInPipe(node.value)) return;
            context.report({
              node: node.value,
              messageId: "local",
              data: { key },
            });
          },
        };
      },
    },
    "procedure-input-schema": {
      meta: {
        type: "suggestion",
        messages: {
          inline:
            "Declare this input schema in the feature's validation-schemas module and pass it to .input().",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            const { callee } = node;
            if (callee.type !== "MemberExpression" || callee.computed) return;
            if (
              callee.property.type !== "Identifier" ||
              callee.property.name !== "input"
            ) {
              return;
            }
            const argument = node.arguments[0];
            if (!argument || argument.type === "SpreadElement") return;
            if (!builderInChain(context, argument)) return;
            context.report({ node: argument, messageId: "inline" });
          },
        };
      },
    },
  },
};
