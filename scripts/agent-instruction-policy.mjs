/**
 * Declarative policy for scripts/check-agent-instructions.mjs.
 *
 * This module owns *what* is checked (paths, scopes, routes, patterns) but
 * never touches the filesystem. Filesystem and Markdown helpers live in
 * ./agent-check-utils.mjs; orchestration lives in
 * ./check-agent-instructions.mjs.
 */

export const instructionLineBudget = 180;

export const expectedScopes = {
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

export const requiredOnlineRoutes = {
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

export const requiredIntegrationAnchors = [
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

export const requiredRepositoryPaths = [
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

/** Extra files scanned for retired pointers (beyond the router and workflow). */
export const referenceFiles = [
  "README.md",
  "CONTEXT-MAP.md",
  "DOMAIN-GLOSSARY.md",
  "docs/README.md",
  "docs/projects/README.md",
  "docs/projects/model.md",
  "docs/projects/permissions.md",
  "docs/agents/agent-workflows.md",
  "apps/calculator/CONTEXT.md",
  "apps/calculator/docs/README.md",
  "apps/calculator/docs/participate/README.md",
  "apps/calculator/docs/projects/README.md",
  "apps/calculator/docs/projects/permissions.md",
  "apps/calculator/src/lib/orpc/README.md",
  "apps/cost-tracker/CONTEXT.md",
  "apps/cost-tracker/docs/README.md",
  "apps/cost-tracker/docs/domain-model.md",
  "apps/cost-tracker/docs/projects/README.md",
  "docs/adr/0001-model-project-organizations-and-participation.md",
  "docs/adr/0002-integrate-participants-with-better-auth.md",
  "docs/adr/0003-model-cost-submissions-and-travel-costs.md",
  "docs/database/README.md",
  "docs/agents/integrations.md",
];

export const retiredDocumentationRoots = [
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
].map((directory) => `docs/${directory}`);

export const agentPointerPattern = {
  pattern:
    /\.github\/(?:copilot-instructions\.md|instructions|prompts)(?:\/|\b)/u,
  message: "replace pointers to retired GitHub Copilot agent guidance",
};

export const stalePatterns = [
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

const retiredVendorRoots =
  "(?:better-auth|clickdummy|fumadocs|i18n|next|oxc|orpc|react-email|shadcn|tanstack-react-query)";

export const retiredPointerPatterns = [
  {
    // Anchored with (?<![\w/]) so app-owned documentation such as
    // apps/cost-tracker/docs/clickdummy/ never matches: only the retired
    // root-level docs/ roots are flagged.
    pattern: new RegExp(`(?<![\\w/])docs/${retiredVendorRoots}(?:/|\\b)`, "u"),
    message: "replace pointers to retired vendor-documentation roots",
  },
  {
    pattern: new RegExp(
      `\\]\\((?:\\.\\./)+(?:better-auth|fumadocs|i18n|next|oxc|orpc|react-email|shadcn|tanstack-react-query)/`,
      "u",
    ),
    message: "replace relative pointers to retired vendor-documentation roots",
  },
  {
    pattern: /apps\/\*\/node_modules\/next\/dist\/docs/u,
    message:
      "point Next.js docs at the single root-resolvable node_modules/next/dist/docs",
  },
];

export const officialSkillSources = {
  "better-auth-best-practices": "better-auth/skills",
  shadcn: "shadcn-ui/ui",
  turborepo: "vercel/turborepo",
};

/** App-level agent files are forbidden; the root AGENTS.md is the only one. */
export const appAgentFileNames = [
  "AGENTS.md",
  "CLAUDE.md",
  "AGENTS.override.md",
  "AGENTS.MD",
  "CLAUDE.MD",
];

export const nextConfigsToCheck = [
  { configPath: "apps/calculator/next.config.ts", label: "calculator" },
  { configPath: "apps/documentation/next.config.mjs", label: "documentation" },
];

export const retiredAgentGuidancePaths = [
  ".github/copilot-instructions.md",
  ".github/instructions",
  ".github/prompts",
];

/** oRPC invariant: both server-side initialization paths must survive. */
export const serverClientMarkers = {
  instrumentationFile: "apps/calculator/src/instrumentation.ts",
  instrumentationImport: 'await import("@/lib/orpc/client.server")',
  localeLayoutFile: "apps/calculator/src/app/[locale]/layout.tsx",
  localeLayoutImport: 'import "@/lib/orpc/client.server";',
};

/** Turbo tasks that must preserve env: ["*"] for injected variables. */
export const turboWildcardEnvTasks = ["build", "start"];

export const designSystemPlugin = "@shadcn/lint";
export const designSystemComponentOverrides = [
  "apps/calculator/src/components/ui/**",
  "apps/documentation/src/components/ui/**",
];
export const lintTaskInputs = [
  "$TURBO_ROOT$/.oxlintrc.json",
  "$TURBO_ROOT$/package.json",
  "$TURBO_ROOT$/pnpm-lock.yaml",
];

/**
 * Test a text against a pattern list without leaking RegExp lastIndex state.
 * Exported for focused unit tests of the policy matchers.
 */
export const findPatternHits = (text, patterns) =>
  patterns.filter(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });

export const matchesStaleGuidance = (text) =>
  findPatternHits(text, stalePatterns).length > 0;

export const matchesRetiredVendorPointer = (text) =>
  findPatternHits(text, retiredPointerPatterns).length > 0;
