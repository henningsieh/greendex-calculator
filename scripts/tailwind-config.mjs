import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(SCRIPT_DIR, "..");

/** Single source of truth for every Tailwind lint/fix entry point. */
export const TAILWIND_CONFIG_FILE = "oxlint.tailwind.json";
export const TAILWIND_REM = 16;

const config = JSON.parse(
  readFileSync(resolve(ROOT, TAILWIND_CONFIG_FILE), "utf8"),
);

const canonicalScope = config.overrides?.find(
  (override) =>
    override.rules?.["better-tailwindcss/enforce-canonical-classes"] === "error",
);

if (!canonicalScope) {
  throw new Error(
    `${TAILWIND_CONFIG_FILE} must define an override with better-tailwindcss/enforce-canonical-classes`,
  );
}

export const TAILWIND_SOURCE_GLOBS = canonicalScope.files ?? [];
export const TAILWIND_EXCLUDE_GLOBS = [
  ...(config.ignorePatterns ?? []),
  ...(canonicalScope.excludeFiles ?? []),
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  let source = "";
  for (let index = 0; index < glob.length;) {
    if (glob.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 3;
    } else if (glob.startsWith("**", index)) {
      source += ".*";
      index += 2;
    } else if (glob[index] === "*") {
      source += "[^/]*";
      index += 1;
    } else if (glob[index] === "{") {
      const end = glob.indexOf("}", index);
      if (end === -1) {
        source += escapeRegExp(glob[index]);
        index += 1;
        continue;
      }
      const choices = glob
        .slice(index + 1, end)
        .split(",")
        .map(escapeRegExp);
      source += `(?:${choices.join("|")})`;
      index = end + 1;
    } else {
      source += escapeRegExp(glob[index]);
      index += 1;
    }
  }
  return new RegExp(`^${source}$`);
}

function normalizePath(file) {
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function matchesExclude(file) {
  return TAILWIND_EXCLUDE_GLOBS.some((pattern) => {
    if (globToRegExp(pattern).test(file)) return true;
    return !pattern.startsWith("**") && globToRegExp(`**/${pattern}`).test(file);
  });
}

/** True only for production sources covered by oxlint.tailwind.json. */
export function isTailwindSourcePath(file) {
  const path = normalizePath(file);
  return matchesAny(path, TAILWIND_SOURCE_GLOBS) && !matchesExclude(path);
}

/** Every Tailwind-aware consumer passes this exact Oxlint configuration. */
export function tailwindOxlintArgs({ fix = false, files = [] } = {}) {
  return [
    "--config",
    TAILWIND_CONFIG_FILE,
    ...(fix ? ["--fix"] : []),
    ...(files.length ? files : ["apps", "packages"]),
  ];
}
