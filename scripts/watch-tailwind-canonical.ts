import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  createTailwindCanonicalizer,
  walkTailwindSources,
  type TailwindCanonicalizer,
} from "./tailwind-canonical";
import { ROOT } from "./tailwind-config.mjs";

const TRANSIENT_FS_ERRORS = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM"]);

function isTransientFsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    TRANSIENT_FS_ERRORS.has(String((error as { code: unknown }).code))
  );
}

async function main() {
  let canonicalizer: TailwindCanonicalizer = await createTailwindCanonicalizer();
  const known = new Map<string, string>();
  const pending = new Map<string, NodeJS.Timeout>();
  const busy = new Set<string>();
  let stylesheetSignatures = new Map<string, string | null>();

  function signature(file: string): string | null {
    try {
      const stat = statSync(file);
      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return null;
    }
  }

  function trackStylesheets(instance: TailwindCanonicalizer): void {
    stylesheetSignatures = new Map(
      instance.stylesheetDependencies.map((file) => [file, signature(file)]),
    );
  }

  function discoverSources(): string[] {
    try {
      return walkTailwindSources(ROOT);
    } catch (error) {
      if (isTransientFsError(error)) return [];
      throw error;
    }
  }

  trackStylesheets(canonicalizer);
  for (const file of discoverSources()) {
    const current = signature(resolve(ROOT, file));
    if (current) known.set(file, current);
  }

  console.log("Tailwind canonical watcher ready");

  let polling = false;
  setInterval(() => {
    if (polling) return;
    polling = true;
    void poll().finally(() => {
      polling = false;
    });
  }, 100);

  async function poll(): Promise<void> {
    const stylesheetChanged = canonicalizer.stylesheetDependencies.some(
      (file) => signature(file) !== stylesheetSignatures.get(file),
    );
    if (stylesheetChanged) {
      try {
        canonicalizer = await createTailwindCanonicalizer();
        trackStylesheets(canonicalizer);
      } catch (error) {
        if (!isTransientFsError(error)) throw error;
      }
    }

    for (const file of discoverSources()) {
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
  }
}

void main();
