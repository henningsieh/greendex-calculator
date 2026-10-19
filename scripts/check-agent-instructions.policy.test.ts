import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  orpcGuidanceFiles,
  oldMajorOrpcUrlPattern,
  expectedScopes,
  instructionLineBudget,
  findPatternHits,
  matchesRetiredVendorPointer,
  matchesStaleGuidance,
  retiredPointerPatterns,
  referenceFiles,
  retiredAgentGuidancePaths,
  requiredRepositoryPaths,
  requiredOnlineRoutes,
  stalePatterns,
} from "./check-agent-instructions.policy";
import { validateMarkdownLinks } from "./check-agent-instructions.utils";

describe("oRPC documentation major", () => {
  it("keeps architecture SSR guidance on v2 and rejects old-major URLs", async () => {
    const guidance = await readFile(
      new URL("../docs/agents/instructions/architecture.md", import.meta.url),
      "utf8",
    );
    expect(orpcGuidanceFiles).toContain(
      "docs/agents/instructions/architecture.md",
    );
    expect(guidance).toContain("https://orpc.dev/docs/recipes/optimizing-ssr.md");
    for (const filePath of orpcGuidanceFiles) {
      const text = await readFile(
        new URL(`../${filePath}`, import.meta.url),
        "utf8",
      );
      expect(text).not.toMatch(oldMajorOrpcUrlPattern);
    }
    expect(matchesStaleGuidance(guidance)).toBe(false);
    expect(
      "[official v1 SSR guide](https://v1.orpc.dev/docs/best-practices/optimize-ssr.md)",
    ).toMatch(oldMajorOrpcUrlPattern);
  });
  it("routes working instructions and the registry only to v2", async () => {
    expect(requiredOnlineRoutes["orpc.md"]).toEqual([
      "https://orpc.dev/docs/getting-started.md",
      "https://orpc.dev/llms.txt",
    ]);
    for (const filePath of [
      "docs/agents/instructions/orpc.md",
      "docs/agents/integrations.md",
    ]) {
      const guidance = await readFile(
        new URL(`../${filePath}`, import.meta.url),
        "utf8",
      );
      for (const route of requiredOnlineRoutes["orpc.md"]) {
        expect(guidance).toContain(route);
      }
      expect(guidance).not.toContain("v1.orpc.dev");
      expect(guidance).not.toMatch(/generate-sri|check-sri|scalarVersion/u);
    }
  });
});

describe("retired vendor-documentation pointer matcher", () => {
  it("flags pointers to retired root-level docs roots", () => {
    expect(matchesRetiredVendorPointer("see docs/clickdummy/old-guide")).toBe(
      true,
    );
    expect(matchesRetiredVendorPointer("see (docs/next/migrated)")).toBe(true);
    expect(matchesRetiredVendorPointer("docs/orpc")).toBe(true);
  });

  it("ignores app-owned documentation such as apps/cost-tracker/docs/clickdummy/", () => {
    expect(
      matchesRetiredVendorPointer(
        "see apps/cost-tracker/docs/clickdummy/requirements-traceability.md",
      ),
    ).toBe(false);
    expect(
      matchesRetiredVendorPointer("see apps/calculator/docs/i18n/routing.md"),
    ).toBe(false);
  });

  it("still flags relative pointers that climb out to retired roots", () => {
    expect(
      matchesRetiredVendorPointer("see [legacy](../../../orpc/procedures.md)"),
    ).toBe(true);
  });

  it("ignores app-local relative links into app-owned docs", () => {
    expect(
      matchesRetiredVendorPointer(
        "see [traceability](clickdummy/requirements-traceability.md)",
      ),
    ).toBe(false);
  });

  it("still flags the single root-resolvable Next.js docs guidance", () => {
    expect(
      matchesRetiredVendorPointer(
        "use apps/*/node_modules/next/dist/docs for versioned docs",
      ),
    ).toBe(true);
  });

  it("reports the exact offending message for root pointers", () => {
    const hits = findPatternHits("see docs/shadcn/theme", retiredPointerPatterns);
    expect(hits.map((hit) => hit.message)).toEqual([
      "replace pointers to retired vendor-documentation roots",
    ]);
  });
});

