// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * #388: every Cost Tracker procedure carries exactly one taxonomy tag plus a
 * non-empty summary, so Scalar groups the reference by domain.
 *
 * This guard is structural (source level) on purpose: importing the whole
 * router into a unit test drags in env validation, the database client and
 * every integration seam. Counting metadata against handlers catches the
 * real regression — a new procedure shipped without metadata — and the
 * taxonomy/summary assertions keep the vocabulary from drifting.
 */

const FEATURES_DIR = join(process.cwd(), "src", "features");

const TAXONOMY = new Set([
  "Access",
  "Organizations",
  "Projects",
  "Partnerships",
  "Participations",
  "Journeys",
  "Claims",
  "Costs",
  "Documents",
  "Reviews",
]);

function procedureSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...procedureSources(full));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) continue;
    found.push(full);
  }
  return found;
}

const sources = procedureSources(FEATURES_DIR)
  .map((file) => ({ file, text: readFileSync(file, "utf8") }))
  .filter(({ text }) => text.includes(".handler("))
  .map(({ file, text }) => ({
    file: file.slice(process.cwd().length + 1),
    handlers: (text.match(/^\s*\.handler\(/gm) ?? []).length,
    metas: (text.match(/^\s*\.meta\(/gm) ?? []).length,
    tags: [...text.matchAll(/tags:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      (m[1] ?? "")
        .split(",")
        .map((value) => value.trim().replace(/^"|"$/g, ""))
        .filter(Boolean),
    ),
    summaries: [...text.matchAll(/summary:\s*("([^"]*)"|decisionSummaries\[)/g)],
  }));

describe("OpenAPI metadata coverage (#388)", () => {
  it("finds procedure sources to guard", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it("gives every procedure a .meta() block", () => {
    const missing = sources
      .filter((source) => source.handlers !== source.metas)
      .map(
        (source) =>
          `${source.file}: ${source.handlers} handlers vs ${source.metas} meta blocks`,
      );
    expect(missing).toEqual([]);
  });

  it("uses only taxonomy tags", () => {
    const unknown = sources.flatMap((source) =>
      source.tags
        .filter((tag) => !TAXONOMY.has(tag))
        .map((tag) => `${source.file}: ${tag}`),
    );
    expect(unknown).toEqual([]);
  });

  it("never leaves a summary empty", () => {
    const empty = sources.flatMap((source) =>
      source.summaries
        .filter((match) => match[2] !== undefined && match[2].trim() === "")
        .map(() => source.file),
    );
    expect(empty).toEqual([]);
  });
});
