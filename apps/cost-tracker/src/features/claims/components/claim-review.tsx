"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { PROJECT_PARTICIPATION_CREATE } from "@greendex/auth/project-authorization";
import { useFormatter, useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import {
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { ArchivedActionExplanation } from "@/components/archived-action-explanation";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { ReasonFieldError } from "@/components/reason-field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  claimPanelActions,
  type ClaimPanelAction,
  MAX_CLAIM_REASON_LENGTH,
} from "@/features/claims/claim-lifecycle";
import { ClaimCostRecords } from "@/features/claims/components/claim-cost-records";
import { PayoutAccountLines } from "@/features/claims/components/claim-document";
import { ClaimSummary } from "@/features/claims/components/claim-summary";
import { usePaymentController } from "@/features/claims/payment-controller";
import type { ClaimDecisionInput } from "@/features/claims/types";
import { authClient } from "@/lib/auth-client";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Claim = NonNullable<Outputs["claims"]["getDraft"]>;
type History = Outputs["claims"]["getHistory"];
type ReviewDetails = Outputs["claims"]["getReviewDetails"];
type Decision = ClaimPanelAction;
type DecisionInput = ClaimDecisionInput;

const statusKeys = {
  approved: "approved",
  correction_requested: "correctionRequested",
  in_preparation: "in_preparation",
  paid: "paid",
  rejected: "rejected",
  submitted: "submitted",
} as const;

function reimbursementLabel(status: Claim["status"] | undefined) {
  return status === "approved" || status === "paid"
    ? "approvedAmount"
    : status === "submitted"
      ? "estimatedReimbursement"
      : null;
}

export function ClaimHistory({ events }: { events: History }) {
  const t = useTranslations("claims.review");
  const dateFormat = useDateFormat();

  return (
    <Card data-testid="claim-history">
      <CardHeader>
        <CardTitle as="h2">{t("historyTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("historyEmpty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="relative space-y-0 border-l border-border pl-5">
            {events.map((event, index) => (
              <li
                className="relative pb-6 last:pb-0"
                data-history-event={event.eventType}
                key={`${event.actorUserId}-${event.occurredAt.toISOString()}-${index}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 left-[-1.4rem] size-2 rounded-full bg-primary"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t(`history.${event.eventType}`)}
                  </p>
                  <time
                    className="font-mono text-xs text-muted-foreground"
                    dateTime={event.occurredAt.toISOString()}
                  >
                    {dateFormat.format(event.occurredAt, "dateTime.short")}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("actor")}{" "}
                  <span className="font-mono">{event.actorUserId}</span>
                </p>
                {event.reason && (
                  <p
                    className="mt-2 text-sm wrap-anywhere"
                    data-testid="history-reason"
                  >
                    {event.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
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
  const format = useFormatter();
  const amountLabel = reimbursementLabel(status);
  const amount =
    reimbursementAmountEur === null
      ? null
      : format.number(Number(reimbursementAmountEur), {
          style: "currency",
          currency: "EUR",
        });

  return (
    <div className="space-y-2" data-review-status={status}>
      <p className="text-sm text-muted-foreground">
        {t(`status.${statusKeys[status]}`)}
      </p>
      {amountLabel && amount && (
        <p
          className="font-mono text-lg tabular-nums"
          data-message={amountLabel}
          data-testid={
            amountLabel === "approvedAmount"
              ? "approved-reimbursement"
              : "estimated-reimbursement"
          }
        >
          {amount}
        </p>
      )}
    </div>
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
    <Card data-testid="claim-decision-panel">
      <CardHeader>
        <CardTitle as="h2">{t("decisionTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ClaimDecisionSummary
          reimbursementAmountEur={reimbursementAmountEur}
          status={status}
        />
        {canReview &&
          !confirming &&
          controls.map((action) => (
            <Button
              className="w-full"
              data-testid={`claim-decision-${action}`}
              disabled={pending || archived}
              key={action}
              onClick={() => begin(action)}
              ref={(button) => {
                if (button && returnFocus.current === action) {
                  returnFocus.current = null;
                  button.focus();
                }
              }}
              size="lg"
              type="button"
              variant={
                action === "approve" || action === "markPaid"
                  ? "default"
                  : "outline"
              }
            >
              {t(`actions.${action}`)}
            </Button>
          ))}
        {canReview && archived && controls.length > 0 && (
          <ArchivedActionExplanation />
        )}
        {canReview && confirming && (
          <Alert role="alert" variant="info">
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
            </AlertDescription>
            {reasonAction && (
              <Field
                className="mt-4"
                data-invalid={Boolean(form.formState.errors.reason)}
              >
                <FieldLabel htmlFor="decision-reason">
                  {t(`reasons.${reasonAction}`)}
                </FieldLabel>
                <Textarea
                  aria-describedby={
                    form.formState.errors.reason
                      ? "decision-reason-error"
                      : undefined
                  }
                  aria-invalid={Boolean(form.formState.errors.reason)}
                  data-testid={`claim-decision-reason-${confirming}`}
                  id="decision-reason"
                  maxLength={MAX_CLAIM_REASON_LENGTH}
                  readOnly={pending}
                  required
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
              </Field>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Button
                data-testid={`claim-decision-confirm-${confirming}`}
                disabled={confirmDisabled}
                onClick={() => void execute()}
                size="lg"
                type="button"
                variant="default"
              >
                {t(`actions.${confirming}`)}
              </Button>
              <Button
                data-testid="claim-decision-cancel"
                disabled={pending}
                onClick={cancel}
                size="lg"
                type="button"
                variant="outline"
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
}: {
  details: ReviewDetails;
  partnershipId: string;
}) {
  const t = useTranslations("claims.review");
  const format = useFormatter();
  const totalParticipants = new Set(
    details.entries.flatMap((entry) =>
      entry.allocations.map((share) => share.participantId),
    ),
  ).size;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("detailsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-label={t("payoutTitle")}>
          <h3 className="text-sm font-medium">{t("payoutTitle")}</h3>
          {details.payoutAccount ? (
            <div className="mt-3 rounded-xl bg-muted/50 p-4">
              <PayoutAccountLines account={details.payoutAccount} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noPayoutAccount")}
            </p>
          )}
        </section>
        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t("estimatedReimbursement")}
          </span>
          <span
            className="font-mono text-lg tabular-nums"
            data-amount-eur={details.reimbursementAmountEur}
            data-testid="review-approved-reimbursement"
          >
            {format.number(Number(details.reimbursementAmountEur), {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </div>
        <section aria-label={t("costsAndDocuments")}>
          <h3 className="text-sm font-medium">{t("costsAndDocuments")}</h3>
          {details.entries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("noCosts")}</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
              <ClaimCostRecords
                rows={details.entries.map((entry) => ({
                  id: entry.id,
                  transportProfile: entry.transportProfile,
                  amountEur: entry.amountEur,
                  participants: entry.allocations.length,
                  receipts: entry.documents.length,
                  allocation: entry.allocationMethod as
                    | "equal"
                    | "amount"
                    | "percentage",
                  allocationDetail:
                    entry.allocationMethod === "equal"
                      ? undefined
                      : t(
                          entry.allocationMethod === "amount"
                            ? "allocationAmount"
                            : "allocationPercentage",
                        ),
                  allocations: (
                    <ul className="space-y-1">
                      {entry.allocations.map((share) => (
                        <li
                          data-testid={`allocation-share-${share.participantId}`}
                          key={share.participantId}
                        >
                          {share.participantName}:{" "}
                          <span className="font-mono tabular-nums">
                            {share.amountEur
                              ? format.number(Number(share.amountEur), {
                                  style: "currency",
                                  currency: "EUR",
                                })
                              : share.percentage
                                ? `${share.percentage}%`
                                : t("equalShare")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
                  documents:
                    entry.documents.length > 0 ? (
                      <ul className="space-y-1">
                        {entry.documents.map((document) => (
                          <li key={document.id}>
                            <a
                              className="link-prose"
                              data-testid={`download-proof-${document.id}`}
                              download
                              href={`/api/proof-documents?${new URLSearchParams({ partnershipId, documentId: document.id })}`}
                            >
                              {document.originalFileName}
                            </a>
                            <span className="ml-2 text-xs">
                              {document.mediaType},{" "}
                              <span className="font-mono">
                                {document.byteSize}
                              </span>{" "}
                              {t("bytes")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : undefined,
                }))}
                testId="claim-cost-table"
                total={{
                  amountEur: details.reimbursementAmountEur,
                  participants: totalParticipants,
                }}
              />
            </div>
          )}
        </section>
        <section aria-label={t("journeysTitle")}>
          <h3 className="text-sm font-medium">{t("journeysTitle")}</h3>
          {details.journeys.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noJourneys")}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
              {details.journeys.map((journey) => (
                <li
                  className="px-4 py-3"
                  data-distance-km={journey.erasmusDistanceKm}
                  data-testid={`review-journey-${journey.participantId}`}
                  data-trip-type={journey.tripType}
                  key={journey.participantId}
                >
                  <p className="text-sm font-medium">{journey.participantName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {journey.origin} → {journey.destination} · {journey.tripType}{" "}
                    ·{" "}
                    <span className="font-mono tabular-nums">
                      {journey.erasmusDistanceKm}
                    </span>{" "}
                    {t("km")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
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
  const project = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId: details.projectId },
      meta: { costTrackerORPC: true },
    }),
  ).data;
  const submittedAt =
    history.findLast((event) => event.eventType === "submitted")?.occurredAt ??
    null;

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
    toast.add({ title: t(`toast.${action}`), type: "success" });
  }

  return (
    <section
      aria-label={t("sectionLabel")}
      className="min-w-0 space-y-6"
      data-testid="claim-review"
    >
      <ClaimSummary
        amount={claim?.reimbursementAmountEur ?? details.reimbursementAmountEur}
        amountLabel={
          claim?.status === "approved" || claim?.status === "paid"
            ? t("approvedAmount")
            : t("estimatedReimbursement")
        }
        hostingOrganization={organization?.name}
        partnerOrganization={details.organizationName}
        payoutAccount={details.payoutAccount}
        project={project}
        status={claim?.status ?? null}
        submitted={Boolean(claim && claim.status !== "in_preparation")}
        submittedAt={submittedAt}
      />
      <div className="grid gap-6 @4xl/content:grid-cols-[minmax(0,1fr)_22rem]">
        <aside className="order-1 min-w-0 @4xl/content:sticky @4xl/content:top-6 @4xl/content:col-start-2 @4xl/content:row-start-1 @4xl/content:self-start">
          {!claim ? (
            <Card>
              <CardContent>{t("noClaim")}</CardContent>
            </Card>
          ) : (
            <ClaimDecisionPanel
              archived={reviewer.projectArchived}
              canReview={mayReview && reviewer.canReview}
              onDecision={decide}
              partnershipId={partnershipId}
              reimbursementAmountEur={claim.reimbursementAmountEur}
              status={claim.status}
            />
          )}
        </aside>
        <div className="order-2 min-w-0 space-y-6 @4xl/content:col-start-1 @4xl/content:row-start-1">
          <ClaimReviewDetails details={details} partnershipId={partnershipId} />
          <ClaimHistory events={history} />
        </div>
      </div>
    </section>
  );
}
