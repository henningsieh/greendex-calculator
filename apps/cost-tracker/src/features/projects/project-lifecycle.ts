import type { ClaimStatus } from "@/features/claims/claim-lifecycle";
import { isSettledClaimStatus } from "@/features/claims/claim-lifecycle";
import type { ProjectStatus } from "@/features/projects/validation-schemas";

export const projectTransitions = {
  archive: { from: "active", to: "archived", guard: "settled" },
  reopen: { from: "archived", to: "active", guard: "reason" },
} as const;

export type ProjectState = "active" | "archived";
export type ProjectAction = keyof typeof projectTransitions;

export function projectStatus(
  archived: boolean,
  statuses: readonly (ClaimStatus | null | undefined)[],
): ProjectStatus {
  if (archived) return "archived";
  return statuses.every(isSettledClaimStatus) ? "ready" : "open";
}

export function evaluateProjectTransition(
  state: ProjectState,
  action: ProjectAction,
  facts: { settled?: boolean; reason?: boolean },
):
  | { kind: "transition"; state: ProjectState }
  | { kind: "refused"; reason: "invalidState" | "settled" | "reason" } {
  const transition = projectTransitions[action];
  if (transition.from !== state)
    return { kind: "refused", reason: "invalidState" };
  if (!facts[transition.guard])
    return { kind: "refused", reason: transition.guard };
  return { kind: "transition", state: transition.to };
}

export function projectLifecycleCapabilities(input: {
  archived: boolean;
  statuses: readonly (ClaimStatus | null | undefined)[];
  canArchive: boolean;
  canReopen: boolean;
}) {
  const status = projectStatus(input.archived, input.statuses);
  const state = input.archived ? "archived" : "active";
  return {
    status,
    canArchive:
      input.canArchive &&
      evaluateProjectTransition(state, "archive", {
        settled: status === "ready",
      }).kind === "transition",
    canReopen:
      input.canReopen &&
      evaluateProjectTransition(state, "reopen", { reason: true }).kind ===
        "transition",
  };
}
