import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseSync,
  Visitor,
  type CallExpression,
  type Expression,
  type JSXExpression,
  type StringLiteral,
} from "oxc-parser";

import {
  isTailwindSourcePath,
  ROOT,
  TAILWIND_REM,
  TAILWIND_SOURCE_GLOBS,
} from "./tailwind-config.mjs";

type DesignSystem = {
  canonicalizeCandidates: (
    candidates: string[],
    options: { rem: number },
  ) => string[];
};

type Replacement = { start: number; end: number; value: string };

const CLASS_FUNCTIONS = new Set(["cn", "clsx", "cva", "twMerge", "twJoin"]);
const CSS_IMPORT = /@(?:import|use)\s+(?:url\()?["']([^"']+)["']\)?/g;

function toPosix(file: string): string {
  return file.split(sep).join("/");
}

function gitFiles(root: string, ...args: string[]): string[] {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Changed and untracked Tailwind sources, using one shared scope definition. */
export function changedTailwindSources(root = ROOT): string[] {
  return [
    ...gitFiles(root, "diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD"),
    ...gitFiles(root, "ls-files", "--others", "--exclude-standard", "-z"),
  ]
    .map((file) => toPosix(file))
    .filter(isTailwindSourcePath)
    .filter((file) => existsSync(resolve(root, file)));
}

function tailwindRoots(): string[] {
  return [
    ...new Set(
      TAILWIND_SOURCE_GLOBS.map((glob) => {
        const marker = glob.indexOf("/src/");
        return marker === -1 ? glob.split("/")[0]! : glob.slice(0, marker);
      }),
    ),
  ];
}

function tailwindStylesheetEntrypoints(root = ROOT): string[] {
  return tailwindRoots()
    .map((appRoot) => resolve(root, appRoot, "src/app/globals.css"))
    .filter((stylesheet) => existsSync(stylesheet));
}

/** Theme entrypoints and their relative CSS imports that affect the design system. */
export function tailwindStylesheetPaths(root = ROOT): string[] {
  const seen = new Set<string>();

  function collect(stylesheet: string): void {
    if (seen.has(stylesheet) || !existsSync(stylesheet)) return;
    seen.add(stylesheet);

    const css = readFileSync(stylesheet, "utf8");
    for (const match of css.matchAll(CSS_IMPORT)) {
      const specifier = match[1]!;
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      const imported = resolve(dirname(stylesheet), specifier);
      collect(imported.endsWith(".css") ? imported : `${imported}.css`);
    }
  }

  for (const stylesheet of tailwindStylesheetEntrypoints(root))
    collect(stylesheet);
  return [...seen];
}

/** All production Tailwind sources, used by the save watcher. */
export function walkTailwindSources(root = ROOT): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if ([".jsx", ".tsx"].includes(extname(path))) files.push(path);
    }
  }

  for (const sourceRoot of tailwindRoots()) walk(resolve(root, sourceRoot));

  return files
    .map((file) => toPosix(relative(root, file)))
    .filter(isTailwindSourcePath)
    .filter((file) => existsSync(resolve(root, file)));
}

function serializeString(value: string, raw: string | null): string {
  const quote = raw?.startsWith('"') ? '"' : "'";
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replaceAll(quote, `\\${quote}`)
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return `${quote}${escaped}${quote}`;
}

function serializeJsxString(value: string, raw: string | null): string {
  const quote = raw?.startsWith('"') ? '"' : "'";
  return `${quote}${value}${quote}`;
}

function canonicalizeClassList(
  value: string,
  designSystem: DesignSystem,
): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const classes = value.trim().split(/\s+/).filter(Boolean);
  if (!classes.length) return value;
  return (
    leading +
    classes
      .map(
        (value) =>
          designSystem.canonicalizeCandidates([value], {
            rem: TAILWIND_REM,
          })[0] ?? value,
      )
      .join(" ") +
    trailing
  );
}

function isClassCall(node: CallExpression): boolean {
  return (
    node.callee.type === "Identifier" && CLASS_FUNCTIONS.has(node.callee.name)
  );
}

function isExpression(
  node: JSXExpression | null | undefined,
): node is Expression {
  return !!node && node.type !== "JSXEmptyExpression";
}

