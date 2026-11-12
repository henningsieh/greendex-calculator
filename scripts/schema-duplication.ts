/**
 * Detects the same Zod object shape declared in more than one module.
 *
 * A per-file lint rule cannot see this: two features can each own a literal
 * with identical keys and identical value expressions, which is the "repeated
 * in several places" version of the redundancy the domain rules forbid.
 */
import type { Node } from "oxc-parser";
import { parseSync } from "oxc-parser";

import {
  importsZodSchema,
  isZodObjectCall,
  lineAt,
  lineStarts,
  propertyName,
  walk,
} from "./schema-ast";

export type DuplicateEntry = {
  file: string;
  line: number;
  schema: string;
};

export type DuplicateGroup = {
  keys: readonly string[];
  entries: readonly DuplicateEntry[];
};

/** One shared identifier field is a pattern, not a duplicated entity shape. */
const MIN_PROPERTIES = 2;

type Candidate = {
  keys: string[];
  signature: string;
};

function candidateOf(
  source: string,
  literal: { properties: readonly unknown[] },
): Candidate | undefined {
  const entries = literal.properties
    .filter((property) => property !== null && typeof property === "object")
    .filter((property) => (property as { type?: string }).type === "Property")
    .map((property) => {
      const typed = property as Parameters<typeof propertyName>[0];
      const key = propertyName(typed);
      if (!key) return undefined;
      const value = (typed as { value: { start: number; end: number } }).value;
      return {
        key,
        value: source.slice(value.start, value.end).replace(/\s+/gu, ""),
      };
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
  if (entries.length < MIN_PROPERTIES) return undefined;
  const keys = entries.map((entry) => entry.key).sort();
  const signature = entries
    .map((entry) => `${entry.key}:${entry.value}`)
    .sort()
    .join("|");
  return { keys, signature };
}

export function findDuplicates(
  files: readonly { file: string; source: string }[],
): DuplicateGroup[] {
  const groups = new Map<string, { keys: string[]; entries: DuplicateEntry[] }>();

  for (const { file, source } of files) {
    const { program, errors } = parseSync(file, source);
    if (errors.length > 0) {
      throw new Error(`${file}: ${errors[0].message}`);
    }
    if (!importsZodSchema(program)) continue;
    const starts = lineStarts(source);

    walk(program as unknown as Node, (node) => {
      if (node.type !== "VariableDeclarator") return;
      if (node.id.type !== "Identifier") return;
      const init = node.init;
      if (!isZodObjectCall(init)) return;
      const literal = init.arguments[0];
      if (!literal || literal.type !== "ObjectExpression") return;

      const candidate = candidateOf(source, literal);
      if (!candidate) return;

      const group = groups.get(candidate.signature) ?? {
        keys: candidate.keys,
        entries: [],
      };
      group.entries.push({
        file,
        line: lineAt(starts, node.start),
        schema: node.id.name,
      });
      groups.set(candidate.signature, group);
    });
  }

  // Same-file repeats are usually aliases; only cross-module repeats matter.
  return [...groups.values()]
    .filter((group) => new Set(group.entries.map((entry) => entry.file)).size > 1)
    .sort((left, right) => right.entries.length - left.entries.length);
}