describe("stale guidance matcher", () => {
  it.each(["CONTEXT.md", "CONTEXT-MAP.md", "DOMAIN-GLOSSARY.md"])(
    "flags retired glossary guidance: %s",
    (fileName) => {
      expect(matchesStaleGuidance(`read apps/example/${fileName}`)).toBe(true);
    },
  );

  it("accepts the current glossary layout", () => {
    expect(matchesStaleGuidance("read GLOSSARY-MAP.md and GLOSSARY.md")).toBe(
      false,
    );
  });
  it("flags stale package-manager guidance", () => {
    expect(matchesStaleGuidance("run bunx install")).toBe(true);
    expect(matchesStaleGuidance("see pnpm.lockb for details")).toBe(true);
  });

  it("passes clean guidance", () => {
    expect(matchesStaleGuidance("run pnpm install")).toBe(false);
  });

  it("does not treat unrelated pattern lists as stale", () => {
    expect(findPatternHits("run pnpm install", stalePatterns)).toEqual([]);
  });
});

describe("glossary migration coverage", () => {
  it("requires and checks the map, glossaries, domain route, and extracted behavior", () => {
    for (const filePath of [
      "GLOSSARY.md",
      "GLOSSARY-MAP.md",
      "apps/calculator/GLOSSARY.md",
      "apps/cost-tracker/GLOSSARY.md",
      "apps/documentation/GLOSSARY.md",
      "docs/agents/domain.md",
      "apps/cost-tracker/docs/domain-behavior.md",
    ]) {
      expect(requiredRepositoryPaths).toContain(filePath);
      expect(referenceFiles).toContain(filePath);
    }
  });

  it("retires the previous shared glossary and app context paths", () => {
    for (const filePath of [
      "DOMAIN-GLOSSARY.md",
      "CONTEXT.md",
      "CONTEXT-MAP.md",
      "apps/calculator/CONTEXT.md",
      "apps/cost-tracker/CONTEXT.md",
      "apps/documentation/CONTEXT.md",
    ]) {
      expect(retiredAgentGuidancePaths).toContain(filePath);
      expect(requiredRepositoryPaths).not.toContain(filePath);
      expect(referenceFiles).not.toContain(filePath);
    }
  });
});

describe("project permissions instruction policy", () => {
  it("keeps the project permissions document in the reference scan", () => {
    expect(referenceFiles).toContain("docs/projects/permissions.md");
    expect(requiredRepositoryPaths).toContain("docs/projects/permissions.md");
  });

  it("tracks the shared auth permission and organization-role modules", () => {
    const authModulePaths = [
      "packages/auth/src/permissions.ts",
      "packages/auth/src/organization-roles.ts",
    ];
    const betterAuthScopes = expectedScopes["better-auth.md"].split(",");

    for (const path of authModulePaths) {
      expect(requiredRepositoryPaths).toContain(path);
      expect(betterAuthScopes).toContain(path);
    }
  });

  it("accepts source links from the rewritten project permissions document", () => {
    const sourceLinks = [
      "../../packages/auth/src/permissions.ts",
      "../../packages/auth/src/organization-roles.ts",
      "../../packages/config/src/organization-roles.ts",
      "../../apps/calculator/src/features/projects/procedures.ts",
    ];

    for (const path of sourceLinks) {
      const link = `[source](${path})`;
      expect(matchesRetiredVendorPointer(link)).toBe(false);
      expect(matchesStaleGuidance(link)).toBe(false);
    }
  });
});

