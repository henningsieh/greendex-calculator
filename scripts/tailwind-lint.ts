import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { createTailwindCanonicalizer } from "./tailwind-canonical";
import {
  ROOT as root,
  TAILWIND_CONFIG_FILE,
  tailwindOxlintArgs,
} from "./tailwind-config.mjs";

const cacheFile = resolve(root, ".turbo/tailwind-lint.hash");
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

function inputDigest(): string | undefined {
  try {
    const exclude = git("rev-parse", "--git-path", "info/exclude").trim();
    // Oxlint respects local Git ignore rules, but not the global excludes file.
    // Include tracked files and the shared Tailwind setup so edits invalidate it.
    const discovered = git(
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-per-directory=.gitignore",
      ...(existsSync(resolve(root, exclude))
        ? [`--exclude-from=${exclude}`]
        : []),
      "--",
      "apps",
      "packages",
    )
      .split("\0")
      .filter(Boolean);
    const files = new Set([
      ...discovered,
      ".gitignore",
      ".eslintignore",
      exclude,
      TAILWIND_CONFIG_FILE,
      "package.json",
      "scripts/tailwind-config.mjs",
      "scripts/tailwind-canonical.ts",
      "scripts/tailwind-lint.ts",
      "scripts/watch-tailwind-canonical.ts",
      "pnpm-lock.yaml",
    ]);
    const hash = createHash("sha256");
    for (const file of [...files].sort()) {
      const path = resolve(root, file);
      if (!existsSync(path)) continue;
      // Don't cache if Git and Oxlint can traverse different trees.
      if (!lstatSync(path).isFile()) return undefined;
      hash.update(file).update("\0").update(readFileSync(path)).update("\0");
    }
    return hash.digest("hex");
  } catch {
    // Discovery unavailable or files changed while hashing: run uncached.
    return undefined;
  }
}

async function main() {
  const fix = process.argv.includes("--fix");
  const digest = inputDigest();
  if (
    !fix &&
    digest &&
    existsSync(cacheFile) &&
    readFileSync(cacheFile, "utf8").trim() === digest
  ) {
    console.log(
      "Tailwind lint cache hit — inputs unchanged since the last pass.",
    );
    return;
  }

  if (fix) {
    const canonicalizer = await createTailwindCanonicalizer();
    const changed = await canonicalizer.canonicalizeChangedFiles({ root });
    console.log(`Tailwind canonicalizer updated ${changed} file(s).`);
  }

  const result = spawnSync(
    "pnpm",
    ["exec", "oxlint", ...tailwindOxlintArgs({ fix })],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);

  if (digest && inputDigest() === digest) {
    mkdirSync(resolve(root, ".turbo"), { recursive: true });
    writeFileSync(cacheFile, `${digest}\n`);
  }
}

void main();
