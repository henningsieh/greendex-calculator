import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const instructionDirectory = path.join(root, "docs", "agents", "instructions");
const routerPath = path.join(root, "AGENTS.md");
const workflowPath = path.join(root, "docs", "agents", "agent-workflows.md");
const legacyWorkflowPath = path.join(root, "docs", "agent-workflows.md");
const referenceFiles = [
  path.join(root, "README.md"),
  path.join(root, "CONTEXT-MAP.md"),
  path.join(root, "DOMAIN-GLOSSARY.md"),
  path.join(root, "docs", "README.md"),
  path.join(root, "docs", "projects", "README.md"),
  path.join(root, "docs", "projects", "model.md"),
  path.join(root, "docs", "projects", "permissions.md"),
  workflowPath,
  path.join(root, "apps", "calculator", "CONTEXT.md"),
  path.join(root, "apps", "calculator", "docs", "README.md"),
  path.join(root, "apps", "calculator", "docs", "participate", "README.md"),
  path.join(root, "apps", "calculator", "docs", "projects", "README.md"),
  path.join(root, "apps", "calculator", "docs", "projects", "permissions.md"),
  path.join(root, "apps", "calculator", "src", "lib", "orpc", "README.md"),
  path.join(root, "apps", "cost-tracker", "CONTEXT.md"),
  path.join(root, "apps", "cost-tracker", "docs", "README.md"),
  path.join(root, "apps", "cost-tracker", "docs", "domain-model.md"),
  path.join(root, "apps", "cost-tracker", "docs", "projects", "README.md"),
  path.join(
    root,
    "docs",
    "adr",
    "0001-model-project-organizations-and-participation.md",
  ),
  path.join(
    root,
    "docs",
    "adr",
    "0002-integrate-participants-with-better-auth.md",
  ),
  path.join(
    root,
    "docs",
    "adr",
    "0003-model-cost-submissions-and-travel-costs.md",
  ),
  path.join(root, "docs", "database", "README.md"),
  path.join(root, "docs", "agents", "integrations.md"),
];
const retiredDocumentationRoots = [
  "better-auth",
  "participate",
  "clickdummy",
  "fumadocs",
  "i18n",
  "next",
  "oxc",
  "orpc",
  "react-email",
  "shadcn",
  "tanstack-react-query",
].map((directory) => path.join("docs", directory));
const errors = [];
const instructionLineBudget = 180;

