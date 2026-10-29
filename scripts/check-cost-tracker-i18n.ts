#!/usr/bin/env node
/* Repository policy: Cost Tracker UI copy belongs in the locale catalog.
 *
 * This guard scans Cost Tracker UI sources for literal copy in JSX text and
 * visible JSX attributes. It reports every warning; `--strict` fails while
 * any warning remains. There is no baseline or ratchet.
 *
 * Allowed: {t("key")} and values derived from expressions.
 * Ignored: technical attributes, test files, shadcn primitives, punctuation.
 */
import { execFileSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "@babel/parser";

const root = resolve(import.meta.dirname, "..");
const patterns = ["apps/cost-tracker/src/**/*.{tsx,jsx}"];
const excludes = [
  "**/node_modules/**",
  "**/components/ui/**",
  "**/__tests__/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
];

function isScopedFile(file: string): boolean {
  return (
    file.startsWith("apps/cost-tracker/src/") &&
    (file.endsWith(".tsx") || file.endsWith(".jsx")) &&
    !file.includes("/components/ui/") &&
    !file.includes("/__tests__/") &&
    !/\.(test|spec|stories)\.[^.]+$/.test(file)
  );
}

function stagedFiles(): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
    { cwd: root, encoding: "utf8" },
  );
  return output.split("\0").filter((file) => file && isScopedFile(file));
}

const visibleAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "cancelLabel",
  "caption",
  "confirmLabel",
  "description",
  "emptyMessage",
  "errorMessage",
  "heading",
  "helperText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "title",
  "tooltip",
]);

type Node = {
  type: string;
  loc?: { start: { line: number; column: number } };
  start?: number;
  end?: number;
  [key: string]: unknown;
};

type Violation = {
  file: string;
  line: number;
  column: number;
  text: string;
  kind: "text" | "attribute";
};

const violations: Violation[] = [];
const parsedFiles = new Set<string>();
const parseFailures: string[] = [];

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function displayText(value: string): string {
  const compact = cleanText(value);
  return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
}

function isDecorative(value: string): boolean {
  const withoutEntities = value.replace(/&[a-zA-Z][a-zA-Z0-9]+;/g, " ");
  return !hasLetter(withoutEntities);
}

function attributeName(name: unknown): string | null {
  if (!isNode(name)) return null;
  if (name.type === "JSXIdentifier" && typeof name.name === "string") {
    return name.name;
  }
  if (name.type === "JSXNamespacedName") {
    const namespace = name.namespace;
    const local = name.name;
    if (
      isNode(namespace) &&
      typeof namespace.name === "string" &&
      isNode(local) &&
      typeof local.name === "string"
    ) {
      return `${namespace.name}:${local.name}`;
    }
  }
  return null;
}

function templateText(node: Node): string {
  if (!Array.isArray(node.quasis)) return "";
  return node.quasis
    .map((quasi) => {
      if (!isNode(quasi) || !quasi.value || typeof quasi.value !== "object") {
        return "";
      }
      const value = quasi.value as { cooked?: unknown; raw?: unknown };
      return typeof value.cooked === "string"
        ? value.cooked
        : typeof value.raw === "string"
          ? value.raw
          : "";
    })
    .join("");
}

function literalText(node: unknown): string | null {
  if (!isNode(node)) return null;
  switch (node.type) {
    case "StringLiteral":
      return typeof node.value === "string" ? node.value : null;
    case "TemplateLiteral":
      return templateText(node);
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
      return literalText(node.expression);
    default:
      return null;
  }
}

function allowedLines(source: string): Set<number> {
  const allowed = new Set<number>();
  source.split("\n").forEach((line, index) => {
    if (line.includes("i18n-allow-next-line")) allowed.add(index + 2);
    if (line.includes("i18n-allow-line")) allowed.add(index + 1);
  });
  return allowed;
}

