import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SyntaxKind } from "typescript/unstable/ast";
import { createScanner } from "typescript/unstable/ast/scanner";

export type CostTrackerSourceFile = {
  content: string;
  relativePath: string;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = "apps/cost-tracker/src";
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
const sourceFilePattern = /\.(?:ts|tsx|js|jsx)$/u;
const testFilePattern = /(?:test|spec)\.[jt]sx?$/u;

const normalizePath = (filePath: string) => path.posix.normalize(filePath);

const isDatabaseClientPackage = (specifier: string) =>
  specifier === "@greendex/database" ||
  (specifier.startsWith("@greendex/database/") &&
    specifier !== "@greendex/database/schema" &&
    !specifier.startsWith("@greendex/database/schema/"));

const isRuntimeSourceFile = (relativePath: string) =>
  sourceFilePattern.test(relativePath) && !testFilePattern.test(relativePath);

const isFeatureProcedure = (relativePath: string) =>
  /\/features\/[^/]+\/[^/]*procedure(?:s)?\.[jt]sx?$/u.test(relativePath);

const isPermittedPersistenceOwner = (relativePath: string) =>
  isFeatureProcedure(relativePath) ||
  relativePath === `${sourceRoot}/lib/auth.ts`;

const isRouteOrViewModule = (relativePath: string) =>
  relativePath.startsWith(`${sourceRoot}/app/`) ||
  relativePath.startsWith(`${sourceRoot}/components/`) ||
  (relativePath.startsWith(`${sourceRoot}/features/`) &&
    !isFeatureProcedure(relativePath));

const findFiles = async (directoryPath: string): Promise<string[]> => {
  try {
    await stat(directoryPath);
  } catch {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(entryPath)));
    else if (isRuntimeSourceFile(entry.name)) files.push(entryPath);
  }

  return files;
};

type ScannedToken = {
  kind: SyntaxKind;
  text: string;
  value: string;
};

const isSpecifierToken = (kind: SyntaxKind) =>
  kind === SyntaxKind.StringLiteral ||
  kind === SyntaxKind.NoSubstitutionTemplateLiteral;

const getTokenSpecifier = (token: ScannedToken) => {
  if (token.value) return token.value;
  const text = token.text;
  return text.length >= 2 ? text.slice(1, -1) : text;
};

const scanTokens = (content: string): ScannedToken[] => {
  // skipTrivia=true: comments/whitespace never surface as tokens, so
  // import-like text in comments or string literals can't false-positive.
  const scanner = createScanner(true);
  scanner.setText(content);
  const tokens: ScannedToken[] = [];

  let kind = scanner.scan();
  while (kind !== SyntaxKind.EndOfFile) {
    tokens.push({
      kind,
      text: scanner.getTokenText(),
      value: scanner.getTokenValue(),
    });
    kind = scanner.scan();
  }

  return tokens;
};

const getModuleSpecifiers = (content: string) => {
  const specifiers = new Set<string>();
  const tokens = scanTokens(content);

  // Attribute a `from "spec"` string to its import/export statement.
  // Whole-declaration `import type` / `export type` is skipped (type-only).
  // Inline `import { type X }` still records (fail-closed over-approximation).
  const recordFromSpecifier = (fromIndex: number) => {
    for (let i = fromIndex + 1; i < tokens.length; i += 1) {
      if (isSpecifierToken(tokens[i].kind)) {
        specifiers.add(getTokenSpecifier(tokens[i]));
        return i;
      }
      if (tokens[i].kind === SyntaxKind.SemicolonToken) return i;
    }
    return tokens.length;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.kind === SyntaxKind.ImportKeyword) {
      const next = tokens[i + 1];
      if (!next) continue;

      // Dynamic import: import("spec")
      if (
        next.kind === SyntaxKind.OpenParenToken &&
        tokens[i + 2] &&
        isSpecifierToken(tokens[i + 2].kind)
      ) {
        specifiers.add(getTokenSpecifier(tokens[i + 2]));
        i += 2;
        continue;
      }

      // Side-effect import: import "spec"
      if (isSpecifierToken(next.kind)) {
        specifiers.add(getTokenSpecifier(next));
        i += 1;
        continue;
      }

      // import type ... -> type-only, skip
      if (next.kind === SyntaxKind.TypeKeyword) continue;

      // Only static declaration grammar can contain a from-clause. Do not
      // skip ordinary statements such as import.meta expressions, which can
      // contain a later dynamic import.
      const isStaticImport =
        next.kind === SyntaxKind.Identifier ||
        next.kind === SyntaxKind.OpenBraceToken ||
        next.kind === SyntaxKind.AsteriskToken;
      if (!isStaticImport) continue;

      for (let j = i + 1; j < tokens.length; j += 1) {
        if (tokens[j].kind === SyntaxKind.FromKeyword) {
          i = recordFromSpecifier(j);
          break;
        }
        if (tokens[j].kind === SyntaxKind.SemicolonToken) {
          i = j;
          break;
        }
      }
    } else if (token.kind === SyntaxKind.ExportKeyword) {
      const next = tokens[i + 1];
      // export type ... -> type-only, skip
      if (next && next.kind === SyntaxKind.TypeKeyword) continue;

      // Only export-list and export-all declarations can contain a
      // from-clause. Keep exported initializers in the token stream so a
      // nested dynamic import is still discovered.
      const isStaticReExport =
        next?.kind === SyntaxKind.OpenBraceToken ||
        next?.kind === SyntaxKind.AsteriskToken;
      if (!isStaticReExport) continue;

      for (let j = i + 1; j < tokens.length; j += 1) {
        if (tokens[j].kind === SyntaxKind.FromKeyword) {
          i = recordFromSpecifier(j);
          break;
        }
        if (tokens[j].kind === SyntaxKind.SemicolonToken) {
          i = j;
          break;
        }
      }
    }
  }

  return specifiers;
};

