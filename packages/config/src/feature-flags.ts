/**
 * Centralized feature flags.
 *
 * One home for per-app policy switches. Every flag has a safe default.
 * An app turns a flag on by passing it to the shared factory or provider.
 * New flags start here, default off, with tests.
 */
export interface FeatureFlagValues {
  /** One organization per user. Blocks creating a second organization. */
  singleOrganization: boolean;
}

export const FEATURE_FLAGS: FeatureFlagValues = {
  singleOrganization: false,
};

export type FeatureFlags = typeof FEATURE_FLAGS;

export type FeatureFlagName = keyof FeatureFlags;

/** Merge app overrides over the safe defaults. */
export function resolveFlags(overrides?: Partial<FeatureFlags>): FeatureFlags {
  return { ...FEATURE_FLAGS, ...overrides };
}
