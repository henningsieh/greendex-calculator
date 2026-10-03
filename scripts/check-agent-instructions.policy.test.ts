import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  delegationGuidanceFiles,
  findPatternHits,
  matchesRetiredVendorPointer,
  matchesStaleGuidance,
  retiredPointerPatterns,
  referenceFiles,
  requiredRepositoryPaths,
  stalePatterns,
} from "./check-agent-instructions.policy";
import { readJson } from "./check-agent-instructions.utils";

describe("delegation guidance coverage", () => {
  it("preserves the approved default model and reviewer thinking policy", async () => {
    const settings = await readJson(
      fileURLToPath(new URL("../.pi/settings.json", import.meta.url)),
    );
    expect(settings).toMatchObject({
      subagents: {
        defaultModel: "openai-codex/gpt-6.1-sol",
        agentOverrides: { reviewer: { thinking: "xhigh" } },
      },
    });
  });

  it("requires and checks links in both launch and quota runbooks", () => {
    expect(delegationGuidanceFiles).toEqual([
      "docs/agents/subagent-launch.md",
      "docs/agents/codex-usage-meter.md",
    ]);
    for (const filePath of delegationGuidanceFiles) {
      expect(requiredRepositoryPaths).toContain(filePath);
      expect(referenceFiles).toContain(filePath);
    }
    expect(requiredRepositoryPaths).toContain(".pi/settings.json");
  });

  it("keeps ordinary children fresh and supervisor-controlled in project settings", async () => {
    const settings = await readJson(
      fileURLToPath(new URL("../.pi/settings.json", import.meta.url)),
    );
    const roles = ["delegate", "worker", "scout", "researcher", "reviewer"];
    expect(settings).toMatchObject({
      subagents: {
        projectRootResolution: "git-root",
        agentOverrides: Object.fromEntries(
          roles.map((name) => [
            name,
            { defaultContext: "fresh", allowNestedSubagents: false },
          ]),
        ),
      },
    });
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
