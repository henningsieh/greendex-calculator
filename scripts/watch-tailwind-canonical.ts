import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  createTailwindCanonicalizer,
  tailwindStylesheetPaths,
  walkTailwindSources,
  type TailwindCanonicalizer,
} from "./tailwind-canonical";
import { ROOT } from "./tailwind-config.mjs";

const TRANSIENT_FS_ERRORS = new Set(["ENOENT", "ENOTDIR", "EACCES", "EPERM"]);
const RETRY_DELAY = 200;

type LoadedCanonicalizer = {
  instance: TailwindCanonicalizer;
  signatures: Map<string, string | null>;
};

function isTransientFsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    TRANSIENT_FS_ERRORS.has(String((error as { code: unknown }).code))
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function main() {
  let canonicalizer: TailwindCanonicalizer;
  let stylesheetSignatures = new Map<string, string | null>();
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

  function snapshotStylesheets(): Map<string, string | null> {
    return new Map(
      tailwindStylesheetPaths(ROOT).map((file) => [file, signature(file)]),
    );
  }

  function stable(
    before: Map<string, string | null>,
    after: Map<string, string | null>,
  ): boolean {
    return (
      before.size === after.size &&
      [...before].every(([file, value]) => after.get(file) === value)
    );
  }

  async function loadCanonicalizer(
    retry: boolean,
  ): Promise<LoadedCanonicalizer | null> {
    for (;;) {
      const before = snapshotStylesheets();
      try {
        const instance = await createTailwindCanonicalizer();
        const validated = snapshotStylesheets();
        if (stable(before, validated)) return { instance, signatures: validated };
      } catch (error) {
        console.error("Tailwind canonicalizer load failed:", error);
      }
      if (!retry) return null;
      await sleep(RETRY_DELAY);
    }
  }

  function discoverSources(): string[] {
    try {
      return walkTailwindSources(ROOT);
    } catch (error) {
      if (isTransientFsError(error)) return [];
      throw error;
    }
  }

  const initial = await loadCanonicalizer(true);
  if (!initial) throw new Error("Unable to load Tailwind canonicalizer");
  canonicalizer = initial.instance;
  stylesheetSignatures = initial.signatures;

  for (const file of discoverSources()) {
    const current = signature(resolve(ROOT, file));
    if (current) known.set(file, current);
  }

  console.log("Tailwind canonical watcher ready");

  let polling = false;
  setInterval(() => {
    if (polling) return;
    polling = true;
    void poll()
      .catch((error: unknown) => {
        console.error("Tailwind canonical watcher poll failed:", error);
      })
      .finally(() => {
        polling = false;
      });
  }, 100);

  async function poll(): Promise<void> {
    if (!stable(snapshotStylesheets(), stylesheetSignatures)) {
      const reloaded = await loadCanonicalizer(false);
      if (!reloaded) return;
      canonicalizer = reloaded.instance;
      stylesheetSignatures = reloaded.signatures;
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
            if (!stable(snapshotStylesheets(), stylesheetSignatures)) {
              const reloaded = await loadCanonicalizer(false);
              if (!reloaded) {
                known.delete(file);
                return;
              }
              canonicalizer = reloaded.instance;
              stylesheetSignatures = reloaded.signatures;
            }

            const processed = signature(absolute);
            const changed = await canonicalizer.canonicalizeFiles([file], {
              root: ROOT,
            });
            const after = signature(absolute);
            if (!changed || after === processed) {
              if (after) known.set(file, after);
              else known.delete(file);
            } else if (processed) {
              known.set(file, processed);
            } else {
              known.delete(file);
            }
          } catch (error) {
            console.error(`Tailwind canonicalization failed for ${file}:`, error);
            known.delete(file);
          } finally {
            busy.delete(file);
          }
        }, 50),
      );
    }
  }
}

void main();
