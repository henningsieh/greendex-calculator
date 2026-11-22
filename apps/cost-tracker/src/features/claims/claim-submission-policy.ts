import {
  claimTransitions,
  evaluateClaimTransition,
} from "@/features/claims/claim-lifecycle";

export const claimChecklistKeys = [
  "payoutAccount",
  "entries",
  "entryDetails",
  "proofDocuments",
  "participations",
  "journeys",
  "fundingRules",
] as const;

type ChecklistItem = {
  key: (typeof claimChecklistKeys)[number];
  passed: boolean;
};

export function isClaimChecklistReady(items: readonly ChecklistItem[]): boolean {
  return claimChecklistKeys.every((key) =>
    items.some((item) => item.key === key && item.passed),
  );
}

export function canSubmitClaim(
  action: "submit" | "resubmit" | null,
  facts: {
    items: readonly ChecklistItem[];
    calculatedReimbursementEur: string | null;
  },
): boolean {
  return (
    action !== null &&
    evaluateClaimTransition(claimTransitions[action].from, action, {
      submissionReady:
        isClaimChecklistReady(facts.items) &&
        facts.calculatedReimbursementEur !== null,
    }).kind === "transition"
  );
}
