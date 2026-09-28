/**
 * Guard against agent-instruction drift.
 *
 * Orchestration only: policy data lives in ./check-agent-instructions.policy.ts
 * and filesystem/Markdown helpers in ./check-agent-instructions.utils.ts.
 */
import { lstat, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  agentPointerPattern,
  appAgentFileNames,
  designSystemDeferredScopes,
  designSystemPlugin,
  designSystemStrictScope,
  expectedScopes,
  instructionLineBudget,
  lintTaskInputs,
  nextConfigsToCheck,
  officialSkillSources,
  referenceFiles,
  requiredIntegrationAnchors,
  requiredOnlineRoutes,
  requiredRepositoryPaths,
  retiredAgentGuidancePaths,
  retiredDocumentationRoots,
  retiredPointerPatterns,
  serverClientMarkers,
  stalePatterns,
  turboWildcardEnvTasks,
} from "./check-agent-instructions.policy";
import {
  createErrorCollector,
  findFiles,
  parseFrontmatter,
  pathExists,
  readJson,
  readUtf8,
  reportPatternHits,
  validateMarkdownLinks,
} from "./check-agent-instructions.utils";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { errors, addError, assert } = createErrorCollector();
const instructionDirectory = path.join(root, "docs", "agents", "instructions");
const routerPath = path.join(root, "AGENTS.md");
const workflowPath = path.join(root, "docs", "agents", "agent-workflows.md");
const legacyWorkflowPath = path.join(root, "docs", "agent-workflows.md");
const resolveRoot = (relativePath: string): string =>
  path.join(root, relativePath);

