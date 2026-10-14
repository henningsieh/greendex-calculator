import { createHash } from "node:crypto";
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function canonicalSeedVersion(
  seedDirectory: string,
): Promise<string> {
  const hash = createHash("sha256");
  // Every co-located seed builder and scenario registry contributes to provenance.
  for (const name of globSync(["seed.ts", "seed-*.ts"], {
    cwd: seedDirectory,
  }).sort()) {
    const content = await readFile(resolve(seedDirectory, name));
    hash.update(`${name}\0${content.length}\0`).update(content);
  }
  return hash.digest("hex");
}
