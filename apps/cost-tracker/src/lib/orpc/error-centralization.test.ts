// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSafeErrorSituation,
  SafeErrorDataSchema,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

// Only these pre-existing private invariant exceptions remain raw. Their exact
// expressions are pinned, not entire files; the procedure boundary sanitizes them.
const privateInvariantThrows: Record<string, string[]> = {
  "features/projects/procedures/projects.ts": [
    'new Error("Expected at least one SQL condition.")',
    'new Error("Expected at least one SQL condition.")',
  ],
  "features/projects/procedures/partnerships.ts": [
    'new Error("Project Partnership insert returned no row")',
  ],
  "features/projects/procedures/payable.ts": [
    'new Error("Invalid exact decimal")',
    'new Error("Unsupported decimal precision")',
    "new Error( `No frozen funding band for Participation ${journey.participantId}.`, )",
  ],
  "lib/orpc/orpc.ts": ['new Error("RPCLink is not allowed on the server side.")'],
  "lib/proof-storage.ts": ['new Error("Proof file has no body.")'],
};
function directErrorSites(source: string) {
  const aliases = [...source.matchAll(/\bORPCError\s+as\s+(\w+)/g)].map(
    (match) => match[1],
  );
  const constructors = [
    "ORPCError",
    "Error",
    "TypeError",
    "RangeError",
    ...aliases,
  ].join("|");
  return [
    ...source.matchAll(
      new RegExp(
        `\\bnew\\s+(?:${constructors})\\s*\\([\\s\\S]*?\\)(?=\\s*[;,}])|\\.\\s*[A-Z][A-Z_]+\\s*\\(|\\[\\s*["'][A-Z][A-Z_]+["']\\s*\\]\\s*\\(|\\bthrow\\s+["'\\x60]`,
        "g",
      ),
    ),
  ].map((match) => match[0].replace(/\s+/g, " "));
}
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("centralized error guardrails", () => {
  it("pins the complete situation matrix independently of factories", () => {
    expect(situationCatalog).toMatchSnapshot();
  });
  it.each(Object.entries(situationCatalog))(
    "%s fixes code/status/message/reason and validates client metadata",
    (name, expected) => {
      const methods = createSituationErrors();
      const method = methods[name as keyof typeof methods];
      // Catalog entries are fixed zero-argument situations except the separately
      // tested submission checklist, which accepts existing safe field issues.
      const error =
        name === "submissionIncomplete"
          ? methods.submissionIncomplete([])
          : (method as () => ReturnType<typeof methods.badInput>)();
      expect(error).toMatchObject({
        code: expected.code,
        status: expected.status,
        message: expected.message,
        data: { reason: expected.reason },
      });
      expect(SafeErrorDataSchema.safeParse(error.data).success).toBe(true);
      expect(getSafeErrorSituation(error)).toEqual(expected);
      expect(
        getSafeErrorSituation({ ...error, code: "WRONG_CODE" }),
      ).toBeUndefined();
      expect(getSafeErrorSituation({ ...error, status: 999 })).toBeUndefined();
    },
  );
  it("rejects direct constructors, typed-map calls (including callbacks), aliases and literal throws", () => {
    for (const source of [
      'throw new ORPCError("FORBIDDEN", { message: "free form" });',
      'import { ORPCError as DomainError } from "@orpc/server"; throw new DomainError("BAD_REQUEST");',
      'return errors.BAD_REQUEST({ message: "free form" });',
      'throw failures["FORBIDDEN"]({ message: "free form" });',
      'throw new Error("business rejection");',
      'throw "business rejection";',
    ])
      expect(directErrorSites(source).length).toBeGreaterThan(0);
    expect(directErrorSites("throw situations.notMember();")).toEqual([]);
    expect(directErrorSites("throw error;")).toEqual([]);
  });
  it("has no free-form domain error construction outside the designated factory/native boundary", () => {
    const root = resolve(import.meta.dirname, "../..");
    const violations: Record<string, string[]> = {};
    const seenInvariants: Record<string, string[]> = {};
    for (const path of sourceFiles(root)) {
      const name = relative(root, path);
      // Better Auth's native role gate remains native (ADR-0012); it does not
      // produce the app's oRPC envelope. Only errors.ts owns oRPC constructors.
      if (
        name === "lib/orpc/errors.ts" ||
        name === "features/organizations/roles.ts"
      )
        continue;
      const sites = directErrorSites(readFileSync(path, "utf8"));
      if (privateInvariantThrows[name]) seenInvariants[name] = sites;
      else if (sites.length) violations[name] = sites;
    }
    expect(violations).toEqual({});
    expect(seenInvariants).toEqual(privateInvariantThrows);
  });
});