const expectedScopes = {
  "architecture.md":
    "apps/*/src/**/*.ts,apps/*/src/**/*.tsx,packages/*/src/**/*.ts,packages/*/src/**/*.tsx",
  "better-auth.md":
    "apps/calculator/src/lib/better-auth/**/*.ts,apps/calculator/src/features/authentication/**/*.ts,apps/calculator/src/features/authentication/**/*.tsx,apps/calculator/src/features/organizations/**/*.ts,apps/calculator/src/features/organizations/**/*.tsx,apps/calculator/src/features/projects/permissions.ts,apps/calculator/src/lib/orpc/middleware.ts,apps/calculator/src/lib/orpc/procedures.ts,apps/calculator/src/app/api/auth/**/*.ts,packages/database/src/schemas/auth-schema.ts",
  "code-standards.md":
    "apps/*/src/**/*.ts,apps/*/src/**/*.tsx,apps/*/src/**/*.js,apps/*/src/**/*.jsx,packages/*/src/**/*.ts,packages/*/src/**/*.tsx,packages/*/src/**/*.js,packages/*/src/**/*.jsx,scripts/**/*.js,scripts/**/*.mjs",
  "conventions.md":
    "package.json,apps/*/package.json,packages/*/package.json,pnpm-workspace.yaml,turbo.json,.node-version,apps/*/.env.example,.oxfmtrc.json,.oxlintrc.json,**/*.config.ts,**/*.config.mjs",
  "coolify.md":
    "apps/*/Dockerfile,apps/*/Dockerfile.*,docker-compose*.yml,docker-compose*.yaml,docs/database/**/*.md,apps/*/.env.example,turbo.json",
  "documentation-app.md":
    "apps/documentation/src/**/*.ts,apps/documentation/src/**/*.tsx,apps/documentation/source.config.ts",
  "drizzle.md":
    "packages/database/src/**/*.ts,packages/database/drizzle.config.ts,apps/calculator/src/lib/better-auth/index.ts,packages/database/src/schemas/auth-schema.ts",
  "email.md":
    "packages/email/src/**/*.ts,packages/email/src/**/*.tsx,apps/calculator/src/lib/email.ts",
  "i18n.md":
    "packages/i18n/src/**/*.ts,packages/i18n/src/locales/*.json,packages/config/src/languages.ts,apps/calculator/src/lib/i18n/**/*.ts,apps/calculator/src/proxy.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/calculator/src/app/sitemap.ts",
  "nuqs.md":
    "apps/calculator/src/components/providers/nuqs-adapter.tsx,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/cost-tracker/src/components/nuqs-provider.tsx,apps/cost-tracker/src/features/**/project-list-query-options.ts,apps/cost-tracker/src/features/**/components/**/*.tsx,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx",
  "orpc.md":
    "apps/calculator/src/lib/orpc/**/*.ts,apps/calculator/src/app/api/rpc/**/*.ts,apps/calculator/src/app/api/openapi/**/*.ts,apps/calculator/src/features/**/procedures.ts,apps/calculator/src/features/**/validation-schemas.ts,apps/calculator/src/instrumentation.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/cost-tracker/src/lib/orpc/**/*.ts,apps/cost-tracker/src/app/api/rpc/**/*.ts,apps/cost-tracker/src/features/**/procedures/*.ts,apps/cost-tracker/src/features/**/*procedure*.ts,apps/cost-tracker/src/features/**/validation-schemas.ts,apps/cost-tracker/src/instrumentation.ts,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx",
  "shadcn.md":
    "apps/calculator/src/components/**/*.ts,apps/calculator/src/components/**/*.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/cost-tracker/src/components/**/*.ts,apps/cost-tracker/src/components/**/*.tsx,apps/cost-tracker/src/features/**/components/**/*.ts,apps/cost-tracker/src/features/**/components/**/*.tsx",
  "tanstack-query.md":
    "apps/calculator/src/lib/tanstack-react-query/**/*.ts,apps/calculator/src/lib/tanstack-react-query/**/*.tsx,apps/calculator/src/components/providers/query-provider.tsx,apps/calculator/src/lib/orpc/orpc.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/features/**/hooks/**/*.ts,apps/calculator/src/features/**/hooks/**/*.tsx,apps/cost-tracker/src/lib/tanstack-react-query/**/*.ts,apps/cost-tracker/src/lib/tanstack-react-query/**/*.tsx,apps/cost-tracker/src/components/query-provider.tsx,apps/cost-tracker/src/lib/orpc/orpc.ts,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx,apps/cost-tracker/src/features/**/components/**/*.ts,apps/cost-tracker/src/features/**/components/**/*.tsx,apps/cost-tracker/src/features/**/hooks/**/*.ts,apps/cost-tracker/src/features/**/hooks/**/*.tsx",
  "tanstack-table.md":
    "apps/calculator/src/features/**/components/**/*table*.ts,apps/calculator/src/features/**/components/**/*table*.tsx,apps/calculator/src/features/**/__tests__/**/*table*.ts,apps/calculator/src/features/**/__tests__/**/*table*.tsx,apps/cost-tracker/src/features/**/components/**/*list*.tsx,apps/cost-tracker/src/features/**/components/**/*table*.tsx,apps/cost-tracker/src/features/**/__tests__/**/*table*.tsx",
  "workspace.md":
    "package.json,apps/*/package.json,packages/*/package.json,pnpm-workspace.yaml,turbo.json,.node-version",
};

