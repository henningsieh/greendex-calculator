import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  delegationGuidanceFiles,
  expectedScopes,
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

describe("oRPC documentation major", () => {
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

describe("delegation guidance coverage", () => {
  it("requires and checks links in tool-neutral delegation guidance", () => {
    expect(delegationGuidanceFiles).toEqual(["docs/agents/delegation.md"]);
    for (const filePath of delegationGuidanceFiles) {
      expect(requiredRepositoryPaths).toContain(filePath);
      expect(referenceFiles).toContain(filePath);
    }
    expect(requiredRepositoryPaths).not.toContain(".pi/settings.json");
  });

  it("keeps shared policy independent of personal runtimes and configuration", async () => {
    for (const filePath of ["AGENTS.md", ...delegationGuidanceFiles]) {
      const guidance = await readFile(
        new URL(`../${filePath}`, import.meta.url),
        "utf8",
      );
      expect(guidance).not.toMatch(
        /pi-subagents|subagents_enable|openai-codex|gpt-6|codex-usage-meter|subagent-launch|\.pi\/|\/home\//u,
      );
    }
  });

  it("preserves direct implementation, bounded authority, acceptance and safe recovery", async () => {
    const guidance = await readFile(
      new URL("../docs/agents/delegation.md", import.meta.url),
      "utf8",
    );
    for (const rule of [
      "execute directly",
      "one writer",
      "fresh context",
      "explicitly allowed",
      "final acceptance",
      "partial diff",
      "no longer active",
      "resume",
    ]) {
      expect(guidance).toContain(rule);
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
