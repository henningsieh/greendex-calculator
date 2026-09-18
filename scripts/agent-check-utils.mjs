/**
 * Generic filesystem and Markdown helpers for the agent-instruction checks.
 * No repository policy lives here; see ./agent-instruction-policy.mjs.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export const createErrorCollector = () => {
  const errors = [];
  return {
    errors,
    addError: (message) => errors.push(message),
    assert: (condition, message) => {
      if (!condition) errors.push(message);
    },
  };
};

export const readUtf8 = async (filePath) => readFile(filePath, "utf8");

export const readJson = async (filePath) => JSON.parse(await readUtf8(filePath));

export const pathExists = async (targetPath) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const findFiles = async (directoryPath) => {
  if (!(await pathExists(directoryPath))) return [];

  const files = [];
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(entryPath)));
    else files.push(entryPath);
  }
  return files;
};

export const parseFrontmatter = (content, fileName, addError) => {
  const match = content.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) {
    addError(`${fileName}: missing YAML frontmatter`);
    return {};
  }

  const values = {};
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
export const reportPatternHits = (content, patterns, relativePath, addError) => {
  for (const { pattern, message } of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) addError(`${relativePath}: ${message}`);
  }
};

export const validateMarkdownLinks = async (
  filePath,
  content,
  root,
  addError,
  baseDirectory = path.dirname(filePath),
) => {
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

    let decodedTarget;
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
