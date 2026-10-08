import { ORPCError } from "@orpc/server";

import {
  SafeErrorDataSchema,
  Situation,
  hasComposedCopy,
  situationCatalog,
} from "@/lib/orpc/error-contract";

type SituationName = keyof typeof situationCatalog;
type SafeIssue = { path: string[]; message: string };

type SituationErrorOptions = {
  message: string;
  data: { reason: string; issues?: SafeIssue[] };
};

/**
 * Transport construction per declared code. Procedures inject the oRPC error map
 * they were built with, so a refusal is produced through the declared contract
 * instead of a second, hand-written constructor.
 */
export type SituationErrorConstructors = {
  [Code in Situation["code"]]: (
    options: SituationErrorOptions,
  ) => ORPCError<string, unknown>;
};

type ProjectCompletionBlocker = {
  name: string;
  status:
    | "editable"
    | "correction_requested"
    | "submitted"
    | "approved"
    | "rejected"
    | "paid"
    | null;
};

type RefusalInput = {
  blockers?: readonly ProjectCompletionBlocker[];
  issues?: SafeIssue[];
};

/** Refusals that take their own input instead of being a single call. */
type RefusalName = Exclude<
  SituationName,
  "projectCompletionBlocked" | "submissionIncomplete"
>;

export type SituationErrors = {
  [Name in RefusalName]: () => ORPCError<string, unknown>;
} & {
  projectCompletionBlocked: (
    blockers: readonly ProjectCompletionBlocker[],
  ) => ORPCError<string, unknown>;
  submissionIncomplete: (issues: SafeIssue[]) => ORPCError<string, unknown>;
};

/** Field issues a fixed refusal carries beyond its declared copy. */
const fixedRefusalIssues: Partial<
  Record<RefusalName, (situation: Situation) => SafeIssue[]>
> = {
  journeyDistanceOutsideBands: (situation) => [
    { path: ["erasmusDistanceKm"], message: situation.message },
  ],
};

function defaultSituationErrorConstructors(): SituationErrorConstructors {
  const codes = [
    ...new Set(
      Object.values(situationCatalog).map((situation) => situation.code),
    ),
  ];
  const constructors: Partial<SituationErrorConstructors> = {};
  for (const code of codes)
    constructors[code] = (options: SituationErrorOptions) =>
      new ORPCError(code, options);
  assertComplete(constructors, codes, "default error constructors");
  return constructors;
}

/** Builds one refusal from its catalog declaration; the copy is never retyped. */
function createRefusal(
  name: SituationName,
  constructors: SituationErrorConstructors,
) {
  const situation = situationCatalog[name];
  return ({ blockers = [], issues }: RefusalInput = {}) =>
    constructors[situation.code]({
      message: hasComposedCopy(situation)
        ? `${situation.message} ${blockers
            .map(({ name, status }) => `${name} (${status ?? "no Claim"})`)
            .join(", ")}.`
        : situation.message,
      data: SafeErrorDataSchema.parse({
        reason: situation.reason,
        ...(name in fixedRefusalIssues
          ? { issues: fixedRefusalIssues[name as RefusalName]?.(situation) }
          : issues
            ? { issues }
            : {}),
      }),
    });
}

/** Builders for the refusals whose callers pass their own input positionally. */
const refusalWithInput = {
  projectCompletionBlocked: (blockers: readonly ProjectCompletionBlocker[]) => ({
    blockers,
  }),
  submissionIncomplete: (issues: SafeIssue[]) => ({ issues }),
};

/** Narrows a partially built map once every declared key has been written. */
function assertComplete<T extends object>(
  value: Partial<T>,
  keys: readonly (keyof T)[],
  label: string,
): asserts value is T {
  const missing = keys.filter((key) => value[key] === undefined);
  if (missing.length > 0)
    throw new Error(`${label} missing: ${missing.join(", ")}`);
}

function setRefusal<K extends SituationName>(
  refusals: { [P in SituationName]?: SituationErrors[P] },
  name: K,
  refusal: SituationErrors[K],
): void {
  refusals[name] = refusal;
}

export function createSituationErrors(
  overrides: Partial<SituationErrorConstructors> = {},
): SituationErrors {
  const constructors: SituationErrorConstructors = {
    ...defaultSituationErrorConstructors(),
    ...overrides,
  };
  const names = Object.keys(situationCatalog) as SituationName[];
  const refusals: { [P in SituationName]?: SituationErrors[P] } = {};
  for (const name of names) {
    const build = createRefusal(name, constructors);
    if (name === "projectCompletionBlocked") {
      setRefusal(refusals, name, (blockers) =>
        build(refusalWithInput.projectCompletionBlocked(blockers)),
      );
      continue;
    }
    if (name === "submissionIncomplete") {
      setRefusal(refusals, name, (issues) =>
        build(refusalWithInput.submissionIncomplete(issues)),
      );
      continue;
    }
    setRefusal(refusals, name, build);
  }
  assertComplete(refusals, names, "situation refusals");
  return refusals;
}

export type ScopeErrorConstructors = Partial<
  Pick<SituationErrorConstructors, "BAD_REQUEST" | "NOT_FOUND">
> & {
  FORBIDDEN?: (options: {
    message: string;
    data?: { reason: string };
  }) => ORPCError<string, unknown>;
};
