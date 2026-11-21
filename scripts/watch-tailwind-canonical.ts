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
  let canonicalizer: TailwindCanonicalizer | null = null;
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

  function trackStylesheets(instance: TailwindCanonicalizer): void {
    stylesheetSignatures = new Map(
      instance.stylesheetDependencies.map((file) => [file, signature(file)]),
    );
  }

  async function loadCanonicalizer(
    retry: boolean,
  ): Promise<TailwindCanonicalizer | null> {
    do {
      const before = snapshotStylesheets();
      try {
        const next = await createTailwindCanonicalizer();
        if (stable(before, snapshotStylesheets())) return next;
      } catch (error) {
        console.error("Tailwind canonicalizer load failed:", error);
      }
      if (!retry) return null;
      await sleep(RETRY_DELAY);
    } while (true);
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
  canonicalizer = initial;
  trackStylesheets(initial);
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
    const active = canonicalizer!;
    const stylesheetChanged = active.stylesheetDependencies.some(
      (file) => signature(file) !== stylesheetSignatures.get(file),
    );
    if (stylesheetChanged) {
      const reloaded = await loadCanonicalizer(false);
      if (!reloaded) return;
      canonicalizer = reloaded;
      trackStylesheets(reloaded);
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
            await canonicalizer!.canonicalizeFiles([file], { root: ROOT });
            const after = signature(absolute);
            if (after) known.set(file, after);
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
