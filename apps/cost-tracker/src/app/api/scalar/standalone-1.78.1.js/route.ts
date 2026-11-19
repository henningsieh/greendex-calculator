import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { findScalarPackageDir } from "@/lib/scalar-version";

const standalonePath = join(
  findScalarPackageDir(import.meta.url),
  "dist",
  "browser",
  "standalone.js",
);

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
