import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  createTailwindCanonicalizer,
  walkTailwindSources,
} from "./tailwind-canonical";
import { ROOT } from "./tailwind-config.mjs";

async function main() {
  const canonicalizer = await createTailwindCanonicalizer();
  const known = new Map<string, string>();
  const pending = new Map<string, NodeJS.Timeout>();
  const busy = new Set<string>();

  function signature(file: string): string | null {
    try {
      const stat = statSync(file);
      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return null;
    }
  }

  for (const file of walkTailwindSources(ROOT)) {
    const current = signature(resolve(ROOT, file));
    if (current) known.set(file, current);
  }

  console.log("Tailwind canonical watcher ready");
  setInterval(() => {
    for (const file of walkTailwindSources(ROOT)) {
      const absolute = resolve(ROOT, file);
      const current = signature(absolute);
      if (!current || !existsSync(absolute)) continue;
      const previous = known.get(file);
      known.set(file, current);
      if (previous === current) continue;

      const queued = pending.get(file);
      if (queued) clearTimeout(queued);
      pending.set(
        file,
        setTimeout(async () => {
          pending.delete(file);
          if (busy.has(file)) return;
          busy.add(file);
          try {
            await canonicalizer.canonicalizeFiles([file], { root: ROOT });
            const after = signature(absolute);
            if (after) known.set(file, after);
          } finally {
            busy.delete(file);
          }
        }, 50),
      );
    }
  }, 100);
}

void main();
