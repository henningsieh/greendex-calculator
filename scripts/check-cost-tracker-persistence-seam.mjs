import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensionPattern = /\.(?:ts|tsx|js|jsx)$/u;
const testFilePattern = /\.(?:test|spec)\.[jt]sx?$/u;
const databaseClientImportPattern =
  /(?:from\s*|import\s*\()(["'])@greendex\/database\1/u;

const findFiles = async (directoryPath) => {
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
    else if (
      sourceExtensionPattern.test(entry.name) &&
      !testFilePattern.test(entry.name)
    ) {
      files.push(entryPath);
    }
  }

  return files;
};

const isRouteOrViewModule = (relativePath) =>
  relativePath.startsWith("apps/cost-tracker/src/app/") ||
  /apps\/cost-tracker\/src\/features\/[^/]+\/components\//u.test(
    relativePath,
  );

export const findForbiddenDatabaseImports = (files) =>
  files
    .filter(
      ({ content, relativePath }) =>
        isRouteOrViewModule(relativePath) &&
        databaseClientImportPattern.test(content),
    )
    .map(({ relativePath }) => relativePath)
    .sort();

const getRuntimeRouteAndViewFiles = async () => {
  const directories = [
    path.join(root, "apps", "cost-tracker", "src", "app"),
    ...(
      await readdir(path.join(root, "apps", "cost-tracker", "src", "features"), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        path.join(
          root,
          "apps",
          "cost-tracker",
          "src",
          "features",
          entry.name,
          "components",
        ),
      ),
  ];
  const paths = (await Promise.all(directories.map(findFiles))).flat();

  return Promise.all(
    paths.map(async (filePath) => ({
      content: await readFile(filePath, "utf8"),
      relativePath: path.relative(root, filePath),
    })),
  );
};

const run = async () => {
  const violations = findForbiddenDatabaseImports(
    await getRuntimeRouteAndViewFiles(),
  );

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

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
