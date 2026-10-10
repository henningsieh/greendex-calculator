/**
 * Generic filesystem and Markdown helpers for the agent-instruction checks.
 * No repository policy lives here; see ./check-agent-instructions.policy.ts.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { AgentGuidancePattern } from "./check-agent-instructions.policy";

type ErrorReporter = (message: string) => void;

export const createErrorCollector = (): {
  errors: string[];
  addError: ErrorReporter;
  assert: (condition: unknown, message: string) => void;
} => {
  const errors: string[] = [];
  return {
    errors,
    addError: (message) => errors.push(message),
    assert: (condition, message) => {
      if (!condition) errors.push(message);
    },
  };
};

export const readUtf8 = async (filePath: string): Promise<string> =>
  readFile(filePath, "utf8");

export const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await readUtf8(filePath));

export const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const findFiles = async (directoryPath: string): Promise<string[]> => {
  if (!(await pathExists(directoryPath))) return [];

  const files: string[] = [];
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(entryPath)));
    else files.push(entryPath);
  }
  return files;
};

export const parseFrontmatter = (
  content: string,
  fileName: string,
  addError: ErrorReporter,
): Record<string, string> => {
  const match = content.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) {
    addError(`${fileName}: missing YAML frontmatter`);
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    values[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/u, "$2");
  }
  return values;
};

/** Assert that every `{ pattern, message }` hit in content becomes an error. */
export const reportPatternHits = (
  content: string,
  patterns: readonly AgentGuidancePattern[],
  relativePath: string,
  addError: ErrorReporter,
): void => {
  for (const { pattern, message } of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) addError(`${relativePath}: ${message}`);
  }
};

export const validateMarkdownLinks = async (
  filePath: string,
  content: string,
  root: string,
  addError: ErrorReporter,
  baseDirectory: string = path.dirname(filePath),
): Promise<void> => {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().split(/\s+"/u)[0];
    if (
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:")
    ) {
      continue;
    }

    let decodedTarget: string;
    try {
      decodedTarget = decodeURIComponent(rawTarget.split("#", 1)[0]);
    } catch (error) {
      if (!(error instanceof URIError)) throw error;
      addError(
        `${path.relative(root, filePath)}: malformed link ${JSON.stringify(rawTarget)}`,
      );
      continue;
    }

    const absoluteTarget = decodedTarget.startsWith("/")
      ? path.resolve(root, `.${decodedTarget}`)
      : path.resolve(baseDirectory, decodedTarget);
    if (!(await pathExists(absoluteTarget))) {
      addError(
        `${path.relative(root, filePath)}: broken link ${JSON.stringify(rawTarget)}`,
      );
    }
  }
};
