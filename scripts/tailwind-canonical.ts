import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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

// Complete JSX attribute names avoid `data-class`; `cn(...)` expressions are
// scanned separately so nested conditional class literals are included too.
const CLASS_ATTRIBUTE = /(?<![\w:-])(className|class)\s*=\s*(?:"([^"]*)"|\{)/g;
const CN_CALL = /\bcn\s*\(/g;
const STRING_LITERAL = /"([^"]*)"|'([^']*)'/g;

type Replacement = { start: number; end: number; value: string };

function toPosix(file: string): string {
  return file.split(sep).join("/");
}

function findClosing(
  text: string,
  start: number,
  open: string,
  close: string,
): number | null {
  let depth = 0;
  let quote: string | null = null;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index]!;
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
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
    designSystem
      .canonicalizeCandidates(classes, { rem: TAILWIND_REM })
      .join(" ") +
    trailing
  );
}

function isClassLiteralPosition(
  text: string,
  from: number,
  to: number,
  regionStart: number,
): boolean {
  const before = text.slice(Math.max(regionStart, to - 80), to).trimEnd();
  const after = text.slice(from, Math.min(text.length, from + 80)).trimStart();
  const comparison = /(?:===|!==|==|!=|<=|>=|<|>)$/;
  if (comparison.test(before) || /^(?:===|!==|==|!=|<=|>=|<|>)/.test(after)) {
    return false;
  }
  const call = before.match(/(?:^|[^\w$])([A-Za-z_$][\w$]*)\s*\($/);
  return !call || call[1] === "cn";
}

function collectStringReplacements(
  text: string,
  from: number,
  to: number,
  designSystem: DesignSystem,
  replacements: Map<number, Replacement>,
): void {
  STRING_LITERAL.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = STRING_LITERAL.exec(text)) !== null && match.index < to) {
    const end = match.index + match[0].length;
    if (end > to) break;
    const value = match[1] ?? match[2] ?? "";
    if (!isClassLiteralPosition(text, match.index + 1, match.index, from)) {
      continue;
    }
    const canonical = canonicalizeClassList(value, designSystem);
    if (canonical !== value) {
      replacements.set(match.index + 1, {
        start: match.index + 1,
        end: end - 1,
        value: canonical,
      });
    }
    STRING_LITERAL.lastIndex = end;
  }
}

export function canonicalizeSource(
  text: string,
  designSystem: DesignSystem,
): string {
  const replacements = new Map<number, Replacement>();

  for (const match of text.matchAll(CLASS_ATTRIBUTE)) {
    const quoted = match[2];
    if (quoted !== undefined) {
      const quoteIndex = match[0].indexOf('"', match[0].indexOf("="));
      const start = match.index + quoteIndex + 1;
      const canonical = canonicalizeClassList(quoted, designSystem);
      if (canonical !== quoted) {
        replacements.set(start, {
          start,
          end: start + quoted.length,
          value: canonical,
        });
      }
      continue;
    }
    const open = match.index + match[0].length - 1;
    const close = findClosing(text, open, "{", "}");
    if (close !== null) {
      collectStringReplacements(
        text,
        open + 1,
        close,
        designSystem,
        replacements,
      );
    }
  }

  for (const match of text.matchAll(CN_CALL)) {
    const open = match.index + match[0].length - 1;
    const close = findClosing(text, open, "(", ")");
    if (close !== null) {
      collectStringReplacements(
        text,
        open + 1,
        close,
        designSystem,
        replacements,
      );
    }
  }

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

  async function designSystemFor(file: string, root: string) {
    const relativePath = toPosix(relative(root, resolve(root, file)));
    const marker = relativePath.indexOf("/src/");
    if (marker === -1) return null;
    const appRoot = relativePath.slice(0, marker);
    if (!designSystems.has(appRoot)) {
      const stylesheet = resolve(root, appRoot, "src/app/globals.css");
      if (!existsSync(stylesheet)) return null;
      designSystems.set(
        appRoot,
        await __unstable__loadDesignSystem(readFileSync(stylesheet, "utf8"), {
          base: dirname(stylesheet),
        }),
      );
    }
    return designSystems.get(appRoot)!;
  }

  // Load each app's design system before consumers announce readiness, so the
  // first editor save does not pay the compiler startup cost. The paths are
  // exposed so the watcher can rebuild when a theme changes.
  const stylesheetDependencies = tailwindRoots()
    .map((appRoot) => resolve(ROOT, appRoot, "src/app/globals.css"))
    .filter((stylesheet) => existsSync(stylesheet));

  for (const stylesheet of stylesheetDependencies) {
    const appRoot = toPosix(relative(ROOT, stylesheet)).split("/src/")[0]!;
    designSystems.set(
      appRoot,
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

      const text = readFileSync(target, "utf8");
      const next = canonicalizeSource(text, designSystem);
      if (next === text) continue;
      writeFileSync(target, next);
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
