import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cacheFile = resolve(root, ".turbo/tailwind-lint.hash");

// The Tailwind rule set only reads JSX/TSX and the CSS that defines the design
// system. Hashing those inputs makes an unchanged rerun cheap without skipping
// a single rule; any source, CSS, config or lockfile change invalidates it.
const patterns = [
  "apps/*/src/**/*.{jsx,tsx}",
  "packages/*/src/**/*.{jsx,tsx}",
  "apps/*/src/**/*.css",
  "packages/*/src/**/*.css",
  "apps/*/components.json",
  "apps/*/postcss.config.*",
  "apps/*/tailwind.config.*",
  "oxlint.tailwind.json",
  "package.json",
  "scripts/tailwind-lint.ts",
  "pnpm-lock.yaml",
];

const files = patterns
  .flatMap((pattern) => globSync(pattern, { cwd: root }))
  .filter(
    (file) =>
      !/\/__tests__\//.test(file) &&
      !/\.(test|spec|stories)\./.test(file) &&
      !file.startsWith("node_modules/") &&
      !file.startsWith(".next/"),
  )
  .sort();

const hash = createHash("sha256");
for (const file of files) {
  hash.update(file);
  hash.update("\0");
  hash.update(readFileSync(resolve(root, file)));
  hash.update("\0");
}
const digest = hash.digest("hex");

if (existsSync(cacheFile) && readFileSync(cacheFile, "utf8").trim() === digest) {
  console.log(
    `Tailwind lint cache hit — ${files.length} inputs unchanged since the last pass.`,
  );
  process.exit(0);
}

const result = spawnSync(
  "pnpm",
  ["exec", "oxlint", "-c", "oxlint.tailwind.json", "apps", "packages"],
  { cwd: root, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);

mkdirSync(resolve(root, ".turbo"), { recursive: true });
writeFileSync(cacheFile, `${digest}\n`);
