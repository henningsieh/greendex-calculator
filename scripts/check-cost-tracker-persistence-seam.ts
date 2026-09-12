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

type ModuleSpecifier = {
  isReExport: boolean;
  value: string;
};

type ScannedToken = {
  kind: SyntaxKind;
  text: string;
  value: string;
};

const isSpecifierToken = (kind: SyntaxKind) =>
  kind === SyntaxKind.StringLiteral ||
  kind === SyntaxKind.NoSubstitutionTemplateLiteral;

const getTokenSpecifier = (token: ScannedToken) =>
  token.value || token.text.slice(1, -1);

const scanTokens = (content: string): ScannedToken[] => {
  const scanner = createScanner(true);
  scanner.setText(content);
  const tokens: ScannedToken[] = [];

  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    tokens.push({
      kind,
      text: scanner.getTokenText(),
      value: scanner.getTokenValue(),
    });
  }

  return tokens;
};

const getModuleSpecifiers = (content: string): ModuleSpecifier[] => {
  const specifiers = new Map<string, boolean>();
  const importedBindings = new Map<string, string>();
  const tokens = scanTokens(content);
  const recordSpecifier = (value: string, isReExport: boolean) => {
    specifiers.set(value, specifiers.get(value) === true || isReExport);
  };
  const recordBindings = (start: number, end: number, specifier: string) => {
    for (let i = start; i < end; i += 1) {
      if (tokens[i].kind === SyntaxKind.Identifier) {
        importedBindings.set(tokens[i].value, specifier);
      }
    }
  };
  const findStatementEnd = (start: number) => {
    for (let i = start; i < tokens.length; i += 1) {
      if (tokens[i].kind === SyntaxKind.SemicolonToken) return i;
    }
    return tokens.length;
  };
  const findFromSpecifier = (start: number, end: number) => {
    for (let i = start; i < end - 1; i += 1) {
      if (
        tokens[i].kind === SyntaxKind.FromKeyword &&
        isSpecifierToken(tokens[i + 1].kind)
      ) {
        return { index: i + 1, value: getTokenSpecifier(tokens[i + 1]) };
      }
    }
    return undefined;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if (!next) continue;

    if (token.kind === SyntaxKind.ImportKeyword) {
      if (
        next.kind === SyntaxKind.OpenParenToken &&
        tokens[i + 2] &&
        isSpecifierToken(tokens[i + 2].kind)
      ) {
        recordSpecifier(getTokenSpecifier(tokens[i + 2]), false);
        i += 2;
        continue;
      }
      if (isSpecifierToken(next.kind)) {
        recordSpecifier(getTokenSpecifier(next), false);
        i += 1;
        continue;
      }
      if (
        next.kind === SyntaxKind.TypeKeyword ||
        next.kind === SyntaxKind.DotToken
      ) {
        continue;
      }

      const end = findStatementEnd(i + 1);
      const from = findFromSpecifier(i + 1, end);
      if (from) {
        recordSpecifier(from.value, false);
        recordBindings(i + 1, from.index, from.value);
        i = end;
      }
    } else if (token.kind === SyntaxKind.ExportKeyword) {
      if (next.kind === SyntaxKind.TypeKeyword) continue;
      if (
        next.kind !== SyntaxKind.OpenBraceToken &&
        next.kind !== SyntaxKind.AsteriskToken
      ) {
        continue;
      }

      const end = findStatementEnd(i + 1);
      const from = findFromSpecifier(i + 1, end);
      if (from) {
        recordSpecifier(from.value, true);
      } else if (next.kind === SyntaxKind.OpenBraceToken) {
        for (let j = i + 2; j < end; j += 1) {
          if (tokens[j].kind === SyntaxKind.Identifier) {
            const importedSpecifier = importedBindings.get(tokens[j].value);
            if (importedSpecifier) recordSpecifier(importedSpecifier, true);
          }
        }
      }
      i = end;
    }
  }

  return [...specifiers].map(([value, isReExport]) => ({
    isReExport,
    value,
  }));
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
    exposesClient = false,
  ) => {
    if (seen.has(relativePath)) return false;

    const module = modules.get(relativePath);
    if (!module) return false;

    seen.add(relativePath);
    for (const specifier of getModuleSpecifiers(module.content)) {
      if (
        isDatabaseClientPackage(specifier.value) &&
        (!isPermittedPersistenceOwner(relativePath) ||
          exposesClient ||
          specifier.isReExport)
      ) {
        seen.delete(relativePath);
        return true;
      }

      const dependency = resolveLocalModule(
        relativePath,
        specifier.value,
        modules,
      );
      if (
        dependency &&
        hasDatabaseClientAccess(
          dependency,
          seen,
          exposesClient || specifier.isReExport,
        )
      ) {
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
