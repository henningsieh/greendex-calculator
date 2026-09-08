import { lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const instructionDirectory = path.join(root, "docs", "agents", "instructions");
const routerPath = path.join(root, "AGENTS.md");
const workflowPath = path.join(root, "docs", "agents", "agent-workflows.md");
const legacyWorkflowPath = path.join(root, "docs", "agent-workflows.md");
const referenceFiles = [
  path.join(root, "README.md"),
  path.join(root, "docs", "README.md"),
  workflowPath,
  path.join(root, "apps", "calculator", "src", "lib", "orpc", "README.md"),
  path.join(root, "docs", "projects", "README.md"),
  path.join(root, "docs", "database", "README.md"),
  path.join(root, "docs", "agents", "integrations.md"),
];
const retiredDocumentationRoots = [
  "better-auth",
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
  "orpc.md":
    "apps/calculator/src/lib/orpc/**/*.ts,apps/calculator/src/app/api/rpc/**/*.ts,apps/calculator/src/app/api/openapi/**/*.ts,apps/calculator/src/features/**/procedures.ts,apps/calculator/src/features/**/validation-schemas.ts,apps/calculator/src/instrumentation.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx",
  "shadcn.md":
    "apps/calculator/src/components/**/*.ts,apps/calculator/src/components/**/*.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx",
  "tanstack-query.md":
    "apps/calculator/src/lib/tanstack-react-query/**/*.ts,apps/calculator/src/lib/tanstack-react-query/**/*.tsx,apps/calculator/src/components/providers/query-provider.tsx,apps/calculator/src/lib/orpc/orpc.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/features/**/hooks/**/*.ts,apps/calculator/src/features/**/hooks/**/*.tsx",
  "tanstack-table.md":
    "apps/calculator/src/features/**/components/**/*table*.ts,apps/calculator/src/features/**/components/**/*table*.tsx,apps/calculator/src/features/**/__tests__/**/*table*.ts,apps/calculator/src/features/**/__tests__/**/*table*.tsx",
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
  "orpc.md": [
    "https://v1.orpc.dev/docs/getting-started.md",
    "https://orpc.dev/llms.txt",
    "https://v1.orpc.dev/llms.txt",
  ],
  "shadcn.md": ["https://ui.shadcn.com/llms.txt"],
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
  "orpc",
  "react-email",
  "shadcnui",
  "tanstack-query",
  "tanstack-table",
];

const requiredRepositoryPaths = [
  ".node-version",
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

const isOptionalGeneratedNextDocumentationIndex = (filePath, rawTarget) =>
  filePath === workflowPath && rawTarget === "../../.next-docs/index.mdx";

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
    if (
      !(await pathExists(absoluteTarget)) &&
      !isOptionalGeneratedNextDocumentationIndex(filePath, rawTarget)
    ) {
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

const router = await readUtf8(routerPath);
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
    if (!frontmatter[requiredKey]) addError(`${fileName}: missing ${requiredKey} frontmatter`);
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
    addError(`docs/agents/integrations.md: missing integration anchor #${anchor}`);
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

const skillLock = JSON.parse(
  await readUtf8(path.join(root, "skills-lock.json")),
);
const officialSkillSources = {
  "better-auth-best-practices": "better-auth/skills",
  shadcn: "shadcn-ui/ui",
};
for (const [skillName, source] of Object.entries(officialSkillSources)) {
  if (skillLock.skills?.[skillName]?.source !== source) {
    addError(`${skillName}: expected official skill source ${source}`);
  }
}

const rootManifest = JSON.parse(await readUtf8(path.join(root, "package.json")));
for (const tablePackage of ["@tanstack/react-table", "@tanstack/table-core"]) {
  if (!rootManifest.intent?.skills?.includes(tablePackage)) {
    addError(`package.json: Intent discovery is missing ${tablePackage}`);
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
  addError("calculator instrumentation no longer initializes the server oRPC client");
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

if (errors.length > 0) {
  console.error("Agent instruction drift detected:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Agent instructions are synchronized (${instructionFiles.length} scoped files checked).`,
  );
}