const requiredOnlineRoutes = {
  "better-auth.md": [
    "https://better-auth.com/llms.txt",
    "https://better-auth.com/docs/llms.txt",
  ],
  "conventions.md": ["https://oxc.rs/llms.txt"],
  "coolify.md": [
    "https://coolify.io/docs/llms.txt",
    "https://coolify.io/docs/llms-full.txt",
  ],
  "documentation-app.md": ["https://fumadocs.vercel.app/llms.txt"],
  "drizzle.md": [
    "https://orm.drizzle.team/llms.txt",
    "https://orm.drizzle.team/llms-full.txt",
  ],
  "email.md": ["https://react.email/docs/llms.txt", "https://nodemailer.com/"],
  "i18n.md": [
    "https://next-intl.dev/docs",
    "https://github.com/michaelwittig/node-i18n-iso-countries",
    "https://gitlab.com/catamphetamine/country-flag-icons",
  ],
  "nuqs.md": [
    "https://nuqs.dev/llms.txt",
    "https://nuqs.dev/docs/adapters#nextjs-app-router",
  ],
  "orpc.md": [
    "https://v1.orpc.dev/docs/getting-started.md",
    "https://orpc.dev/llms.txt",
    "https://v1.orpc.dev/llms.txt",
  ],
  "shadcn.md": [
    "https://ui.shadcn.com/llms.txt",
    "https://github.com/shadcn-ui/lint",
  ],
  "tanstack-query.md": [
    "https://tanstack.com/query/latest/llms.txt",
    "https://tanstack.com/query/v5/llms.txt",
  ],
  "tanstack-table.md": ["https://tanstack.com/table/latest/llms.txt"],
};

const requiredIntegrationAnchors = [
  "better-auth",
  "coolify-deployment-and-api",
  "drizzle-orm-and-kit",
  "fumadocs",
  "next-intl-and-country-data",
  "nuqs",
  "orpc",
  "react-email",
  "shadcnui",
  "shadcn-lint",
  "tanstack-query",
  "tanstack-table",
];

const requiredRepositoryPaths = [
  ".node-version",
  "CONTEXT-MAP.md",
  "DOMAIN-GLOSSARY.md",
  "apps/calculator/CONTEXT.md",
  "apps/calculator/docs/README.md",
  "apps/cost-tracker/CONTEXT.md",
  "apps/cost-tracker/docs/README.md",
  "apps/cost-tracker/docs/domain-model.md",
  "apps/cost-tracker/docs/projects/README.md",
  "docs/adr",
  "docs/projects/README.md",
  "docs/projects/model.md",
  "docs/projects/permissions.md",
  "apps/calculator/.env.example",
  "apps/documentation/.env.example",
  ".oxfmtrc.json",
  ".oxlintrc.json",
  "apps/calculator/components.json",
  "apps/calculator/src/__tests__/e2e/project-routing.spec.ts",
  "apps/calculator/src/app/[locale]/layout.tsx",
  "apps/calculator/src/app/api/auth/[...all]/route.ts",
  "apps/calculator/src/app/api/openapi/[[...rest]]/route.ts",
  "apps/calculator/src/app/api/rpc/[[...rest]]/route.ts",
  "apps/calculator/src/env.ts",
  "apps/calculator/src/features/projects/permissions.ts",
  "apps/calculator/src/instrumentation.ts",
  "apps/calculator/src/lib/better-auth/index.ts",
  "apps/calculator/src/lib/email.ts",
  "apps/calculator/src/lib/i18n/routing.ts",
  "apps/calculator/src/lib/orpc/client.server.ts",
  "apps/calculator/src/lib/orpc/orpc.ts",
  "apps/calculator/src/lib/orpc/router.ts",
  "docs/agents/agent-workflows.md",
  "docs/agents/instructions",
  "docs/agents/integrations.md",
  ".agents/skills/better-auth-best-practices/SKILL.md",
  ".agents/skills/shadcn/SKILL.md",
  ".agents/skills/turborepo/SKILL.md",
  "skills-lock.json",
  "packages/config/src/languages.ts",
  "packages/database/src/schemas/auth-schema.ts",
  "packages/email/src/templates",
  "packages/i18n/src/locales",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
];

