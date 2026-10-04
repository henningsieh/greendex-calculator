import { ORPCError } from "@orpc/server";

import {
  SafeErrorDataSchema,
  hasComposedCopy,
  situationCatalog,
} from "@/lib/orpc/error-contract";

type Situation = (typeof situationCatalog)[keyof typeof situationCatalog];
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
type RefusalWithInput = "projectCompletionBlocked" | "submissionIncomplete";
type RefusalName = Exclude<SituationName, RefusalWithInput>;

type SituationErrors = {
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
  return Object.fromEntries(
    codes.map((code) => [
      code,
      (options: SituationErrorOptions) => new ORPCError(code, options),
    ]),
  ) as SituationErrorConstructors;
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
} satisfies Record<RefusalWithInput, (input: never) => RefusalInput>;

export function createSituationErrors(
  overrides: Partial<SituationErrorConstructors> = {},
): SituationErrors {
  const constructors: SituationErrorConstructors = {
    ...defaultSituationErrorConstructors(),
    ...overrides,
  };
  return Object.fromEntries(
    (Object.keys(situationCatalog) as SituationName[]).map((name) => {
      const build = createRefusal(name, constructors);
      if (!(name in refusalWithInput)) return [name, build];
      const withInput = refusalWithInput[name as RefusalWithInput] as (
        input: RefusalInput[keyof RefusalInput],
      ) => RefusalInput;
      return [name, (input: never) => build(withInput(input))];
    }),
  ) as SituationErrors;
}

export type ScopeErrorConstructors = Partial<
  Pick<SituationErrorConstructors, "BAD_REQUEST" | "NOT_FOUND">
> & {
  FORBIDDEN?: (options: {
    message: string;
    data?: { reason: string };
  }) => ORPCError<string, unknown>;
};