const resolveLocalModule = (
  from: string,
  specifier: string,
  modules: Map<string, CostTrackerSourceFile>,
) => {
  let candidate: string;

  if (specifier.startsWith("@/")) {
    candidate = `${sourceRoot}/${specifier.slice(2)}`;
  } else if (specifier.startsWith("@greendex/cost-tracker/")) {
    candidate = `${sourceRoot}/${specifier.slice(
      "@greendex/cost-tracker/".length,
    )}`;
  } else if (specifier.startsWith(".")) {
    candidate = path.posix.join(path.posix.dirname(from), specifier);
  } else {
    return undefined;
  }

  const normalizedCandidate = normalizePath(candidate);
  const candidates = sourceExtensions.some((extension) =>
    normalizedCandidate.endsWith(extension),
  )
    ? [normalizedCandidate]
    : [
        ...sourceExtensions.map(
          (extension) => `${normalizedCandidate}${extension}`,
        ),
        ...sourceExtensions.map(
          (extension) => `${normalizedCandidate}/index${extension}`,
        ),
      ];

  return candidates.find((modulePath) => modules.has(modulePath));
};

export const findForbiddenDatabaseImports = (
  files: CostTrackerSourceFile[],
): string[] => {
  const modules = new Map(
    files
      .filter(({ relativePath }) => isRuntimeSourceFile(relativePath))
      .map((file) => [normalizePath(file.relativePath), file]),
  );

  const hasDatabaseClientAccess = (
    relativePath: string,
    seen = new Set<string>(),
  ) => {
    if (seen.has(relativePath) || isPermittedPersistenceOwner(relativePath)) {
      return false;
    }

    const module = modules.get(relativePath);
    if (!module) return false;

    seen.add(relativePath);
    for (const specifier of getModuleSpecifiers(module.content)) {
      if (isDatabaseClientPackage(specifier)) {
        seen.delete(relativePath);
        return true;
      }

      const dependency = resolveLocalModule(relativePath, specifier, modules);
      if (dependency && hasDatabaseClientAccess(dependency, seen)) {
        seen.delete(relativePath);
        return true;
      }
    }
    seen.delete(relativePath);

    return false;
  };

  return [...modules.keys()]
    .filter(isRouteOrViewModule)
    .filter((relativePath) => hasDatabaseClientAccess(relativePath))
    .sort();
};

const getRuntimeFiles = async (): Promise<CostTrackerSourceFile[]> => {
  const sourcePath = path.join(root, ...sourceRoot.split("/"));
  const paths = await findFiles(sourcePath);

  return Promise.all(
    paths.map(async (filePath) => ({
      content: await readFile(filePath, "utf8"),
      relativePath: path.relative(root, filePath).split(path.sep).join("/"),
    })),
  );
};

const run = async () => {
  const violations = findForbiddenDatabaseImports(await getRuntimeFiles());

  if (violations.length > 0) {
    console.error("Cost Tracker persistence seam violations:\n");
    for (const violation of violations) {
      console.error(
        `- ${violation}: route and view modules consume oRPC; feature procedures own database-client access`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("Cost Tracker persistence seam is intact.");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
