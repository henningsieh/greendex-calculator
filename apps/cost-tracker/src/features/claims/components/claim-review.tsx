"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { PROJECT_PARTICIPATION_CREATE } from "@greendex/auth/project-authorization";
import { useTranslations } from "@greendex/i18n/client";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  claimPanelActions,
  type ClaimPanelAction,
  MAX_CLAIM_REASON_LENGTH,
} from "@/features/claims/claim-lifecycle";
import {
  ClaimBand,
  ClaimCostTable,
  PayoutAccountLines,
} from "@/features/claims/components/claim-document";
import { authClient } from "@/lib/auth-client";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Claim = NonNullable<Outputs["claims"]["getDraft"]>;
type History = Outputs["claims"]["getHistory"];
type ReviewDetails = Outputs["claims"]["getReviewDetails"];
// The offered decisions come from the shared Claim lifecycle; this surface
// keeps presentation copy only, never its own status-to-action rule.
type Decision = ClaimPanelAction;
type DecisionInput = {
  partnershipId: string;
  reason?: string;
  amountEur?: string;
};

const decisionDefinitions: Record<
  Decision,
  {
    confirmation: string;
    label: string;
    reasonLabel?: string;
  }
> = {
  requestCorrection: {
    confirmation: "correction request",
    label: "Request correction",
    reasonLabel: "Correction reason",
  },
  approve: { confirmation: "approval", label: "Approve Claim" },
  reject: {
    confirmation: "rejection",
    label: "Reject Claim",
    reasonLabel: "Rejection reason",
  },
  reopen: { confirmation: "reopening", label: "Reopen Claim" },
  markPaid: { confirmation: "payment", label: "Mark paid" },
  correctPayment: {
    confirmation: "paid-flag correction",
    label: "Correct paid flag",
    reasonLabel: "Paid-flag correction reason",
  },
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
  const t = useTranslations("claims.review");

  return (
    <section
      aria-label={t("historyLabel")}
      data-testid="claim-history"
      className="min-w-0 space-y-4 px-8 py-7 max-sm:px-4"
    >
      <h2 className="font-heading text-xl font-semibold">{t("historyTitle")}</h2>
      {events.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("historyEmpty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="divide-y">
          {events.map((event, index) => (
            <li
              data-history-event={event.eventType}
              key={`${event.actorUserId}-${event.occurredAt.toISOString()}-${index}`}
              className="grid gap-x-5 gap-y-2 py-4 min-[961px]:grid-cols-[180px_200px_minmax(0,1fr)]"
            >
              <strong>{historyLabels[event.eventType]}</strong>
              <time
                dateTime={event.occurredAt.toISOString()}
                className="font-mono text-xs text-muted-foreground"
              >
                {event.occurredAt.toLocaleString()}
              </time>
              <span className="min-w-0 wrap-anywhere">
                {t("actor")}{" "}
                <span className="font-mono">{event.actorUserId}</span>
              </span>
              {event.reason && (
                <p
                  className="col-span-full wrap-anywhere"
                  data-testid="history-reason"
                >
                  {event.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ClaimDecisionSummary({
  status,
  approvedAmountEur,
}: {
  status: Claim["status"];
  approvedAmountEur: string | null;
}) {
  const t = useTranslations("claims.review");

  return (
    <>
      <p data-review-status={status}>
        {status === "approved"
          ? t("status.approved")
          : status === "paid"
            ? t("status.paid")
            : status === "rejected"
              ? t("status.rejected")
              : status === "correction_requested"
                ? t("status.correctionRequested")
                : status === "submitted"
                  ? t("status.submitted")
                  : t("status.draft")}
      </p>
      {approvedAmountEur && (
        <p data-testid="approved-payable">
          {t("calculatedPayable")}{" "}
          <span className="block font-mono tabular-nums">
            {approvedAmountEur} {t("currencyEur")}
          </span>{" "}
          {t("serverApprovedAmount")}
        </p>
      )}
    </>
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
  const t = useTranslations("claims.review");
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [reason, setReason] = useState<string>("");
  const [pending, setPending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<React.ReactNode>(null);
  const controls = claimPanelActions(status).map((action) => ({
    action,
    label: decisionDefinitions[action].label,
  }));
  const definition = confirming ? decisionDefinitions[confirming] : null;
  function begin(action: Decision) {
    setConfirming(action);
    setReason("");
    setFeedback("");
  }
  async function execute() {
    if (!canReview || !confirming || pending) return;
    const needsReason = Boolean(definition?.reasonLabel);
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
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="action">
      <CardHeader>
        <CardTitle as="h2">{t("decisionTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClaimDecisionSummary
          status={status}
          approvedAmountEur={approvedAmountEur}
        />
        {canReview &&
          controls.map(({ action, label }) => (
            <Button
              size="lg"
              key={action}
              data-testid={`claim-decision-${action}`}
              type="button"
              variant={
                action === "approve" || action === "markPaid"
                  ? "default"
                  : "outline"
              }
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
                ? t("confirmTransfer", { amount: approvedAmountEur ?? "" })
                : confirming === "reopen"
                  ? t("confirmReopen")
                  : t("confirmAction", {
                      action: definition?.confirmation ?? "",
                    })}
              {definition?.reasonLabel && (
                <div>
                  <Label htmlFor="decision-reason">
                    {definition.reasonLabel}
                  </Label>
                  <textarea
                    id="decision-reason"
                    data-testid={`claim-decision-reason-${confirming}`}
                    className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    maxLength={MAX_CLAIM_REASON_LENGTH}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              )}
            </AlertDescription>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="lg"
                type="button"
                disabled={
                  pending ||
                  (Boolean(definition?.reasonLabel) && !reason.trim()) ||
                  (confirming === "markPaid" && !approvedAmountEur)
                }
                data-testid={`claim-decision-confirm-${confirming}`}
                onClick={() => void execute()}
              >
                {t("confirm")} {definition?.confirmation}
              </Button>
              <Button
                size="lg"
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirming(null)}
              >
                {t("cancel")}
              </Button>
            </div>
          </Alert>
        )}
        {feedback && <div role="alert">{feedback}</div>}
      </CardContent>
    </Card>
  );
}

export function ClaimReviewDetails({
  details,
  partnershipId,
}: {
  details: ReviewDetails;
  partnershipId: string;
}) {
  const t = useTranslations("claims.review");

  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("detailsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {details.payoutAccount ? (
          <PayoutAccountLines account={details.payoutAccount} />
        ) : (
          <p>{t("noPayoutAccount")}</p>
        )}
        <p>
          {t("calculatedPayable")}{" "}
          <span
            className="font-mono tabular-nums"
            data-testid="review-approved-payable"
            data-amount-eur={details.approvedAmountEur}
          >
            {details.approvedAmountEur ?? t("unavailable")} {t("currencyEur")}
          </span>
        </p>
        <h3 className="text-xl font-semibold">{t("costsAndDocuments")}</h3>
        {details.entries.length === 0 ? (
          <p>{t("noCosts")}</p>
        ) : (
          <ClaimCostTable
            rows={details.entries.map((entry) => ({
              id: entry.id,
              transportProfile: entry.transportProfile,
              amountEur: entry.amountEur,
              allocationMethod: entry.allocationMethod,
              allocations: (
                <ul className="space-y-2">
                  {entry.allocations.map((share) => (
                    <li
                      data-testid={`allocation-share-${share.participantId}`}
                      key={share.participantId}
                    >
                      {share.participantName}:{" "}
                      <span className="font-mono tabular-nums">
                        {share.amountEur
                          ? `${share.amountEur} ${t("currencyEur")}`
                          : share.percentage
                            ? `${share.percentage}%`
                            : t("equalShare")}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
              documents: entry.documents.length ? (
                <ul className="space-y-3">
                  {entry.documents.map((document) => (
                    <li key={document.id}>
                      <p>
                        {t("proofDocument")} {document.originalFileName}
                      </p>
                      <p className="text-muted-foreground">
                        {document.mediaType},{" "}
                        <span className="font-mono">{document.byteSize}</span>{" "}
                        {t("bytes")}
                      </p>
                      <a
                        href={`/api/proof-documents?${new URLSearchParams({ partnershipId, documentId: document.id })}`}
                        download
                        data-testid={`download-proof-${document.id}`}
                      >
                        {t("download")} {document.originalFileName}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                "None"
              ),
            }))}
          />
        )}
        <h3 className="font-semibold">{t("journeysTitle")}</h3>
        {details.journeys.length === 0 ? (
          <p>{t("noJourneys")}</p>
        ) : (
          <ul>
            {details.journeys.map((journey) => (
              <li
                data-testid={`review-journey-${journey.participantId}`}
                data-trip-type={journey.tripType}
                data-distance-km={journey.erasmusDistanceKm}
                key={journey.participantId}
              >
                {journey.participantName}: {journey.origin} →{" "}
                {journey.destination} · {journey.tripType} ·{" "}
                {journey.erasmusDistanceKm} {t("km")}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimReview({ partnershipId }: { partnershipId: string }) {
  const t = useTranslations("claims.review");
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const role = organization?.members.find(
    (entry) => entry.userId === session?.user.id,
  )?.role;
  const mayReview =
    Boolean(role) &&
    authClient.organization.checkRolePermission({
      role: role ?? ORGANIZATION_ROLES.Participant,
      permissions: PROJECT_PARTICIPATION_CREATE,
    });
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
        orpcQuery.projects.get,
      ].map((query) =>
        client.invalidateQueries({ queryKey: query.key({ type: "query" }) }),
      ),
    );
  }
  return (
    <section
      aria-label={t("sectionLabel")}
      data-testid="claim-review"
      className="min-w-0 space-y-5"
    >
      <Link href="/claims/review">{t("back")}</Link>
      <div className="min-w-0">
        <ClaimBand title={t("bandTitle")} status={claim?.status} />
        <div className="min-w-0 border border-t-0 bg-card">
          <div className="grid min-w-0 min-[961px]:grid-cols-[minmax(0,1fr)_340px]">
            <aside
              aria-label={t("decisionLabel")}
              className="min-w-0 border-b bg-muted min-[961px]:col-start-2 min-[961px]:row-start-1 min-[961px]:border-b-0 min-[961px]:border-l"
            >
              {!claim ? (
                <p>{t("noClaim")}</p>
              ) : (
                <ClaimDecisionPanel
                  partnershipId={partnershipId}
                  status={claim.status}
                  approvedAmountEur={claim.approvedAmountEur}
                  canReview={mayReview && reviewer.canReview}
                  onDecision={decide}
                />
              )}
            </aside>
            <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
              <ClaimReviewDetails
                details={details}
                partnershipId={partnershipId}
              />
            </div>
          </div>
          <ClaimHistory events={history} />
        </div>
      </div>
    </section>
  );
}