const agentPointerPattern = {
  pattern:
    /\.github\/(?:copilot-instructions\.md|instructions|prompts)(?:\/|\b)/u,
  message: "replace pointers to retired GitHub Copilot agent guidance",
};

const stalePatterns = [
  { pattern: /\bbunx\b/iu, message: "replace stale bunx guidance with pnpm" },
  { pattern: /\bpnpmx\b/iu, message: "replace the invalid pnpmx command" },
  { pattern: /pnpm\.lockb/iu, message: "use pnpm-lock.yaml" },
  agentPointerPattern,
  {
    pattern: /`src\/lib\/drizzle(?:\/|`)/u,
    message: "use packages/database paths",
  },
  {
    pattern: /`messages\/<locale>/u,
    message: "use packages/i18n/src/locales paths",
  },
  {
    pattern: /`src\/lib\/email(?:\/|`)/u,
    message: "use packages/email or the calculator email adapter path",
  },
  {
    pattern: /`src\/instrumentation\.ts`/u,
    message: "use the full calculator instrumentation path",
  },
  {
    pattern: /quick-start\.instructions\.md/u,
    message: "use docs/agents/agent-workflows.md for opt-in task routing",
  },
  {
    pattern: /NEXT-AGENTS-MD-START/u,
    message:
      "remove the legacy Next.js agents-md index; Next.js 16.3+ bundles version-matched docs in the installed package",
  },
];

const retiredPointerPatterns = [
  {
    pattern:
      /docs\/(?:better-auth|clickdummy|fumadocs|i18n|next|oxc|orpc|react-email|shadcn|tanstack-react-query)(?:\/|\b)/u,
    message: "replace pointers to retired vendor-documentation roots",
  },
  {
    pattern:
      /\]\((?:\.\.\/)*(?:better-auth|clickdummy|fumadocs|i18n|next|oxc|orpc|react-email|shadcn|tanstack-react-query)\//u,
    message: "replace relative pointers to retired vendor-documentation roots",
  },
  {
    pattern: /apps\/\*\/node_modules\/next\/dist\/docs/u,
    message:
      "point Next.js docs at the single root-resolvable node_modules/next/dist/docs",
  },
];

const addError = (message) => errors.push(message);
const readUtf8 = async (filePath) => readFile(filePath, "utf8");

const pathExists = async (targetPath) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const findFiles = async (directoryPath) => {
  if (!(await pathExists(directoryPath))) return [];

  const files = [];
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(entryPath)));
    else files.push(entryPath);
  }
  return files;
};

const parseFrontmatter = (content, fileName) => {
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

const validateMarkdownLinks = async (
  filePath,
  content,
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

const instructionFiles = (await readdir(instructionDirectory))
  .filter((fileName) => fileName.endsWith(".md"))
  .sort();
const expectedFiles = Object.keys(expectedScopes).sort();
if (JSON.stringify(instructionFiles) !== JSON.stringify(expectedFiles)) {
  addError(
    `instruction inventory mismatch\n  expected: ${expectedFiles.join(", ")}\n  actual:   ${instructionFiles.join(", ")}`,
  );
}

for (const relativePath of requiredRepositoryPaths) {
  if (!(await pathExists(path.join(root, relativePath)))) {
    addError(`required repository path is missing: ${relativePath}`);
  }
}

if (await pathExists(legacyWorkflowPath)) {
  addError(
    "docs/agent-workflows.md is obsolete; keep overall agent guidance under docs/agents/",
  );
}

for (const retiredPath of [
  ".github/copilot-instructions.md",
  ".github/instructions",
  ".github/prompts",
]) {
  if (await pathExists(path.join(root, retiredPath))) {
    addError(`${retiredPath}: retired agent-guidance path still exists`);
  }
}

for (const relativeRoot of retiredDocumentationRoots) {
  const files = await findFiles(path.join(root, relativeRoot));
  if (files.length > 0) {
    addError(
      `${relativeRoot}: retired documentation root contains files: ${files
        .map((filePath) => path.relative(root, filePath))
        .join(", ")}`,
    );
  }
}

const downloadedNextCorpus = await findFiles(path.join(root, ".next-docs"));
if (downloadedNextCorpus.length > 0) {
  addError(
    ".next-docs: the legacy downloaded Next.js corpus is obsolete; remove the directory (Next.js 16.3+ bundles version-matched docs in the installed package)",
  );
}

// This repository keeps exactly one root AGENTS.md. Both apps set
// `agentRules: false` so Next.js can never create app-level agent files.
const appAgentFileNames = [
  "AGENTS.md",
  "CLAUDE.md",
  "AGENTS.override.md",
  "AGENTS.MD",
  "CLAUDE.MD",
];
for (const appName of await readdir(path.join(root, "apps"))) {
  for (const fileName of appAgentFileNames) {
    const appAgentPath = path.join(root, "apps", appName, fileName);
    if (await pathExists(appAgentPath)) {
      addError(
        `apps/${appName}/${fileName}: app-level agent files are forbidden; keep the single root AGENTS.md`,
      );
    }
  }
}

for (const [configPath, label] of [
  ["apps/calculator/next.config.ts", "calculator"],
  ["apps/documentation/next.config.mjs", "documentation"],
]) {
  const config = await readUtf8(path.join(root, configPath));
  if (!/agentRules:\s*false/u.test(config)) {
    addError(
      `${configPath}: set \`agentRules: false\` so Next.js never writes ${label} app-level agent files`,
    );
  }
}