/** Rewrites only AST positions whose string literals produce class names. */
export function canonicalizeSource(
  text: string,
  designSystem: DesignSystem,
): string {
  const parsed = parseSync("canonicalize.tsx", text, {
    lang: "tsx",
    sourceType: "module",
  });
  const replacements = new Map<number, Replacement>();

  function addLiteral(
    node: StringLiteral,
    serialize: (value: string, raw: string | null) => string = serializeString,
  ): void {
    const value = node.value;
    const canonical = canonicalizeClassList(value, designSystem);
    if (canonical === value) return;
    replacements.set(node.start, {
      start: node.start,
      end: node.end,
      value: serialize(canonical, node.raw),
    });
  }

  function collect(node: Expression | JSXExpression | null | undefined): void {
    if (!isExpression(node)) return;

    if (node.type === "Literal" && typeof node.value === "string") {
      addLiteral(node);
      return;
    }
    if (
      node.type === "ParenthesizedExpression" ||
      node.type === "TSAsExpression" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "TSNonNullExpression"
    ) {
      collect(node.expression);
      return;
    }
    if (node.type === "ConditionalExpression") {
      collect(node.consequent);
      collect(node.alternate);
      return;
    }
    if (node.type === "LogicalExpression") {
      if (node.operator === "&&") collect(node.right);
      else if (node.operator === "||" || node.operator === "??") {
        collect(node.left);
        collect(node.right);
      }
      return;
    }
    if (node.type === "BinaryExpression" && node.operator === "+") {
      if (
        node.left.type === "Literal" &&
        typeof node.left.value === "string" &&
        /\s$/.test(node.left.value)
      ) {
        addLiteral(node.left);
      }
      if (
        node.right.type === "Literal" &&
        typeof node.right.value === "string" &&
        /^\s/.test(node.right.value)
      ) {
        addLiteral(node.right);
      }
      return;
    }
    if (node.type === "CallExpression" && isClassCall(node)) {
      for (const argument of node.arguments) {
        if (argument.type !== "SpreadElement") collect(argument);
      }
    }
  }

  const visitor = new Visitor({
    JSXAttribute(node) {
      const name = node.name.type === "JSXIdentifier" ? node.name.name : null;
      if (name !== "class" && name !== "className") return;
      const value = node.value;
      if (!value) return;
      if (value.type === "Literal" && typeof value.value === "string") {
        addLiteral(value, serializeJsxString);
      } else if (value.type === "JSXExpressionContainer") {
        collect(value.expression);
      }
    },
    CallExpression(node) {
      if (!isClassCall(node)) return;
      for (const argument of node.arguments) {
        if (argument.type !== "SpreadElement") collect(argument);
      }
    },
  });
  visitor.visit(parsed.program);

  let next = text;
  for (const replacement of [...replacements.values()].sort(
    (left, right) => right.start - left.start,
  )) {
    next =
      next.slice(0, replacement.start) +
      replacement.value +
      next.slice(replacement.end);
  }
  return next;
}

export type TailwindCanonicalizer = {
  stylesheetDependencies: string[];
  canonicalizeFiles: (
    files: string[],
    options?: { root?: string; log?: boolean },
  ) => Promise<number>;
  canonicalizeChangedFiles: (options?: {
    root?: string;
    log?: boolean;
  }) => Promise<number>;
};

/** Load Tailwind's design systems once; every entry point shares this engine. */
export async function createTailwindCanonicalizer(): Promise<TailwindCanonicalizer> {
  // Resolve through an app dependency so this needs no new manifest entry.
  const postcssEntry = execFileSync(
    "node",
    ["-p", "require.resolve('@tailwindcss/postcss')"],
    { cwd: resolve(ROOT, "apps/cost-tracker"), encoding: "utf8" },
  ).trim();
  const requireFromPostcss = createRequire(postcssEntry);
  const nodeEntry = pathToFileURL(
    requireFromPostcss.resolve("@tailwindcss/node"),
  ).href;
  const { __unstable__loadDesignSystem } = (await import(nodeEntry)) as {
    __unstable__loadDesignSystem: (
      css: string,
      options: { base: string },
    ) => Promise<DesignSystem>;
  };

  const designSystems = new Map<string, DesignSystem>();
  function cacheKey(root: string, appRoot: string): string {
    return `${resolve(root)}\u0000${appRoot}`;
  }

  async function designSystemFor(file: string, root: string) {
    const relativePath = toPosix(relative(root, resolve(root, file)));
    const marker = relativePath.indexOf("/src/");
    if (marker === -1) return null;
    const appRoot = relativePath.slice(0, marker);
    const key = cacheKey(root, appRoot);
    if (!designSystems.has(key)) {
      const stylesheet = resolve(root, appRoot, "src/app/globals.css");
      if (!existsSync(stylesheet)) return null;
      designSystems.set(
        key,
        await __unstable__loadDesignSystem(readFileSync(stylesheet, "utf8"), {
          base: dirname(stylesheet),
        }),
      );
    }
    return designSystems.get(key)!;
  }

  const stylesheetDependencies = tailwindStylesheetPaths(ROOT);
  for (const stylesheet of tailwindStylesheetEntrypoints(ROOT)) {
    const appRoot = toPosix(relative(ROOT, stylesheet)).split("/src/")[0]!;
    designSystems.set(
      cacheKey(ROOT, appRoot),
      await __unstable__loadDesignSystem(readFileSync(stylesheet, "utf8"), {
        base: dirname(stylesheet),
      }),
    );
  }

  async function canonicalizeFiles(
    files: string[],
    { root = ROOT, log = true }: { root?: string; log?: boolean } = {},
  ) {
    let changed = 0;
    for (const file of new Set(files.map(toPosix))) {
      if (!isTailwindSourcePath(file)) continue;
      const designSystem = await designSystemFor(file, root);
      if (!designSystem) continue;
      const target = resolve(root, file);
      if (!existsSync(target)) continue;

      let wrote = false;
      for (let attempt = 0; attempt < 3 && !wrote; attempt += 1) {
        const text = readFileSync(target, "utf8");
        const next = canonicalizeSource(text, designSystem);
        if (next === text) break;
        // A newer save won: retry against its contents instead of overwriting it.
        if (readFileSync(target, "utf8") !== text) continue;
        writeFileSync(target, next);
        wrote = true;
      }
      if (!wrote) continue;
      changed += 1;
      if (log) console.log(`Canonicalized Tailwind classes in ${file}`);
    }
    return changed;
  }

  return {
    stylesheetDependencies,
    canonicalizeFiles,
    canonicalizeChangedFiles: (options) =>
      canonicalizeFiles(changedTailwindSources(options?.root ?? ROOT), options),
  };
}