const verificationGuidanceFiles = [
  ["AGENTS.md", "docs/agents/instructions/conventions.md#two-verification-loops"],
  [
    "docs/agents/agent-workflows.md",
    "instructions/conventions.md#two-verification-loops",
  ],
  [
    "docs/agents/delegation.md",
    "instructions/conventions.md#two-verification-loops",
  ],
  [
    "docs/agents/instructions/code-standards.md",
    "conventions.md#two-verification-loops",
  ],
] as const;

const verificationPolicyClauses = [
  [
    "risk-based selection",
    [
      "smallest meaningful checks",
      "Record the selection rationale",
      "Expand coverage for shared auth, schema, router, SSR, or persistence",
    ],
  ],
  [
    "server-free pure checks",
    [
      "Keep pure unit/component checks server-free",
      "Direct database, migration, and service tests retain their appropriate seams",
    ],
  ],
  [
    "dev runtime evidence",
    [
      "isolated running dev server",
      "Next MCP routes, errors, and compilation diagnostics",
      "real browser observations before and after",
    ],
  ],
  [
    "production-only exception",
    [
      "smallest dedicated production-build check",
      "Dev results do not prove production behavior",
    ],
  ],
  [
    "central resource ownership",
    [
      "One coordinator owns heavy builds and full gates after all writers finish",
      "heavy work sequentially",
      "bounded browser/server concurrency",
      "do not launch competing full runs",
    ],
  ],
  [
    "preserved non-browser contract",
    [
      "complete existing `pnpm test` non-browser contract",
      "real mail, and storage",
      "failure and cleanup semantics",
    ],
  ],
  [
    "honest planned command",
    [
      "**PLANNED, unavailable until #284:** `pnpm run test:full`",
      "#289 verifies final consistency",
      "production acceptance is blocked",
      "Current commands do not prove this planned gate",
    ],
  ],
  [
    "production final targets",
    [
      "production build/start artifacts from the reviewed candidate",
      "runtime-dependent non-browser HTTP checks",
      "Production start does not require dev MCP",
    ],
  ],
  [
    "instant isolation",
    [
      "separate build-time test-enabled artifact",
      "without ordinary login setup or inherited auth state",
      "Ordinary Calculator production verification keeps the testing API disabled",
    ],
  ],
  [
    "safe lifecycle",
    [
      "run database for browser/cross-app workflows",
      "Keep dev and production variants separate",
      "Never kill unowned listeners",
      "generated declarations",
      "required socket service",
    ],
  ],
  [
    "live-service safety",
    [
      "dedicated-mailbox/current-run correlation",
      "default mail retention",
      "development Garage isolation",
      "owned-object cleanup",
      "sanitized evidence",
      "Missing services or credentials are blockers",
    ],
  ],
  [
    "two-axis review and repair",
    [
      "independent Standards and Spec reviews of the same integration candidate",
      "bounded focused repairs",
      "review the changed final diff again",
      "complete final matrix for the resulting candidate",
    ],
  ],
  [
    "strict final outcomes",
    [
      "zero flaky final acceptance",
      "verified failure on retry-pass",
      "unaccounted skip",
      "cleanup failure makes acceptance fail",
      "Continue independent safe groups",
    ],
  ],
  [
    "candidate evidence",
    [
      "exact candidate, build variants, runtime targets, suite inventory, results, timings",
      "Source/build-affecting changes invalidate relevant evidence",
      "No fixed count of repeated green full runs",
    ],
  ],
  [
    "retained quality gates",
    [
      "`pnpm run format`",
      "`pnpm run lint`",
      "design-system checks",
      "`pnpm run type-check`",
      "affected SSR regressions",
      "persistence checks",
      "instruction-policy checks",
      "diff review",
    ],
  ],
] as const;

