import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCALAR_VERSION = "1.76.4" as const;

export const SCALAR_STANDALONE_PATH =
  `/api/scalar/standalone-${SCALAR_VERSION}.js` as const;

// require.resolve("@scalar/api-reference") lets the bundler trace the Vue
// entry into the server bundle, so locate the package on disk instead.
export function findScalarPackageDir(fromUrl: string): string {
  let dir = dirname(fileURLToPath(fromUrl));
  while (true) {
    const candidate = join(dir, "node_modules", "@scalar", "api-reference");
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Scalar package not found");
    dir = parent;
  }
}
