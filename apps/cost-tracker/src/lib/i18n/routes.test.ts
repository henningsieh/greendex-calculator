// @vitest-environment node

import { existsSync, globSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const app = fileURLToPath(new URL("../../app/", import.meta.url));
const sourceRoutes = globSync("**/{page,layout,loading}.tsx", {
  cwd: app,
}).filter((file) => !file.startsWith("[locale]/") && file !== "layout.tsx");

function publicExports(path: string) {
  const source = readFileSync(path, "utf8");
  const names = new Set<string>();
  if (/export default\b/.test(source)) names.add("default");
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const binding of match[1].split(",")) {
      const name = binding
        .trim()
        .split(/\s+as\s+/)
        .at(-1);
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:const|(?:async\s+)?function)\s+(\w+)/g,
  ))
    names.add(match[1]);
  return names;
}

describe("Cost Tracker localized route contracts", () => {
  // Rendering, streaming and parameter scoping are exercised for both URL
  // forms in project-partnership-streaming.test.tsx and loading-skeletons.unit.test.tsx.
  it.each(sourceRoutes)("preserves public route exports for %s", (route) => {
    const source = publicExports(resolve(app, route));
    const localized = publicExports(resolve(app, "[locale]", route));
    for (const name of ["default", "metadata", "generateMetadata", "instant"]) {
      // Only the unprefixed landing page opts out of instant validation.
      if (route === "page.tsx" && name === "instant") continue;
      expect(localized.has(name), `${route}: ${name}`).toBe(source.has(name));
    }
    expect(localized.has("default")).toBe(true);
    if (source.has("instant")) {
      expect(readFileSync(resolve(app, route), "utf8")).toMatch(
        /export const instant = false;/,
      );
      if (route !== "page.tsx")
        expect(readFileSync(resolve(app, "[locale]", route), "utf8")).toMatch(
          /export const instant = false;/,
        );
      else expect(localized.has("instant")).toBe(false);
    }
  });

  it("keeps all production modules independent of other app route entries", () => {
    const source = resolve(app, "..");
    const files = globSync("**/*.{ts,tsx}", { cwd: source }).filter(
      (file) => !/\.(?:test|spec)\./.test(file) && !file.startsWith("__tests__/"),
    );
    const routeFiles = new Set([
      "page",
      "layout",
      "loading",
      "route",
      "template",
      "error",
      "global-error",
      "not-found",
      "default",
    ]);
    for (const file of files) {
      const path = resolve(source, file);
      const imports = readFileSync(path, "utf8").matchAll(
        /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g,
      );
      for (const [, specifier] of imports) {
        const target = specifier.startsWith("@/")
          ? resolve(source, specifier.slice(2))
          : specifier.startsWith("@greendex/cost-tracker/")
            ? resolve(source, specifier.slice("@greendex/cost-tracker/".length))
            : specifier.startsWith(".")
              ? resolve(dirname(path), specifier)
              : null;
        if (!target?.startsWith(app)) continue;
        expect(
          routeFiles.has(basename(target).replace(/\.(?:tsx?|jsx?)$/, "")),
          `${file} imports route entry ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("removes the former Claim review detail URLs without replacement routes", () => {
    for (const prefix of ["(protected)", "[locale]/(protected)"]) {
      expect(
        existsSync(resolve(app, prefix, "claims/review/[id]/page.tsx")),
      ).toBe(false);
      expect(
        existsSync(resolve(app, prefix, "claims/review/[id]/route.ts")),
      ).toBe(false);
    }
  });
});
