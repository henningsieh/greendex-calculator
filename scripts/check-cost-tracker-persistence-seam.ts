import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CostTrackerSourceFile = {
  content: string;
  relativePath: string;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = "apps/cost-tracker/src";
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
const sourceFilePattern = /\.(?:ts|tsx|js|jsx)$/u;
const testFilePattern = /(?:test|spec)\.[jt]sx?$/u;
const importOrReExportPattern =
  /\b(?:import|export)\s+(?!type\b)[\s\S]*?\s+from\s+(["'])([^"']+)\1/gu;
const sideEffectImportPattern = /\bimport\s+(["'])([^"']+)\1/gu;
const dynamicImportPattern = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/gu;

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

const getModuleSpecifiers = (content: string) => {
  const specifiers = new Set<string>();

  for (const pattern of [
    importOrReExportPattern,
    sideEffectImportPattern,
    dynamicImportPattern,
  ]) {
    for (const match of content.matchAll(pattern)) specifiers.add(match[2]);
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
