"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import {
  ErrorDetail,
  ErrorPresentation,
} from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canPartnerEditClaim } from "@/features/claims/claim-lifecycle";
import { CostEditor } from "@/features/claims/components/claim-cost-editor";
import {
  ClaimBand,
  PayoutAccountLines,
  claimStatusLabel,
} from "@/features/claims/components/claim-document";
import { JourneyEditor } from "@/features/claims/components/claim-journey-editor";
import { ClaimHistory } from "@/features/claims/components/claim-review";
import { ClaimSubmission } from "@/features/claims/components/claim-submission";
import { useParticipantEntryAccess } from "@/features/participant-onboarding/hooks/use-participant-entry-access";
import { getORPCErrorPresentation } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Cost = Outputs["costs"]["list"]["entries"][number];
type FieldErrors = Record<string, React.ReactNode>;

function errorsFor(error: unknown, root: string): FieldErrors {
  const presentation = getORPCErrorPresentation(error);
  const errors: FieldErrors = {};
  for (const issue of presentation.issues ?? []) {
    const path = issue.path.join(".");
    if (path) errors[path] = <ErrorDetail issue={issue} />;
  }
  if (presentation.key === "PAYOUT_ACCOUNT_REQUIRED")
    errors.payoutAccount = <ErrorPresentation error={error} />;
  if (!Object.keys(errors).length)
    errors[root] = <ErrorPresentation error={error} />;
  return errors;
}

function FieldError({ message }: { message?: React.ReactNode }) {
  return message ? (
    <div role="alert" className="text-sm text-destructive">
      {message}
    </div>
  ) : null;
}