function report(
  file: string,
  node: Node,
  value: string,
  kind: Violation["kind"],
  allowed: Set<number>,
): void {
  const line = node.loc?.start.line;
  const column = node.loc?.start.column;
  if (line === undefined || column === undefined) return;
  if (allowed.has(line)) return;
  if (isDecorative(value)) return;
  violations.push({
    file,
    line,
    column: column + 1,
    text: displayText(value),
    kind,
  });
}

function walk(
  node: unknown,
  visit: (node: Node, parent: Node | null) => void,
  parent: Node | null = null,
): void {
  if (!isNode(node)) return;
  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key === "range" ||
      key === "extra" ||
      key === "comments" ||
      key === "leadingComments" ||
      key === "trailingComments" ||
      key === "innerComments" ||
      key === "tokens" ||
      key === "errors"
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, node);
    } else {
      walk(value, visit, node);
    }
  }
}

const staged = process.argv.includes("--staged");
const files = staged
  ? stagedFiles()
  : globSync(patterns, { cwd: root, exclude: excludes });

if (staged && files.length === 0) {
  console.log("check:check-i18n — no staged Cost Tracker UI files.");
  process.exit(0);
}

for (const file of files) {
  const absolute = resolve(root, file);
  const source = readFileSync(absolute, "utf8");
  const allowed = allowedLines(source);
  parsedFiles.add(file);

  let ast: Node;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
      attachComment: true,
    }) as unknown as Node;
  } catch (error) {
    parseFailures.push(
      `${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
    continue;
  }

  const parserErrors = (ast as { errors?: unknown }).errors;
  if (Array.isArray(parserErrors) && parserErrors.length > 0) {
    parseFailures.push(`${file}: ${parserErrors.length} parser error(s)`);
  }

  walk(ast, (node, parent) => {
    if (node.type === "JSXText") {
      const value = typeof node.value === "string" ? node.value : "";
      report(file, node, value, "text", allowed);
      return;
    }

    if (node.type === "JSXAttribute") {
      const name = attributeName(node.name);
      if (!name || !visibleAttributes.has(name)) return;
      const value = node.value;
      if (!isNode(value)) return;
      if (value.type === "StringLiteral") {
        const text = typeof value.value === "string" ? value.value : "";
        report(file, value, text, "attribute", allowed);
        return;
      }
      if (value.type === "JSXExpressionContainer") {
        const text = literalText(value.expression);
        if (text !== null) {
          report(file, value.expression as Node, text, "attribute", allowed);
        }
      }
      return;
    }

    if (
      node.type === "JSXExpressionContainer" &&
      parent &&
      (parent.type === "JSXElement" || parent.type === "JSXFragment")
    ) {
      const text = literalText(node.expression);
      if (text !== null) {
        report(file, node.expression as Node, text, "text", allowed);
      }
    }
  });
}

const strict = process.argv.includes("--strict");
const maxWarningsIndex = process.argv.indexOf("--max-warnings");
const maxWarnings =
  maxWarningsIndex >= 0
    ? Number(process.argv[maxWarningsIndex + 1] ?? Number.POSITIVE_INFINITY)
    : Number.POSITIVE_INFINITY;

for (const violation of violations) {
  console.log(
    `${violation.file}:${violation.line}:${violation.column}  ${violation.kind}  "${violation.text}"`,
  );
}

for (const failure of parseFailures) {
  console.error(`PARSE ERROR ${failure}`);
}

console.log(
  `\ncheck:check-i18n — ${violations.length} warning(s) across ${parsedFiles.size} ${staged ? "staged " : ""}Cost Tracker UI file(s).`,
);

if (parseFailures.length > 0) process.exitCode = 1;
if (strict && violations.length > 0) process.exitCode = 1;
if (violations.length > maxWarnings) process.exitCode = 1;

if (process.exitCode === 1) {
  console.error(
    'Hardcoded UI copy is not allowed. Use next-intl `t("key")` and add the key to every locale bundle.',
  );
} else if (violations.length > 0) {
  console.log("Warn-only. Pass --strict to fail this check.");
}