const checkInstructionInventory = async (): Promise<{
  instructionFiles: string[];
  router: string;
}> => {
  const instructionFiles = (await readdir(instructionDirectory))
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();
  const expectedFiles = Object.keys(expectedScopes).sort();
  assert(
    JSON.stringify(instructionFiles) === JSON.stringify(expectedFiles),
    `instruction inventory mismatch\n  expected: ${expectedFiles.join(", ")}\n  actual:   ${instructionFiles.join(", ")}`,
  );

  const router = await readUtf8(routerPath);
  const indexMatch = router.match(
    /<!-- AGENT-INSTRUCTION-INDEX-START -->([\s\S]*?)<!-- AGENT-INSTRUCTION-INDEX-END -->/u,
  );
  assert(indexMatch, "AGENTS.md: missing scoped instruction index markers");
  if (indexMatch) {
    const indexedFiles = [...indexMatch[1].matchAll(/`([^`]+\.md)`/gu)]
      .map((match) => match[1])
      .sort();
    assert(
      JSON.stringify(indexedFiles) === JSON.stringify(instructionFiles),
      `scoped instruction index mismatch\n  expected: ${instructionFiles.join(", ")}\n  actual:   ${indexedFiles.join(", ")}`,
    );
  }
  return { instructionFiles, router };
};

const checkRepositoryPaths = async (): Promise<void> => {
  for (const relativePath of requiredRepositoryPaths) {
    assert(
      await pathExists(resolveRoot(relativePath)),
      `required repository path is missing: ${relativePath}`,
    );
  }

  assert(
    !(await pathExists(legacyWorkflowPath)),
    "docs/agent-workflows.md is obsolete; keep overall agent guidance under docs/agents/",
  );

  for (const retiredPath of retiredAgentGuidancePaths) {
    assert(
      !(await pathExists(resolveRoot(retiredPath))),
      `${retiredPath}: retired agent-guidance path still exists`,
    );
  }

  for (const relativeRoot of retiredDocumentationRoots) {
    const files = await findFiles(resolveRoot(relativeRoot));
    assert(
      files.length === 0,
      `${relativeRoot}: retired documentation root contains files: ${files
        .map((filePath) => path.relative(root, filePath))
        .join(", ")}`,
    );
  }

  const downloadedNextCorpus = await findFiles(resolveRoot(".next-docs"));
  assert(
    downloadedNextCorpus.length === 0,
    ".next-docs: the legacy downloaded Next.js corpus is obsolete; remove the directory (Next.js 16.3+ bundles version-matched docs in the installed package)",
  );

  // This repository keeps exactly one root AGENTS.md. Both apps set
  // `agentRules: false` so Next.js can never create app-level agent files.
  for (const appName of await readdir(resolveRoot("apps"))) {
    for (const fileName of appAgentFileNames) {
      assert(
        !(await pathExists(resolveRoot(path.join("apps", appName, fileName)))),
        `apps/${appName}/${fileName}: app-level agent files are forbidden; keep the single root AGENTS.md`,
      );
    }
  }
};

const checkNextJsSetup = async (router: string): Promise<void> => {
  for (const { configPath, label } of nextConfigsToCheck) {
    const config = await readUtf8(resolveRoot(configPath));
    assert(
      /agentRules:\s*false/u.test(config),
      `${configPath}: set \`agentRules: false\` so Next.js never writes ${label} app-level agent files`,
    );
  }

  assert(
    router.includes("<!-- BEGIN:nextjs-agent-rules -->"),
    "AGENTS.md: missing the Next.js agent-rules block produced by the installed Next.js generator",
  );

  // Next.js is centralized: one catalog-pinned install, exposed at the repository
  // root so the managed agent-rules block resolves `node_modules/next/dist/docs`.
  // This also keeps the bundled version-matched docs single-sourced.
  let nextPackageJsonPath: string | undefined;
  try {
    nextPackageJsonPath = require.resolve("next/package.json", {
      paths: [root],
    }) as string;
  } catch {
    addError(
      "next is not resolvable from the repository root; the Next.js agent-rules block in AGENTS.md points at node_modules/next/dist/docs, so keep the single catalog install exposed with `publicHoistPattern: [next]` in pnpm-workspace.yaml",
    );
  }

  if (nextPackageJsonPath) {
    const installedNextVersion = (
      JSON.parse(await readUtf8(nextPackageJsonPath)) as { version: string }
    ).version;
    const catalogNextVersion = (
      await readUtf8(resolveRoot("pnpm-workspace.yaml"))
    ).match(/^[ \t]*next:[ \t]*([^\s#]+)/mu)?.[1];

    assert(
      catalogNextVersion,
      "pnpm-workspace.yaml: the catalog no longer pins a `next` version",
    );
    if (catalogNextVersion && catalogNextVersion !== installedNextVersion) {
      addError(
        `next version drift\n  catalog:   ${catalogNextVersion}\n  installed: ${installedNextVersion}`,
      );
    }

    const nextDocsEntry = path.join(
      path.dirname(nextPackageJsonPath),
      "dist",
      "docs",
      "index.md",
    );
    assert(
      await pathExists(nextDocsEntry),
      "the installed next package is missing its bundled docs entry node_modules/next/dist/docs/index.md",
    );

    if (router.includes("<!-- BEGIN:nextjs-agent-rules -->")) {
      const generator = require("next/dist/server/lib/generate-agent-files") as {
        hasCurrentAgentRules: (root: string) => boolean;
      };
      assert(
        generator.hasCurrentAgentRules(root),
        "AGENTS.md: the committed Next.js agent-rules block no longer matches the installed generator; refresh it from next/dist/server/lib/generate-agent-files",
      );
    }
  }

  for (const appName of await readdir(resolveRoot("apps"))) {
    const appDirectory = resolveRoot(path.join("apps", appName));
    const hasNextConfig = (await readdir(appDirectory)).some((entry) =>
      entry.startsWith("next.config."),
    );
    if (!hasNextConfig) continue;

    const manifestPath = path.join(appDirectory, "package.json");
    if (!(await pathExists(manifestPath))) {
      addError(`apps/${appName}: has a next.config but no package.json`);
      continue;
    }

    const manifest = (await readJson(manifestPath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declaredNext =
      manifest.dependencies?.next ?? manifest.devDependencies?.next;
    assert(
      declaredNext === "catalog:",
      `apps/${appName}/package.json: declare next as "catalog:" so the workspace keeps one Next.js install (found ${declaredNext ?? "nothing"})`,
    );
  }

  try {
    const agentStats = await lstat(routerPath);
    assert(
      agentStats.isFile() && !agentStats.isSymbolicLink(),
      "AGENTS.md must be a regular tracked file",
    );
  } catch {
    addError("AGENTS.md is missing");
  }
};

const checkScopedInstructions = async (
  instructionFiles: string[],
): Promise<string[]> => {
  const scannedFiles = [routerPath, workflowPath];
  for (const fileName of instructionFiles) {
    const filePath = path.join(instructionDirectory, fileName);
    const content = await readUtf8(filePath);
    scannedFiles.push(filePath);

    const frontmatter = parseFrontmatter(content, fileName, addError);
    for (const requiredKey of ["name", "description", "applyTo"]) {
      assert(
        frontmatter[requiredKey],
        `${fileName}: missing ${requiredKey} frontmatter`,
      );
    }
    assert(
      frontmatter.applyTo === expectedScopes[fileName],
      `${fileName}: applyTo drifted\n  expected: ${expectedScopes[fileName]}\n  actual:   ${frontmatter.applyTo ?? "<missing>"}`,
    );
    const lineCount = content.split("\n").length;
    assert(
      lineCount <= instructionLineBudget,
      `${fileName}: ${lineCount} lines exceeds the ${instructionLineBudget}-line instruction budget`,
    );
  }

  for (const filePath of scannedFiles) {
    const content = await readUtf8(filePath);
    reportPatternHits(
      content,
      stalePatterns,
      path.relative(root, filePath),
      addError,
    );
  }
  return scannedFiles;
};

const checkDocumentationRoutes = async (
  scannedFiles: string[],
): Promise<void> => {
  const integrationRegistry = await readUtf8(
    resolveRoot(path.join("docs", "agents", "integrations.md")),
  );
  for (const anchor of requiredIntegrationAnchors) {
    assert(
      integrationRegistry.includes(`<a id="${anchor}"></a>`),
      `docs/agents/integrations.md: missing integration anchor #${anchor}`,
    );
  }

  for (const [fileName, routes] of Object.entries(requiredOnlineRoutes)) {
    const instruction = await readUtf8(path.join(instructionDirectory, fileName));
    for (const route of routes) {
      assert(
        instruction.includes(route),
        `${fileName}: missing direct official route ${route}`,
      );
      assert(
        integrationRegistry.includes(route),
        `docs/agents/integrations.md: missing official route ${route}`,
      );
    }
  }

  const pointerFiles = new Set([
    ...scannedFiles,
    ...referenceFiles.map(resolveRoot),
  ]);
  for (const filePath of pointerFiles) {
    const content = await readUtf8(filePath);
    reportPatternHits(
      content,
      [agentPointerPattern, ...retiredPointerPatterns],
      path.relative(root, filePath),
      addError,
    );
    await validateMarkdownLinks(filePath, content, root, addError);
  }
};

const checkArchitectureInvariants = async (): Promise<void> => {
  const skillLock = (await readJson(resolveRoot("skills-lock.json"))) as {
    skills?: Record<string, { source?: string }>;
  };
  for (const [skillName, source] of Object.entries(officialSkillSources)) {
    assert(
      skillLock.skills?.[skillName]?.source === source,
      `${skillName}: expected official skill source ${source}`,
    );
  }

  const instrumentation = await readUtf8(
    resolveRoot(serverClientMarkers.instrumentationFile),
  );
  assert(
    instrumentation.includes(serverClientMarkers.instrumentationImport),
    "calculator instrumentation no longer initializes the server oRPC client",
  );

  const localeLayout = await readUtf8(
    resolveRoot(serverClientMarkers.localeLayoutFile),
  );
  assert(
    localeLayout.includes(serverClientMarkers.localeLayoutImport),
    "calculator locale layout no longer imports the server oRPC client",
  );

  const turboConfig = (await readJson(resolveRoot("turbo.json"))) as {
    tasks?: Record<string, { env?: string[] }>;
  };
  for (const taskName of turboWildcardEnvTasks) {
    const environment = turboConfig.tasks?.[taskName]?.env;
    assert(
      Array.isArray(environment) && environment.includes("*"),
      `turbo.json: ${taskName} task must preserve env: ["*"]`,
    );
  }
};

const checkDesignSystemLint = async (): Promise<void> => {
  // The design-system lint is a single root-level Oxlint JS plugin: the root config
  // registers it, the root manifest owns the version, and the lint task hashes both
  // so cached results cannot outlive a plugin or rule change. The policy is scoped
  // per the upstream adoption guide (strict where clean, deferred elsewhere):
  // cost-tracker enforces shadcn/no-restyle as an error, while calculator and
  // documentation keep the rule off until their migration. Promote a deferred app
  // by flipping its override to the strict shape once its findings are resolved.
  const lintConfig = (await readJson(resolveRoot(".oxlintrc.json"))) as {
    jsPlugins?: string[];
    rules?: Record<string, unknown>;
    overrides?: { files?: string[]; rules?: Record<string, unknown> }[];
  };
  assert(
    (lintConfig.jsPlugins ?? []).includes(designSystemPlugin),
    `.oxlintrc.json: register ${designSystemPlugin} in jsPlugins`,
  );

  const restyleRule = lintConfig.rules?.["shadcn/no-restyle"];
  assert(
    restyleRule === undefined || restyleRule === "off",
    `.oxlintrc.json: shadcn/no-restyle must not be enforced globally; scope it per app in overrides (found ${JSON.stringify(restyleRule)})`,
  );

  const findOverride = (file: string) =>
    (lintConfig.overrides ?? []).find((entry) => entry.files?.includes(file));

  const strictOverride = findOverride(designSystemStrictScope);
  assert(
    strictOverride,
    `.oxlintrc.json: missing the ${designSystemStrictScope} override that enforces shadcn/no-restyle`,
  );
  const [restyleSeverity, restyleOptions] = (
    Array.isArray(strictOverride?.rules?.["shadcn/no-restyle"])
      ? strictOverride?.rules?.["shadcn/no-restyle"]
      : [strictOverride?.rules?.["shadcn/no-restyle"]]
  ) as [unknown, { allow?: unknown } | undefined];
  assert(
    restyleSeverity === "error",
    `.oxlintrc.json: ${designSystemStrictScope} must enforce shadcn/no-restyle as "error" (found ${JSON.stringify(restyleSeverity)})`,
  );
  assert(
    JSON.stringify(restyleOptions?.allow) === JSON.stringify(["layout"]),
    `.oxlintrc.json: ${designSystemStrictScope} must allow layout classes (allow: ["layout"])`,
  );

  for (const deferredScope of designSystemDeferredScopes) {
    const override = findOverride(deferredScope);
    assert(
      override,
      `.oxlintrc.json: missing the ${deferredScope} override that defers shadcn/no-restyle`,
    );
    if (override) {
      assert(
        override.rules?.["shadcn/no-restyle"] === "off",
        `.oxlintrc.json: ${deferredScope} must turn shadcn/no-restyle off until its migration`,
      );
    }
  }

  const rootManifest = (await readJson(resolveRoot("package.json"))) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  assert(
    rootManifest.devDependencies?.[designSystemPlugin],
    `package.json: declare ${designSystemPlugin} as a root devDependency so one version serves the workspace`,
  );
  assert(
    rootManifest.scripts?.["lint:design-system"]?.includes(
      designSystemStrictScope.replace("/**", ""),
    ),
    "package.json: keep the focused `lint:design-system` script for the design-system rules, scoped to the enforced app",
  );

  const turboConfig = (await readJson(resolveRoot("turbo.json"))) as {
    tasks?: Record<string, { inputs?: string[] }>;
  };
  for (const lintInput of lintTaskInputs) {
    const inputs = turboConfig.tasks?.lint?.inputs;
    assert(
      Array.isArray(inputs) && inputs.includes(lintInput),
      `turbo.json: the lint task must hash ${lintInput} so design-system lint results are not cached across config or plugin changes`,
    );
  }
};

const main = async (): Promise<void> => {
  const { instructionFiles, router } = await checkInstructionInventory();
  await checkRepositoryPaths();
  await checkNextJsSetup(router);
  const scannedFiles = await checkScopedInstructions(instructionFiles);
  await checkDocumentationRoutes(scannedFiles);
  await checkArchitectureInvariants();
  await checkDesignSystemLint();

  if (errors.length > 0) {
    console.error("Agent instruction drift detected:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Agent instructions are synchronized (${instructionFiles.length} scoped files checked).`,
    );
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