const router = await readUtf8(routerPath);

if (!router.includes("<!-- BEGIN:nextjs-agent-rules -->")) {
  addError(
    "AGENTS.md: missing the Next.js agent-rules block produced by the installed Next.js generator",
  );
}

// Next.js is centralized: one catalog-pinned install, exposed at the repository
// root so the managed agent-rules block resolves `node_modules/next/dist/docs`.
// This also keeps the bundled version-matched docs single-sourced.
let nextPackageJsonPath;
try {
  nextPackageJsonPath = require.resolve("next/package.json", { paths: [root] });
} catch {
  addError(
    "next is not resolvable from the repository root; the Next.js agent-rules block in AGENTS.md points at node_modules/next/dist/docs, so keep the single catalog install exposed with `publicHoistPattern: [next]` in pnpm-workspace.yaml",
  );
}

if (nextPackageJsonPath) {
  const installedNextVersion = JSON.parse(
    await readUtf8(nextPackageJsonPath),
  ).version;
  const catalogNextVersion = (
    await readUtf8(path.join(root, "pnpm-workspace.yaml"))
  ).match(/^[ \t]*next:[ \t]*([^\s#]+)/mu)?.[1];

  if (!catalogNextVersion) {
    addError("pnpm-workspace.yaml: the catalog no longer pins a `next` version");
  } else if (catalogNextVersion !== installedNextVersion) {
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
  if (!(await pathExists(nextDocsEntry))) {
    addError(
      "the installed next package is missing its bundled docs entry node_modules/next/dist/docs/index.md",
    );
  }

  if (router.includes("<!-- BEGIN:nextjs-agent-rules -->")) {
    const generator = require("next/dist/server/lib/generate-agent-files");
    if (!generator.hasCurrentAgentRules(root)) {
      addError(
        "AGENTS.md: the committed Next.js agent-rules block no longer matches the installed generator; refresh it from next/dist/server/lib/generate-agent-files",
      );
    }
  }
}

for (const appName of await readdir(path.join(root, "apps"))) {
  const appDirectory = path.join(root, "apps", appName);
  const hasNextConfig = (await readdir(appDirectory)).some((entry) =>
    entry.startsWith("next.config."),
  );
  if (!hasNextConfig) continue;

  const manifestPath = path.join(appDirectory, "package.json");
  if (!(await pathExists(manifestPath))) {
    addError(`apps/${appName}: has a next.config but no package.json`);
    continue;
  }

  const manifest = JSON.parse(await readUtf8(manifestPath));
  const declaredNext =
    manifest.dependencies?.next ?? manifest.devDependencies?.next;
  if (declaredNext !== "catalog:") {
    addError(
      `apps/${appName}/package.json: declare next as "catalog:" so the workspace keeps one Next.js install (found ${declaredNext ?? "nothing"})`,
    );
  }
}

const indexMatch = router.match(
  /<!-- AGENT-INSTRUCTION-INDEX-START -->([\s\S]*?)<!-- AGENT-INSTRUCTION-INDEX-END -->/u,
);
if (!indexMatch) {
  addError("AGENTS.md: missing scoped instruction index markers");
} else {
  const indexedFiles = [...indexMatch[1].matchAll(/`([^`]+\.md)`/gu)]
    .map((match) => match[1])
    .sort();
  if (JSON.stringify(indexedFiles) !== JSON.stringify(instructionFiles)) {
    addError(
      `scoped instruction index mismatch\n  expected: ${instructionFiles.join(", ")}\n  actual:   ${indexedFiles.join(", ")}`,
    );
  }
}

try {
  const agentStats = await lstat(routerPath);
  if (!agentStats.isFile() || agentStats.isSymbolicLink()) {
    addError("AGENTS.md must be a regular tracked file");
  }
} catch {
  addError("AGENTS.md is missing");
}

const scannedFiles = [routerPath, workflowPath];
for (const fileName of instructionFiles) {
  const filePath = path.join(instructionDirectory, fileName);
  const content = await readUtf8(filePath);
  scannedFiles.push(filePath);

  const frontmatter = parseFrontmatter(content, fileName);
  for (const requiredKey of ["name", "description", "applyTo"]) {
    if (!frontmatter[requiredKey])
      addError(`${fileName}: missing ${requiredKey} frontmatter`);
  }
  if (frontmatter.applyTo !== expectedScopes[fileName]) {
    addError(
      `${fileName}: applyTo drifted\n  expected: ${expectedScopes[fileName]}\n  actual:   ${frontmatter.applyTo ?? "<missing>"}`,
    );
  }
  const lineCount = content.split("\n").length;
  if (lineCount > instructionLineBudget) {
    addError(
      `${fileName}: ${lineCount} lines exceeds the ${instructionLineBudget}-line instruction budget`,
    );
  }
}

const integrationRegistry = await readUtf8(
  path.join(root, "docs", "agents", "integrations.md"),
);
for (const anchor of requiredIntegrationAnchors) {
  if (!integrationRegistry.includes(`<a id="${anchor}"></a>`)) {
    addError(
      `docs/agents/integrations.md: missing integration anchor #${anchor}`,
    );
  }
}

for (const [fileName, routes] of Object.entries(requiredOnlineRoutes)) {
  const instruction = await readUtf8(path.join(instructionDirectory, fileName));
  for (const route of routes) {
    if (!instruction.includes(route)) {
      addError(`${fileName}: missing direct official route ${route}`);
    }
    if (!integrationRegistry.includes(route)) {
      addError(`docs/agents/integrations.md: missing official route ${route}`);
    }
  }
}

const skillLock = JSON.parse(await readUtf8(path.join(root, "skills-lock.json")));
const officialSkillSources = {
  "better-auth-best-practices": "better-auth/skills",
  shadcn: "shadcn-ui/ui",
  turborepo: "vercel/turborepo",
};
for (const [skillName, source] of Object.entries(officialSkillSources)) {
  if (skillLock.skills?.[skillName]?.source !== source) {
    addError(`${skillName}: expected official skill source ${source}`);
  }
}

for (const filePath of scannedFiles) {
  const content = await readUtf8(filePath);
  const relativePath = path.relative(root, filePath);
  for (const { pattern, message } of stalePatterns) {
    if (pattern.test(content)) addError(`${relativePath}: ${message}`);
  }
}

const pointerFiles = new Set([...scannedFiles, ...referenceFiles]);
for (const filePath of pointerFiles) {
  const content = await readUtf8(filePath);
  const relativePath = path.relative(root, filePath);
  for (const { pattern, message } of [
    agentPointerPattern,
    ...retiredPointerPatterns,
  ]) {
    if (pattern.test(content)) addError(`${relativePath}: ${message}`);
  }
  await validateMarkdownLinks(filePath, content);
}

const instrumentation = await readUtf8(
  path.join(root, "apps/calculator/src/instrumentation.ts"),
);
if (!instrumentation.includes('await import("@/lib/orpc/client.server")')) {
  addError(
    "calculator instrumentation no longer initializes the server oRPC client",
  );
}

const localeLayout = await readUtf8(
  path.join(root, "apps/calculator/src/app/[locale]/layout.tsx"),
);
if (!localeLayout.includes('import "@/lib/orpc/client.server";')) {
  addError("calculator locale layout no longer imports the server oRPC client");
}

const turboConfig = JSON.parse(await readUtf8(path.join(root, "turbo.json")));
for (const taskName of ["build", "start"]) {
  const environment = turboConfig.tasks?.[taskName]?.env;
  if (!Array.isArray(environment) || !environment.includes("*")) {
    addError(`turbo.json: ${taskName} task must preserve env: ["*"]`);
  }
}

// The design-system lint is a single root-level Oxlint JS plugin: the root config
// registers it, the root manifest owns the version, and the lint task hashes both
// so cached results cannot outlive a plugin or rule change.
const designSystemPlugin = "@shadcn/lint";
const lintConfig = JSON.parse(await readUtf8(path.join(root, ".oxlintrc.json")));
if (!(lintConfig.jsPlugins ?? []).includes(designSystemPlugin)) {
  addError(`.oxlintrc.json: register ${designSystemPlugin} in jsPlugins`);
}

const restyleRule = lintConfig.rules?.["shadcn/no-restyle"];
const [restyleSeverity, restyleOptions] = Array.isArray(restyleRule)
  ? restyleRule
  : [restyleRule];
if (restyleSeverity !== "error") {
  addError(
    `.oxlintrc.json: shadcn/no-restyle must be "error" once its findings are resolved (found ${JSON.stringify(restyleSeverity)})`,
  );
}
if (JSON.stringify(restyleOptions?.allow) !== JSON.stringify(["layout"])) {
  addError(
    `.oxlintrc.json: shadcn/no-restyle must allow layout classes (allow: ["layout"])`,
  );
}

for (const componentDirectory of [
  "apps/calculator/src/components/ui/**",
  "apps/documentation/src/components/ui/**",
]) {
  const override = (lintConfig.overrides ?? []).find((entry) =>
    entry.files?.includes(componentDirectory),
  );
  if (!override) {
    addError(
      `.oxlintrc.json: missing the ${componentDirectory} override that lets components style themselves`,
    );
  } else if (override.rules?.["shadcn/no-restyle"] !== "off") {
    addError(
      `.oxlintrc.json: ${componentDirectory} must turn shadcn/no-restyle off`,
    );
  }
}

const rootManifest = JSON.parse(await readUtf8(path.join(root, "package.json")));
if (!rootManifest.devDependencies?.[designSystemPlugin]) {
  addError(
    `package.json: declare ${designSystemPlugin} as a root devDependency so one version serves the workspace`,
  );
}
if (!rootManifest.scripts?.["lint:design-system"]) {
  addError(
    "package.json: keep the focused `lint:design-system` script for the design-system rules",
  );
}

for (const lintInput of [
  "$TURBO_ROOT$/.oxlintrc.json",
  "$TURBO_ROOT$/package.json",
  "$TURBO_ROOT$/pnpm-lock.yaml",
]) {
  const inputs = turboConfig.tasks?.lint?.inputs;
  if (!Array.isArray(inputs) || !inputs.includes(lintInput)) {
    addError(
      `turbo.json: the lint task must hash ${lintInput} so design-system lint results are not cached across config or plugin changes`,
    );
  }
}

if (errors.length > 0) {
  console.error("Agent instruction drift detected:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Agent instructions are synchronized (${instructionFiles.length} scoped files checked).`,
  );
}
