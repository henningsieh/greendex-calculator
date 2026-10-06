/**
 * Type declarations for ./agent-instruction-policy.mjs.
 *
 * The policy module owns *what* the agent-instruction checks verify; this
 * sibling declaration file gives TypeScript its public shape so strict
 * editors and `tsc` can check its consumers (notably
 * ./agent-instruction-policy.test.ts) without a runtime change.
 */

export interface PatternHit {
  pattern: RegExp;
  message: string;
}

export declare const instructionLineBudget: number;

export declare const expectedScopes: Record<string, string>;

export declare const requiredOnlineRoutes: Record<string, string[]>;

export declare const requiredIntegrationAnchors: string[];

export declare const requiredRepositoryPaths: string[];

export declare const referenceFiles: string[];

export declare const retiredDocumentationRoots: string[];

export declare const agentPointerPattern: PatternHit;

export declare const stalePatterns: PatternHit[];

export declare const retiredPointerPatterns: PatternHit[];

export declare const officialSkillSources: Record<string, string>;

export declare const appAgentFileNames: string[];

export declare const nextConfigsToCheck: {
  configPath: string;
  label: string;
}[];

export declare const retiredAgentGuidancePaths: string[];

export declare const serverClientMarkers: {
  instrumentationFile: string;
  instrumentationImport: string;
  localeLayoutFile: string;
  localeLayoutImport: string;
};

export declare const turboWildcardEnvTasks: string[];

export declare const designSystemPlugin: string;

export declare const designSystemComponentOverrides: string[];

export declare const lintTaskInputs: string[];

export declare function findPatternHits(
  text: string,
  patterns: PatternHit[],
): PatternHit[];

export declare function matchesStaleGuidance(text: string): boolean;

export declare function matchesRetiredVendorPointer(text: string): boolean;
