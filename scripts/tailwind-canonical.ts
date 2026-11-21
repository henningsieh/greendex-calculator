import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, relative, resolve, sep } from "node:path";
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

const CLASS_ATTRIBUTE =
  /\b(className|class|cn)\s*=\s*"([^"]+)"|\bcn\("([^"]+)"\)/g;

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
          base: resolve(root, appRoot),
        }),
      );
    }
    return designSystems.get(appRoot)!;
  }

  // Load each app's design system before consumers announce readiness, so the
  // first editor save does not pay the compiler startup cost.
  for (const appRoot of tailwindRoots()) {
    const stylesheet = resolve(ROOT, appRoot, "src/app/globals.css");
    if (!existsSync(stylesheet)) continue;
    designSystems.set(
      appRoot,
      await __unstable__loadDesignSystem(readFileSync(stylesheet, "utf8"), {
        base: resolve(ROOT, appRoot),
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
      const next = text.replace(
        CLASS_ATTRIBUTE,
        (
          match,
          _attribute: string,
          jsx: string | undefined,
          call: string | undefined,
        ) => {
          const classes = (jsx ?? call ?? "").split(/\s+/).filter(Boolean);
          if (!classes.length) return match;
          const canonical = designSystem.canonicalizeCandidates(classes, {
            rem: TAILWIND_REM,
          });
          return match.replace(jsx ?? call!, canonical.join(" "));
        },
      );
      if (next === text) continue;
      writeFileSync(target, next);
      changed += 1;
      if (log) console.log(`Canonicalized Tailwind classes in ${file}`);
    }
    return changed;
  }

  return {
    canonicalizeFiles,
    canonicalizeChangedFiles: (options) =>
      canonicalizeFiles(changedTailwindSources(options?.root ?? ROOT), options),
  };
}
