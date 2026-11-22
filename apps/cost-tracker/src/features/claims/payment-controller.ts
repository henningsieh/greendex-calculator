import { createElement, useCallback, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { toast } from "@/components/ui/toast";
import {
  MAX_CLAIM_REASON_LENGTH,
  type ClaimPanelAction,
  type ClaimReviewDecision,
} from "@/features/claims/claim-lifecycle";
import {
  evaluatePaymentInteraction,
  isPaymentIntent,
  type PaymentEvent,
  type PaymentInteraction,
} from "@/features/claims/payment-interaction";
import type { ClaimDecisionInput } from "@/features/claims/types";

export function usePaymentController({
  partnershipId,
  approvedAmountEur,
  canReview,
  archived,
  onDecision,
}: {
  partnershipId: string;
  approvedAmountEur: string | null;
  canReview: boolean;
  archived: boolean;
  onDecision: (
    action: ClaimPanelAction,
    input: ClaimDecisionInput,
  ) => Promise<void>;
}) {
  const [state, setState] = useState<PaymentInteraction>({ phase: "closed" });
  const current = useRef<PaymentInteraction>(state);
  const [reviewIntent, setReviewIntent] = useState<ClaimReviewDecision | null>(
    null,
  );
  const [reviewPending, setReviewPending] = useState(false);
  const savingReview = useRef(false);
  const returnFocus = useRef<ClaimPanelAction | null>(null);
  const [feedback, setFeedback] = useState<unknown>(null);
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const reason = useWatch({ control: form.control, name: "reason" });
  const focusConfirmation = useCallback((prompt: HTMLDivElement | null) => {
    prompt?.focus();
  }, []);
  function transition(event: PaymentEvent) {
    const result = evaluatePaymentInteraction(current.current, event);
    if (result.kind === "transition") {
      current.current = result.state;
      setState(result.state);
    }
    return result.kind === "transition";
  }
  function begin(intent: ClaimPanelAction) {
    if (reviewIntent || current.current.phase !== "closed") return;
    form.reset();
    setFeedback(null);
    if (isPaymentIntent(intent)) transition({ type: "open", intent });
    else setReviewIntent(intent);
  }
  function cancel() {
    if (reviewIntent && !savingReview.current) {
      returnFocus.current = reviewIntent;
      setReviewIntent(null);
    } else {
      const before = current.current;
      if (before.phase !== "closed" && transition({ type: "cancel" }))
        returnFocus.current = before.intent;
    }
  }
  function submitEvent(value: string): PaymentEvent {
    return {
      type: "submit",
      permitted: canReview && !archived,
      hasAmount: Boolean(approvedAmountEur),
      hasReason: Boolean(value),
    };
  }
  async function execute() {
    const before = current.current;
    const intent = before.phase === "closed" ? reviewIntent : before.intent;
    if (!intent) return;
    const needsReason =
      intent === "requestCorrection" ||
      intent === "reject" ||
      intent === "correctPayment";
    const value = form.getValues("reason").trim();
    const payment = isPaymentIntent(intent);
    if (payment) {
      const event = submitEvent(value);
      if (evaluatePaymentInteraction(before, event).kind === "refused") return;
      if (intent === "correctPayment" && value.length > MAX_CLAIM_REASON_LENGTH) {
        form.setError("reason", { type: "validate", message: "reasonInvalid" });
        return;
      }
      if (!transition(event)) return;
    } else {
      if (
        !canReview ||
        archived ||
        savingReview.current ||
        (needsReason && !value)
      )
        return;
      savingReview.current = true;
      setReviewPending(true);
    }
    setFeedback(null);
    form.clearErrors("reason");
    try {
      await onDecision(intent, {
        partnershipId,
        ...(needsReason ? { reason: value } : {}),
        ...(intent === "markPaid" ? { amountEur: approvedAmountEur ?? "" } : {}),
      });
      if (payment) transition({ type: "success" });
      else setReviewIntent(null);
      form.reset();
    } catch (error) {
      if (payment) {
        transition({ type: "failure" });
        toast.add({
          type: "error",
          description: createElement(ErrorPresentation, { error }),
        });
      } else {
        setFeedback(error);
      }
    } finally {
      if (!payment) {
        savingReview.current = false;
        setReviewPending(false);
      }
    }
  }
  const intent = state.phase === "closed" ? reviewIntent : state.intent;
  const reasonAction =
    intent === "requestCorrection" ||
    intent === "reject" ||
    intent === "correctPayment"
      ? intent
      : null;
  const pending = state.phase === "pending" || reviewPending;
  const confirmDisabled =
    state.phase === "closed"
      ? pending || archived || (Boolean(reasonAction) && !reason.trim())
      : evaluatePaymentInteraction(state, submitEvent(reason.trim())).kind ===
        "refused";
  return {
    intent,
    reasonAction,
    form,
    feedback,
    returnFocus,
    focusConfirmation,
    begin,
    cancel,
    execute,
    pending,
    confirmDisabled,
  };
}
