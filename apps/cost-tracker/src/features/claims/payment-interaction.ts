import type { ClaimPanelAction } from "@/features/claims/claim-lifecycle";

type PaymentIntent = Extract<ClaimPanelAction, "markPaid" | "correctPayment">;

export function isPaymentIntent(
  intent: ClaimPanelAction,
): intent is PaymentIntent {
  return intent === "markPaid" || intent === "correctPayment";
}

export type PaymentInteraction =
  | { phase: "closed" }
  | { phase: "confirming"; intent: PaymentIntent }
  | { phase: "pending"; intent: PaymentIntent };

export type PaymentEvent =
  | { type: "open"; intent: PaymentIntent }
  | { type: "cancel" }
  | { type: "submit"; permitted: boolean; hasAmount: boolean; hasReason: boolean }
  | { type: "success" }
  | { type: "failure" };

export const paymentTransitions = [
  { from: "closed", event: "open", to: "confirming" },
  { from: "confirming", event: "cancel", to: "closed" },
  {
    from: "confirming",
    event: "submit",
    to: "pending",
    guard: "paymentConfirmationReady",
  },
  { from: "pending", event: "success", to: "closed" },
  { from: "pending", event: "failure", to: "confirming" },
] as const satisfies readonly {
  from: PaymentInteraction["phase"];
  event: PaymentEvent["type"];
  to: PaymentInteraction["phase"];
  guard?: "paymentConfirmationReady";
}[];

export function evaluatePaymentInteraction(
  state: PaymentInteraction,
  event: PaymentEvent,
):
  | { kind: "transition"; state: PaymentInteraction }
  | {
      kind: "refused";
      reason: "invalidEvent" | "notPermitted" | "missingAmount" | "missingReason";
    } {
  const transition = paymentTransitions.find(
    (row) => row.from === state.phase && row.event === event.type,
  );
  if (!transition) return { kind: "refused", reason: "invalidEvent" };
  if (transition.to === "closed")
    return { kind: "transition", state: { phase: "closed" } };
  if (event.type === "open")
    return {
      kind: "transition",
      state: { phase: "confirming", intent: event.intent },
    };
  if (state.phase === "closed")
    return { kind: "refused", reason: "invalidEvent" };
  if (event.type === "submit") {
    if (!event.permitted) return { kind: "refused", reason: "notPermitted" };
    if (state.intent === "markPaid" && !event.hasAmount)
      return { kind: "refused", reason: "missingAmount" };
    if (state.intent === "correctPayment" && !event.hasReason)
      return { kind: "refused", reason: "missingReason" };
  }
  return {
    kind: "transition",
    state: { phase: transition.to, intent: state.intent },
  };
}