describe("two-loop verification instruction policy", () => {
  it.each(verificationGuidanceFiles)(
    "routes %s to the single policy owner",
    async (file, target) => {
      const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
      expect(text).toContain(`](${target})`);
      expect(text).not.toMatch(/pnpm run type-check\s*\npnpm run test:run/u);
    },
  );

  it.each(verificationPolicyClauses)("retains %s", async (_name, clauses) => {
    const text = await readFile(
      new URL("../docs/agents/instructions/conventions.md", import.meta.url),
      "utf8",
    );
    for (const clause of clauses) expect(text).toContain(clause);
  });

  it("keeps current aggregate commands distinct from planned production acceptance", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.scripts.test).toBe(
      "tsx apps/cost-tracker/scripts/run-nonbrowser-tests.ts",
    );
    expect(manifest.scripts["test:run"]).toBe("pnpm test");
    expect(manifest.scripts["test:full"]).toBeUndefined();
  });

  it("references all four existing browser configurations without claiming they implement final acceptance", async () => {
    const text = await readFile(
      new URL("../docs/agents/instructions/conventions.md", import.meta.url),
      "utf8",
    );
    for (const file of [
      "apps/cost-tracker/playwright.config.ts",
      "apps/calculator/playwright.config.ts",
      "apps/calculator/playwright.merge.config.ts",
      "apps/calculator/playwright.instant.config.ts",
    ]) {
      expect(text).toContain(`\`${file}\``);
      expect(
        await readFile(new URL(`../${file}`, import.meta.url), "utf8"),
      ).toContain("defineConfig");
    }
  });

  it("keeps representative pure, session, shared-boundary, and production-only selections discoverable", async () => {
    const text = await readFile(
      new URL("../docs/agents/instructions/conventions.md", import.meta.url),
      "utf8",
    );
    for (const example of [
      "Pure organization role rule",
      "Browser/session setup",
      "Shared auth/schema/router",
      "Production-only instant/prerender",
    ])
      expect(text).toContain(example);
    const authManifest = JSON.parse(
      await readFile(
        new URL("../packages/auth/package.json", import.meta.url),
        "utf8",
      ),
    );
    expect(authManifest.scripts["test:run"]).toBe("vitest run");
    expect(
      await readFile(
        new URL(
          "../packages/auth/src/organization-roles.test.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ).toContain("describe");
    expect(
      await readFile(
        new URL(
          "../apps/cost-tracker/src/__tests__/e2e/hosting-setup.spec.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ).toContain("test");
    expect(text).toContain("--workers=1 --retries=0");
    expect(text).toContain(
      "These examples require the relevant isolated environment and prerequisites",
    );
  });

  it("keeps focused handoffs and final authority explicit", async () => {
    const delegation = await readFile(
      new URL("../docs/agents/delegation.md", import.meta.url),
      "utf8",
    );
    expect(delegation).toContain(
      "selected focused checks and rationale, runtime mode/target",
    );
    expect(delegation).toContain("Completion alone is not acceptance");
    expect(delegation).toContain(
      "Reviewers and fixing children do not run competing full gates",
    );
    const root = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
    expect(root).toContain(
      "`pnpm run format && pnpm run lint` executed and passing",
    );
    expect(root).toContain(
      "`pnpm run check:agent-instructions` passes after instruction changes",
    );
  });

  it("keeps changed policy links and scoped line budgets valid", async () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const errors: string[] = [];
    for (const file of [
      ...verificationGuidanceFiles.map(([file]) => file),
      "docs/agents/instructions/conventions.md",
    ]) {
      const text = await readFile(path.join(root, file), "utf8");
      await validateMarkdownLinks(path.join(root, file), text, root, (error) =>
        errors.push(error),
      );
      if (file.startsWith("docs/agents/instructions/"))
        expect(text.split("\n").length).toBeLessThanOrEqual(
          instructionLineBudget,
        );
    }
    expect(errors).toEqual([]);
    const policy = await readFile(
      new URL("../docs/agents/instructions/conventions.md", import.meta.url),
      "utf8",
    );
    expect(policy).toContain("## Two verification loops");
  });
});
