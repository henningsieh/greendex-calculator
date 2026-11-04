import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// require.resolve("@scalar/api-reference") lets the bundler trace the Vue
// entry into the server bundle, so locate the bytes on disk instead.
function findStandalone(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(
      dir,
      "node_modules",
      "@scalar",
      "api-reference",
      "dist",
      "browser",
      "standalone.js",
    );
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Scalar standalone.js not found");
    dir = parent;
  }
}

const standalonePath = findStandalone();

let cached: string | null = null;

export async function GET() {
  cached ??= await readFile(standalonePath, "utf8");
  return new Response(cached, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