function ProofEditor({
  partnershipId,
  entries,
  documents,
  editable,
  refresh,
}: {
  partnershipId: string;
  entries: Cost[];
  documents: Outputs["documents"]["list"];
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const [progress, setProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<React.ReactNode>("");
  const [busy, setBusy] = useState(false);
  function upload(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    const file =
      fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!file?.size) return;
    setBusy(true);
    setFeedback("");
    setProgress(0);
    const data = new FormData();
    data.set("partnershipId", partnershipId);
    data.set("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/proof-documents");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setBusy(false);
      if (request.status === 201) {
        setProgress(100);
        setFeedback("Proof Document uploaded.");
        form.reset();
        void refresh();
      } else {
        let body: unknown;
        try {
          body = JSON.parse(request.responseText);
        } catch {
          body = undefined;
        }
        setFeedback(
          <ErrorPresentation error={body} httpStatus={request.status} />,
        );
      }
    };
    request.onerror = () => {
      setBusy(false);
      setFeedback(<ErrorPresentation error={undefined} />);
    };
    request.send(data);
  }
  async function link(entryId: string, proofDocumentId: string) {
    setFeedback("");
    setBusy(true);
    try {
      await orpc.costs.linkDocument({ partnershipId, entryId, proofDocumentId });
      setFeedback("Proof Document linked.");
      await refresh();
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("proof.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" id="claim-proofs">
        {documents.length === 0 ? (
          <p>{t("proof.empty")}</p>
        ) : (
          <ul>
            {documents.map((document) => (
              <li key={document.id} className="wrap-anywhere">
                {document.originalFileName} ({document.byteSize}{" "}
                {t("proof.bytes")})
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="space-y-4" onSubmit={upload}>
            <Label htmlFor="proof-file">{t("proof.uploadLabel")}</Label>
            <Input
              variant="accounting"
              id="proof-file"
              data-testid="proof-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
            />
            <Button
              size="lg"
              variant="default"
              type="submit"
              disabled={busy}
              data-testid="proof-upload"
            >
              {t("proof.upload")}
            </Button>
          </form>
        )}
        {progress !== null && (
          <progress
            className="w-full accent-primary"
            value={progress}
            max={100}
            aria-label={t("proof.progressLabel")}
          >
            {t("proof.uploadProgress")} {progress}%
          </progress>
        )}
        {feedback && (
          <div data-testid="proof-feedback" aria-live="polite" aria-atomic="true">
            {feedback}
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} id={`proof-${entry.id}`}>
            <p>
              {entry.transportProfile}{" "}
              <span className="font-mono tabular-nums">
                {entry.amountEur} {t("proof.currencyEur")}
              </span>
            </p>
            <p className="wrap-anywhere">
              {t("proof.linked")}{" "}
              {entry.proofDocumentIds
                .map(
                  (id) =>
                    documents.find((document) => document.id === id)
                      ?.originalFileName ?? "Document",
                )
                .join(", ") || t("copy.none")}
            </p>
            {editable && (
              <div>
                <Label htmlFor={`link-${entry.id}`}>{t("proof.linkLabel")}</Label>
                <select
                  id={`link-${entry.id}`}
                  data-testid={`link-proof-${entry.id}`}
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  disabled={busy}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value)
                      void link(entry.id, event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">{t("proof.selectDocument")}</option>
                  {documents
                    .filter(
                      (document) => !entry.proofDocumentIds.includes(document.id),
                    )
                    .map((document) => (
                      <option
                        data-testid={`proof-option-${document.id}`}
                        key={document.id}
                        value={document.id}
                      >
                        {document.originalFileName}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SelectedClaimPayout({
  payout,
  editable,
}: {
  payout: Outputs["claims"]["listPayoutAccounts"];
  editable: boolean;
}) {
  const t = useTranslations("claims.workspace");
  const account = payout.accounts.find(
    (item) => item.id === payout.selectedPayoutAccountId,
  );
  if (!payout.selectedPayoutAccountId) return null;
  return account ? (
    <div className="my-5 space-y-3">
      <p>
        {t("payout.selected")}
        {editable && ` ${t("payout.changeHint")}`}
      </p>
      <PayoutAccountLines account={account} />
    </div>
  ) : (
    <p>
      {t("payout.unavailable")}
      {editable && ` · ${t("payout.changeHint")}`}
    </p>
  );
}

function ClaimStateNotice({
  draft,
  history,
}: {
  draft: Outputs["claims"]["getDraft"];
  history: Outputs["claims"]["getHistory"];
}) {
  const t = useTranslations("claims.workspace");

  if (!draft) return null;
  if (draft.status === "correction_requested")
    return (
      <Alert data-testid="claim-correction-notice">
        <AlertDescription>
          {t("notice.correctionRequested")}{" "}
          {history.findLast((event) => event.eventType === "correction_requested")
            ?.reason ?? t("copy.correctionHistory")}
          <p>{t("notice.correctionBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "rejected")
    return (
      <Alert>
        <AlertDescription>
          {t("notice.rejected")}{" "}
          {history.findLast((event) => event.eventType === "rejected")?.reason ??
            t("copy.rejectionHistory")}
          <p>{t("notice.rejectedBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "approved")
    return (
      <Alert>
        <AlertDescription>{t("notice.approved")}</AlertDescription>
      </Alert>
    );
  if (draft.status === "paid")
    return (
      <Alert>
        <AlertDescription>{t("notice.paid")}</AlertDescription>
      </Alert>
    );
  return null;
}

function ClaimDraftEditor({
  partnershipId,
  draft,
  payout,
  editable,
  refresh,
}: {
  partnershipId: string;
  draft: Outputs["claims"]["getDraft"];
  payout: Outputs["claims"]["listPayoutAccounts"];
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const client = useQueryClient();
  const input = { partnershipId };
  const [feedback, setFeedback] = useState<React.ReactNode>("");
  const [pending, setPending] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [accountErrors, setAccountErrors] = useState<FieldErrors>({});
  async function addAccount(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback("");
    setAccountErrors({});
    try {
      await orpc.claims.createPayoutAccount({
        partnershipId,
        accountHolder,
        iban,
        bic,
      });
      await client.invalidateQueries({
        queryKey: orpcQuery.claims.listPayoutAccounts.queryKey({ input }),
      });
      setAccountHolder("");
      setIban("");
      setBic("");
      setFeedback("Payout Account created. Select it to use it for this Claim.");
    } catch (error) {
      setAccountErrors(errorsFor(error, "account"));
    } finally {
      setPending(false);
    }
  }
  async function selectAccount(id: string) {
    if (!id) return;
    setPending(true);
    setFeedback("");
    try {
      await orpc.claims.selectPayoutAccount({
        partnershipId,
        payoutAccountId: id,
      });
      await refresh();
      setFeedback("Payout Account selected.");
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setPending(false);
    }
  }
  async function saveDraft() {
    setPending(true);
    setFeedback("");
    try {
      await orpc.claims.saveDraft(input);
      await refresh();
      setFeedback("Claim draft saved.");
    } catch (error) {
      setFeedback(
        errorsFor(error, "draft").payoutAccount ?? (
          <ErrorPresentation error={error} />
        ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("draft.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p data-draft-status={draft?.status ?? "none"}>
          {draft
            ? t("copy.savedClaim", { status: claimStatusLabel(draft.status) })
            : t("copy.noClaim")}
        </p>
        <div id="claim-payout">
          <Label htmlFor="claim-payout-select">{t("payout.title")}</Label>
          {payout.accounts.length ? (
            <select
              id="claim-payout-select"
              data-testid="claim-payout-select"
              className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              disabled={!editable || pending}
              value={payout.selectedPayoutAccountId ?? ""}
              onChange={(event) => void selectAccount(event.target.value)}
            >
              <option value="">{t("payout.selectAccount")}</option>
              {payout.accounts.map((account) => (
                <option
                  data-testid={`payout-option-${account.id}`}
                  key={account.id}
                  value={account.id}
                >
                  {account.accountHolder} · {account.iban}
                </option>
              ))}
            </select>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("payout.empty")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          <SelectedClaimPayout payout={payout} editable={editable} />
          {editable && (
            <form
              className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>p]:col-span-full"
              onSubmit={addAccount}
              noValidate
            >
              <p>{t("payout.create")}</p>
              <FieldError message={accountErrors.account} />
              <div className="sm:col-span-2">
                <Label htmlFor="account-holder">
                  {t("payout.accountHolder")}
                </Label>
                <Input
                  variant="accounting"
                  id="account-holder"
                  data-testid="account-holder"
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.accountHolder} />
              </div>
              <div>
                <Label htmlFor="account-iban">{t("payout.iban")}</Label>
                <Input
                  variant="figure"
                  id="account-iban"
                  data-testid="account-iban"
                  value={iban}
                  onChange={(event) => setIban(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.iban} />
              </div>
              <div>
                <Label htmlFor="account-bic">{t("payout.bic")}</Label>
                <Input
                  variant="figure"
                  id="account-bic"
                  value={bic}
                  onChange={(event) => setBic(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.bic} />
              </div>
              <Button
                size="lg"
                variant="default"
                type="submit"
                disabled={pending}
                data-testid="payout-account-create"
              >
                {t("payout.create")}
              </Button>
            </form>
          )}
        </div>
        {editable && !draft && (
          <Button
            variant="default"
            size="lg"
            type="button"
            disabled={pending || !payout.selectedPayoutAccountId}
            data-testid="claim-draft-save"
            onClick={() => void saveDraft()}
          >
            {t("payout.saveDraft")}
          </Button>
        )}
        {feedback && (
          <div aria-live="polite" aria-atomic="true">
            {feedback}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimWorkspace({ partnershipId }: { partnershipId: string }) {
  const t = useTranslations("claims.workspace");
  const client = useQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  const [
    draftQuery,
    payoutQuery,
    peopleQuery,
    journeysQuery,
    costsQuery,
    documentsQuery,
    previewQuery,
    historyQuery,
  ] = useSuspenseQueries({
    queries: [
      orpcQuery.claims.getDraft.queryOptions(options),
      orpcQuery.claims.listPayoutAccounts.queryOptions(options),
      orpcQuery.participations.listPartnership.queryOptions(options),
      orpcQuery.journeys.list.queryOptions(options),
      orpcQuery.costs.list.queryOptions(options),
      orpcQuery.documents.list.queryOptions(options),
      orpcQuery.claims.previewSubmission.queryOptions(options),
      orpcQuery.claims.getHistory.queryOptions(options),
    ],
  });
  const draft = draftQuery.data;
  const payout = payoutQuery.data;
  const people = peopleQuery.data;
  const journeys = journeysQuery.data;
  const costs = costsQuery.data;
  const documents = documentsQuery.data;
  const preview = previewQuery.data;
  const history = historyQuery.data;
  // The one Partner editing rule (ADR-0017), evaluated with the status the
  // server authorized: add and correct while the Claim is unsubmitted or
  // returned for correction. The screen keeps no status-to-action copy.
  const access = useParticipantEntryAccess(people.entryContext);
  const editable = access.permitted && canPartnerEditClaim(draft?.status);
  // Adding a journey needs no Claim; correcting a saved one needs the Claim that
  // records the correction, so the rule applies once a Claim exists.
  const corrections = Boolean(draft) && editable;
  const refresh = useCallback(async () => {
    const input = { partnershipId };
    await Promise.all([
      ...[
        orpcQuery.claims.getDraft,
        orpcQuery.claims.getHistory,
        orpcQuery.claims.previewSubmission,
        orpcQuery.claims.listPayoutAccounts,
        orpcQuery.journeys.list,
        orpcQuery.costs.list,
        orpcQuery.documents.list,
      ].map((query) =>
        client.invalidateQueries({ queryKey: query.queryKey({ input }) }),
      ),
      client.invalidateQueries({
        queryKey: orpcQuery.projects.get.key({ type: "query" }),
      }),
    ]);
  }, [client, partnershipId]);

  useEffect(() => {
    // History can replay the pre-mutation HTML/RSC snapshot into a new QueryClient.
    // Its hydration timestamp is not evidence that the Claim is still editable.
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation?.type === "back_forward") void refresh();

    function revalidateRestoredPage(event: PageTransitionEvent) {
      if (event.persisted) void refresh();
    }
    window.addEventListener("pageshow", revalidateRestoredPage);
    return () => window.removeEventListener("pageshow", revalidateRestoredPage);
  }, [refresh]);

  return (
    <section className="min-w-0" aria-label={t("label")}>
      <ClaimBand title={t("bandTitle")} status={draft?.status} />
      <div className="min-w-0 border border-t-0 bg-card">
        <div
          className={
            editable && preview
              ? "grid min-w-0 min-[961px]:grid-cols-[minmax(0,1fr)_340px]"
              : "min-w-0"
          }
        >
          {editable && preview && (
            <aside
              className="min-w-0 border-b bg-muted min-[961px]:col-start-2 min-[961px]:row-start-1 min-[961px]:border-b-0 min-[961px]:border-l"
              aria-label={t("submissionLabel")}
              data-testid="claim-submission"
            >
              <ClaimSubmission
                partnershipId={partnershipId}
                preview={preview}
                refresh={refresh}
              />
            </aside>
          )}
          <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
            <ClaimDraftEditor
              partnershipId={partnershipId}
              draft={draft}
              payout={payout}
              editable={editable}
              refresh={refresh}
            />
            <ClaimStateNotice draft={draft} history={history} />
            {draft && !editable && (
              <Alert data-testid="claim-locked">
                <AlertDescription>
                  {t("locked")}
                  {draft.approvedAmountEur && (
                    <> {t("copy.payable", { amount: draft.approvedAmountEur })}</>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <JourneyEditor
              partnershipId={partnershipId}
              participants={people.participations}
              saved={journeys}
              editable={editable}
              corrections={corrections}
              refresh={refresh}
            />
          </div>
        </div>
        {draft && (
          <>
            <CostEditor
              partnershipId={partnershipId}
              participants={people.participations}
              entries={costs.entries}
              documents={documents}
              editable={editable}
              refresh={refresh}
            />
            <ProofEditor
              partnershipId={partnershipId}
              entries={costs.entries}
              documents={documents}
              editable={editable}
              refresh={refresh}
            />
          </>
        )}

        {draft && <ClaimHistory events={history} />}
        {!draft && (
          <Alert>
            <AlertDescription>{t("noDraft")}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}
