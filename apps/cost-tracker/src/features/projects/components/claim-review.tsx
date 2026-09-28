"use client";

import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Claim = NonNullable<Outputs["claims"]["getDraft"]>;
type History = Outputs["claims"]["getHistory"];
type ReviewDetails = Outputs["claims"]["getReviewDetails"];
type Decision =
  | "requestCorrection"
  | "approve"
  | "reject"
  | "reopen"
  | "markPaid"
  | "correctPayment";
type DecisionInput = {
  partnershipId: string;
  reason?: string;
  amountEur?: string;
};

const decisionLabels: Record<Decision, string> = {
  requestCorrection: "correction request",
  approve: "approval",
  reject: "rejection",
  reopen: "reopening",
  markPaid: "payment",
  correctPayment: "paid-flag correction",
};
const historyLabels: Record<History[number]["eventType"], string> = {
  submitted: "Submitted",
  correction_requested: "Correction requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  reopened: "Reopened",
  paid: "Paid",
  payment_corrected: "Paid flag corrected",
  journey_updated: "Journey corrected",
};

export function ClaimHistory({ events }: { events: History }) {
  return (
    <section aria-label="Claim history" className="space-y-2">
      <h2 className="font-heading text-xl font-semibold">Claim history</h2>
      {events.length === 0 ? (
        <p>No review events yet.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((event, index) => (
            <li
              key={`${event.actorUserId}-${event.occurredAt.toISOString()}-${index}`}
            >
              <strong>{historyLabels[event.eventType]}</strong> ·{" "}
              {event.occurredAt.toLocaleString()} · {event.actorUserId}
              {event.reason && <p>{event.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ClaimDecisionPanel({
  partnershipId,
  status,
  approvedAmountEur,
  canReview,
  onDecision,
}: {
  partnershipId: string;
  status: Claim["status"];
  approvedAmountEur: string | null;
  canReview: boolean;
  onDecision: (decision: Decision, input: DecisionInput) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const controls: { action: Decision; label: string }[] =
    status === "submitted"
      ? [
          { action: "requestCorrection", label: "Request correction" },
          { action: "approve", label: "Approve Claim" },
          { action: "reject", label: "Reject Claim" },
        ]
      : status === "rejected"
        ? [{ action: "reopen", label: "Reopen Claim" }]
        : status === "approved"
          ? [{ action: "markPaid", label: "Mark paid" }]
          : status === "paid"
            ? [{ action: "correctPayment", label: "Correct paid flag" }]
            : [];
  function begin(action: Decision) {
    setConfirming(action);
    setReason("");
    setFeedback("");
  }
  async function execute() {
    if (!confirming || pending) return;
    const needsReason = [
      "requestCorrection",
      "reject",
      "correctPayment",
    ].includes(confirming);
    if (needsReason && !reason.trim()) return;
    setPending(true);
    setFeedback("");
    try {
      await onDecision(confirming, {
        partnershipId,
        ...(needsReason ? { reason: reason.trim() } : {}),
        ...(confirming === "markPaid"
          ? { amountEur: approvedAmountEur ?? "" }
          : {}),
      });
      setConfirming(null);
      setReason("");
    } catch (error) {
      setFeedback(getORPCRequestErrorMessage(error).text);
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          {status === "approved"
            ? "Approved · unpaid"
            : status === "paid"
              ? "Paid"
              : status === "rejected"
                ? "Rejected · unpaid"
                : status === "correction_requested"
                  ? "Correction requested · Partner action required"
                  : status === "submitted"
                    ? "Submitted · awaiting Hosting review"
                    : "Editable draft"}
        </p>
        {approvedAmountEur && (
          <p>
            Calculated payable: {approvedAmountEur} EUR (server-approved amount)
          </p>
        )}
        {canReview &&
          controls.map(({ action, label }) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => begin(action)}
            >
              {label}
            </Button>
          ))}
        {canReview && confirming && (
          <Alert>
            <AlertDescription>
              {confirming === "markPaid"
                ? `Confirm only after one full bank transfer of ${approvedAmountEur} EUR was actually sent.`
                : confirming === "reopen"
                  ? "Reopening returns the Claim to Hosting review and keeps Partner editing locked. Request a correction separately if edits are needed."
                  : `Confirm ${decisionLabels[confirming]} for this Claim.`}
              {(
                ["requestCorrection", "reject", "correctPayment"] as Decision[]
              ).includes(confirming) && (
                <div>
                  <Label htmlFor="decision-reason">
                    {confirming === "requestCorrection"
                      ? "Correction reason"
                      : confirming === "reject"
                        ? "Rejection reason"
                        : "Paid-flag correction reason"}
                  </Label>
                  <textarea
                    id="decision-reason"
                    className="w-full rounded-md border bg-background p-2"
                    maxLength={2000}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              )}
            </AlertDescription>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={
                  pending ||
                  (["requestCorrection", "reject", "correctPayment"].includes(
                    confirming,
                  ) &&
                    !reason.trim()) ||
                  (confirming === "markPaid" && !approvedAmountEur)
                }
                onClick={() => void execute()}
              >
                Confirm {decisionLabels[confirming]}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirming(null)}
              >
                Cancel
              </Button>
            </div>
          </Alert>
        )}
        {feedback && <output role="alert">{feedback}</output>}
      </CardContent>
    </Card>
  );
}

export function ClaimReviewDetails({ details }: { details: ReviewDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submitted Claim details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Selected payout:{" "}
          {details.payoutAccount
            ? `${details.payoutAccount.accountHolder} · ${details.payoutAccount.iban}${details.payoutAccount.bic ? ` · ${details.payoutAccount.bic}` : ""}`
            : "No Payout Account"}
        </p>
        <p>
          Calculated payable: {details.approvedAmountEur ?? "Unavailable"} EUR
        </p>
        <h3 className="font-semibold">Travel Cost Entries and Proof Documents</h3>
        {details.entries.length === 0 ? (
          <p>No costs recorded.</p>
        ) : (
          <ul className="space-y-3">
            {details.entries.map((entry) => (
              <li key={entry.id}>
                <p>
                  {entry.transportProfile} · {entry.amountEur} EUR ·{" "}
                  {entry.allocationMethod}
                </p>
                <ul>
                  {entry.allocations.map((share) => (
                    <li key={share.participantId}>
                      {share.participantName}:{" "}
                      {share.amountEur
                        ? `${share.amountEur} EUR`
                        : share.percentage
                          ? `${share.percentage}%`
                          : "Equal share (computed on submission)"}
                    </li>
                  ))}
                </ul>
                <ul>
                  {entry.documents.map((document) => (
                    <li key={document.id}>
                      Proof Document: {document.originalFileName} (
                      {document.mediaType}, {document.byteSize} bytes)
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-semibold">Participant Journeys</h3>
        {details.journeys.length === 0 ? (
          <p>No journeys recorded.</p>
        ) : (
          <ul>
            {details.journeys.map((journey) => (
              <li key={journey.participantId}>
                {journey.participantName}: {journey.origin} →{" "}
                {journey.destination} · {journey.tripType} ·{" "}
                {journey.erasmusDistanceKm} km
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimReview({ partnershipId }: { partnershipId: string }) {
  const client = useQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  const [claimQuery, historyQuery, reviewerQuery, detailsQuery] =
    useSuspenseQueries({
      queries: [
        orpcQuery.claims.getDraft.queryOptions(options),
        orpcQuery.claims.getHistory.queryOptions(options),
        orpcQuery.claims.reviewerAccess.queryOptions(options),
        orpcQuery.claims.getReviewDetails.queryOptions(options),
      ],
    });
  const claim = claimQuery.data;
  const history = historyQuery.data;
  const reviewer = reviewerQuery.data;
  const details = detailsQuery.data;
  async function decide(action: Decision, data: DecisionInput) {
    switch (action) {
      case "requestCorrection":
        await orpc.claims.requestCorrection({
          partnershipId,
          reason: data.reason,
        });
        break;
      case "approve":
        await orpc.claims.approve({ partnershipId });
        break;
      case "reject":
        await orpc.claims.reject({ partnershipId, reason: data.reason });
        break;
      case "reopen":
        await orpc.claims.reopen({ partnershipId });
        break;
      case "markPaid":
        await orpc.claims.markPaid({
          partnershipId,
          amountEur: data.amountEur ?? "",
        });
        break;
      case "correctPayment":
        await orpc.claims.correctPayment({
          partnershipId,
          reason: data.reason ?? "",
        });
        break;
    }
    await Promise.all(
      [
        orpcQuery.claims.getDraft,
        orpcQuery.claims.getHistory,
        orpcQuery.claims.getReviewDetails,
        orpcQuery.projectPartnerships.list,
      ].map((query) =>
        client.invalidateQueries({ queryKey: query.key({ type: "query" }) }),
      ),
    );
  }
  return (
    <section aria-label="Claim review" className="space-y-6">
      <Link href="/claims/review">Back to submitted Claims</Link>
      {!claim ? (
        <p>No Claim has been created for this Partnership.</p>
      ) : (
        <ClaimDecisionPanel
          partnershipId={partnershipId}
          status={claim.status}
          approvedAmountEur={claim.approvedAmountEur}
          canReview={reviewer.canReview}
          onDecision={decide}
        />
      )}
      <ClaimReviewDetails details={details} />
      <ClaimHistory events={history} />
    </section>
  );
}
