"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { PROJECT_PARTICIPATION_CREATE } from "@greendex/auth/project-authorization";
import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { ArchivedActionExplanation } from "@/components/archived-action-explanation";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { ReasonFieldError } from "@/components/reason-field-error";
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
import { usePaymentController } from "@/features/claims/payment-controller";
import type { ClaimDecisionInput } from "@/features/claims/types";
import { authClient } from "@/lib/auth-client";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Claim = NonNullable<Outputs["claims"]["getDraft"]>;
type History = Outputs["claims"]["getHistory"];
type ReviewDetails = Outputs["claims"]["getReviewDetails"];
// The offered decisions come from the shared Claim lifecycle; this surface
// keeps presentation copy only, never its own status-to-action rule.
type Decision = ClaimPanelAction;
type DecisionInput = ClaimDecisionInput;

function reimbursementLabel(status: Claim["status"] | undefined) {
  return status === "approved" || status === "paid"
    ? "approvedAmount"
    : status === "submitted"
      ? "estimatedReimbursement"
      : null;
}

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
  const dateFormat = useDateFormat();

  return (
    <section
      aria-label={t("historyLabel")}
      data-testid="claim-history"
      className="min-w-0 space-y-4 px-8 py-7 max-sm:px-4"
    >
      <h2 className="text-xl">{t("historyTitle")}</h2>
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
                {dateFormat.format(event.occurredAt, "dateTime.short")}
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
  reimbursementAmountEur,
}: {
  status: Claim["status"];
  reimbursementAmountEur: string | null;
}) {
  const t = useTranslations("claims.review");
  const amountLabel = reimbursementLabel(status);

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
                  : t("status.in_preparation")}
      </p>
      {amountLabel && reimbursementAmountEur && (
        <p
          data-message={amountLabel}
          data-testid={
            amountLabel === "approvedAmount"
              ? "approved-reimbursement"
              : "estimated-reimbursement"
          }
        >
          {t(amountLabel)}{" "}
          <span className="block font-mono tabular-nums">
            {reimbursementAmountEur} {t("currencyEur")}
          </span>
        </p>
      )}
    </>
  );
}

export function ClaimDecisionPanel({
  partnershipId,
  status,
  reimbursementAmountEur,
  canReview,
  archived = false,
  onDecision,
}: {
  partnershipId: string;
  status: Claim["status"];
  reimbursementAmountEur: string | null;
  canReview: boolean;
  archived?: boolean;
  onDecision: (decision: Decision, input: DecisionInput) => Promise<void>;
}) {
  const t = useTranslations("claims.review");
  const {
    intent: confirming,
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
  } = usePaymentController({
    partnershipId,
    reimbursementAmountEur,
    canReview,
    archived,
    onDecision,
  });
  const controls = claimPanelActions(status);
  return (
    <Card variant="action">
      <CardHeader>
        <CardTitle as="h2">{t("decisionTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClaimDecisionSummary
          status={status}
          reimbursementAmountEur={reimbursementAmountEur}
        />
        {canReview &&
          !confirming &&
          controls.map((action) => (
            <Button
              className="h-auto min-h-12 max-w-full whitespace-normal"
              size="lg"
              key={action}
              data-testid={`claim-decision-${action}`}
              type="button"
              variant={
                action === "approve" || action === "markPaid"
                  ? "default"
                  : "outline"
              }
              disabled={pending || archived}
              ref={(button) => {
                if (button && returnFocus.current === action) {
                  returnFocus.current = null;
                  button.focus();
                }
              }}
              onClick={() => begin(action)}
            >
              {t(`actions.${action}`)}
            </Button>
          ))}
        {canReview && archived && controls.length > 0 && (
          <ArchivedActionExplanation />
        )}
        {canReview && confirming && (
          <Alert>
            <AlertDescription ref={focusConfirmation} tabIndex={-1}>
              {confirming === "markPaid"
                ? t("confirmTransfer", { amount: reimbursementAmountEur ?? "" })
                : confirming === "reopen"
                  ? t("confirmReopen")
                  : confirming === "approve"
                    ? t("confirmApproval")
                    : confirming === "correctPayment"
                      ? t("confirmPaymentCorrection")
                      : t(`actions.${confirming}`)}
              {reasonAction && (
                <div>
                  <Label htmlFor="decision-reason">
                    {t(`reasons.${reasonAction}`)}
                  </Label>
                  <textarea
                    id="decision-reason"
                    data-testid={`claim-decision-reason-${confirming}`}
                    className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    maxLength={MAX_CLAIM_REASON_LENGTH}
                    readOnly={pending}
                    required
                    aria-invalid={Boolean(form.formState.errors.reason)}
                    aria-describedby={
                      form.formState.errors.reason
                        ? "decision-reason-error"
                        : undefined
                    }
                    {...form.register("reason", {
                      onChange: () => form.clearErrors("reason"),
                      onBlur: () => {
                        if (
                          reasonAction === "correctPayment" &&
                          !form.getValues("reason").trim()
                        )
                          form.setError("reason", {
                            type: "required",
                            message: "reasonInvalid",
                          });
                      },
                    })}
                  />
                  {form.formState.errors.reason && (
                    <p id="decision-reason-error" role="alert">
                      <ReasonFieldError />
                    </p>
                  )}
                </div>
              )}
            </AlertDescription>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-auto min-h-12 max-w-full whitespace-normal"
                variant="default"
                size="lg"
                type="button"
                disabled={confirmDisabled}
                data-testid={`claim-decision-confirm-${confirming}`}
                onClick={() => void execute()}
              >
                {t(`actions.${confirming}`)}
              </Button>
              <Button
                size="lg"
                type="button"
                variant="outline"
                data-testid="claim-decision-cancel"
                disabled={pending}
                onClick={cancel}
              >
                {t("cancel")}
              </Button>
            </div>
          </Alert>
        )}
        {feedback != null && (
          <div role="alert">
            <ErrorPresentation error={feedback} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimReviewDetails({
  details,
  partnershipId,
  status,
}: {
  details: ReviewDetails;
  partnershipId: string;
  status?: Claim["status"];
}) {
  const t = useTranslations("claims.review");
  const amountLabel = reimbursementLabel(status);

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
        {amountLabel && (
          <p>
            {t(amountLabel)}{" "}
            <span
              className="font-mono tabular-nums"
              data-testid="review-approved-reimbursement"
              data-amount-eur={details.reimbursementAmountEur}
            >
              {details.reimbursementAmountEur} {t("currencyEur")}
            </span>
          </p>
        )}
        <h3 className="text-xl">{t("costsAndDocuments")}</h3>
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
        <h3>{t("journeysTitle")}</h3>
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
        orpcQuery.projects.listHosted,
        orpcQuery.projects.listPartner,
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
                  reimbursementAmountEur={claim.reimbursementAmountEur}
                  canReview={mayReview && reviewer.canReview}
                  archived={reviewer.projectArchived}
                  onDecision={decide}
                />
              )}
            </aside>
            <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
              <ClaimReviewDetails
                details={details}
                partnershipId={partnershipId}
                status={claim?.status}
              />
            </div>
          </div>
          <ClaimHistory events={history} />
        </div>
      </div>
    </section>
  );
}
