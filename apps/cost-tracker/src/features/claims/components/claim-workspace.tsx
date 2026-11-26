"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { ArchivedActionExplanation } from "@/components/archived-action-explanation";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  canCreateClaim,
  canPartnerEditClaim,
  claimSubmissionAction,
} from "@/features/claims/claim-lifecycle";
import { CostEditor } from "@/features/claims/components/claim-cost-editor";
import { PayoutAccountLines } from "@/features/claims/components/claim-document";
import { JourneyEditor } from "@/features/claims/components/claim-journey-editor";
import { ClaimHistory } from "@/features/claims/components/claim-review";
import { ClaimSubmission } from "@/features/claims/components/claim-submission";
import { ClaimSummary } from "@/features/claims/components/claim-summary";
import {
  PayoutAccountCreateSchema,
  type PayoutAccountCreateValues,
} from "@/features/claims/payout-validation";
import { useParticipantEntryAccess } from "@/features/participant-onboarding/hooks/use-participant-entry-access";
import { authClient } from "@/lib/auth-client";
import { getORPCErrorPresentation } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Cost = Outputs["costs"]["list"]["entries"][number];

function PayoutFieldError({ message }: { message?: string }) {
  const t = useTranslations("claims.workspace");
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {t(`payout.errors.${message}`)}
    </p>
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
        setFeedback(t("toast.proofUploaded"));
        toast.add({ title: t("toast.proofUploaded"), type: "success" });
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
        toast.add({ title: t("toast.actionFailed"), type: "error" });
      }
    };
    request.onerror = () => {
      setBusy(false);
      setFeedback(<ErrorPresentation error={undefined} />);
      toast.add({ title: t("toast.actionFailed"), type: "error" });
    };
    request.send(data);
  }

  async function link(entryId: string, proofDocumentId: string) {
    setFeedback("");
    setBusy(true);
    try {
      await orpc.costs.linkDocument({ partnershipId, entryId, proofDocumentId });
      setFeedback(t("toast.proofLinked"));
      toast.add({ title: t("toast.proofLinked"), type: "success" });
      await refresh();
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
      toast.add({ title: t("toast.actionFailed"), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("proof.title")}</CardTitle>
        <CardDescription>{t("proof.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5" id="claim-proofs">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("proof.empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {documents.map((document) => (
              <li
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                key={document.id}
              >
                <p className="min-w-0 text-sm font-medium wrap-anywhere">
                  {document.originalFileName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {document.byteSize} {t("proof.bytes")}
                </p>
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form
            className="grid gap-4 rounded-xl border border-border p-4"
            onSubmit={upload}
          >
            <Field>
              <FieldLabel htmlFor="proof-file">
                {t("proof.uploadLabel")}
              </FieldLabel>
              <Input
                accept="application/pdf,image/jpeg,image/png"
                data-testid="proof-file"
                id="proof-file"
                name="file"
                type="file"
                variant="accounting"
              />
            </Field>
            <Button
              data-testid="proof-upload"
              disabled={busy}
              size="sm"
              type="submit"
              variant="default"
            >
              {t("proof.upload")}
            </Button>
          </form>
        )}
        {progress !== null && (
          <progress
            aria-label={t("proof.progressLabel")}
            className="w-full accent-primary"
            max={100}
            value={progress}
          >
            {t("proof.uploadProgress")} {progress}%
          </progress>
        )}
        {feedback && (
          <div aria-live="polite" aria-atomic="true" data-testid="proof-feedback">
            {feedback}
          </div>
        )}
        {entries.map((entry) => (
          <div
            className="rounded-xl border border-border p-4"
            id={`proof-${entry.id}`}
            key={entry.id}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{entry.transportProfile}</p>
              <p className="font-mono text-sm tabular-nums">{entry.amountEur}</p>
            </div>
            <p className="mt-1 text-sm wrap-anywhere text-muted-foreground">
              {t("proof.linked")}{" "}
              {entry.proofDocumentIds
                .map(
                  (id) =>
                    documents.find((document) => document.id === id)
                      ?.originalFileName ?? t("proof.documentFallback"),
                )
                .join(", ") || t("proof.none")}
            </p>
            {editable && (
              <Field className="mt-3">
                <FieldLabel htmlFor={`link-${entry.id}`}>
                  {t("proof.linkLabel")}
                </FieldLabel>
                <select
                  className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  data-testid={`link-proof-${entry.id}`}
                  defaultValue=""
                  disabled={busy}
                  id={`link-${entry.id}`}
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
              </Field>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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
      <Alert data-testid="claim-correction-notice" variant="info">
        <AlertTitle>{t("notice.correctionRequested")}</AlertTitle>
        <AlertDescription>
          {history.findLast((event) => event.eventType === "correction_requested")
            ?.reason ?? t("copy.correctionHistory")}
          <p>{t("notice.correctionBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "rejected")
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("notice.rejected")}</AlertTitle>
        <AlertDescription>
          {history.findLast((event) => event.eventType === "rejected")?.reason ??
            t("copy.rejectionHistory")}
          <p>{t("notice.rejectedBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "approved")
    return (
      <Alert variant="success">
        <AlertTitle>{t("notice.approvedTitle")}</AlertTitle>
        <AlertDescription>{t("notice.approved")}</AlertDescription>
      </Alert>
    );
  if (draft.status === "paid")
    return (
      <Alert variant="success">
        <AlertTitle>{t("notice.paidTitle")}</AlertTitle>
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
  const input = { partnershipId };
  const [pending, setPending] = useState(false);
  const [optimisticSelection, setOptimisticSelection] = useState<string | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PayoutAccountCreateValues>({
    resolver: zodResolver(PayoutAccountCreateSchema),
    defaultValues: { accountHolder: "", iban: "", bic: "" },
  });
  const busy = pending || isSubmitting;
  const [createdAccounts, setCreatedAccounts] = useState<
    Outputs["claims"]["listPayoutAccounts"]["accounts"]
  >([]);
  const accounts = [
    ...payout.accounts,
    ...createdAccounts.filter(
      (created) => !payout.accounts.some((item) => item.id === created.id),
    ),
  ];
  const selectedId = optimisticSelection ?? payout.selectedPayoutAccountId ?? "";
  const account = accounts.find((item) => item.id === selectedId);

  const addAccount = handleSubmit(async (values) => {
    setPending(true);
    try {
      const created = await orpc.claims.createPayoutAccount({
        partnershipId,
        accountHolder: values.accountHolder,
        iban: values.iban,
        bic: values.bic,
      });
      setCreatedAccounts((current) => [...current, created]);
      reset();
      toast.add({ title: t("toast.payoutCreated"), type: "success" });
    } catch (error) {
      const presentation = getORPCErrorPresentation(error);
      let mapped = false;
      for (const issue of presentation.issues ?? []) {
        const field = issue.path[0];
        if (field === "accountHolder" || field === "iban" || field === "bic") {
          setError(field, { message: issue.id }, { shouldFocus: !mapped });
          mapped = true;
        }
      }
      if (!mapped) setError("root.server", { message: presentation.key });
      toast.add({ title: t("toast.actionFailed"), type: "error" });
    } finally {
      setPending(false);
    }
  });

  async function selectAccount(id: string) {
    if (!id) return;
    setOptimisticSelection(id);
    setPending(true);
    try {
      await orpc.claims.selectPayoutAccount({
        partnershipId,
        payoutAccountId: id,
      });
      await refresh();
      setOptimisticSelection(null);
      toast.add({ title: t("toast.payoutSelected"), type: "success" });
    } catch (error) {
      setOptimisticSelection(null);
      setError("root.server", { message: getORPCErrorPresentation(error).key });
      toast.add({ title: t("toast.actionFailed"), type: "error" });
    } finally {
      setPending(false);
    }
  }

  async function saveDraft() {
    setPending(true);
    try {
      await orpc.claims.saveDraft(input);
      await refresh();
      toast.add({ title: t("toast.claimCreated"), type: "success" });
    } catch (error) {
      setError("root.server", { message: getORPCErrorPresentation(error).key });
      toast.add({ title: t("toast.actionFailed"), type: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("setup.title")}</CardTitle>
        <CardDescription>{t("setup.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p
          className="text-sm text-muted-foreground"
          data-draft-status={draft?.status ?? "none"}
        >
          {draft
            ? t("copy.savedClaim", { status: t(`status.${draft.status}`) })
            : t("copy.noClaim")}
        </p>
        <div className="space-y-3" id="claim-payout">
          <Label htmlFor="claim-payout-select">{t("payout.title")}</Label>
          {accounts.length ? (
            <select
              className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              data-testid="claim-payout-select"
              disabled={!editable || busy}
              id="claim-payout-select"
              onChange={(event) => void selectAccount(event.target.value)}
              value={selectedId}
            >
              <option value="">{t("payout.selectAccount")}</option>
              {accounts.map((item) => (
                <option
                  data-testid={`payout-option-${item.id}`}
                  key={item.id}
                  value={item.id}
                >
                  {item.accountHolder} · {item.iban}
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
          {account && (
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("payout.selected")}
                {editable && ` ${t("payout.changeHint")}`}
              </p>
              <PayoutAccountLines account={account} />
            </div>
          )}
          {!account && payout.selectedPayoutAccountId && (
            <p className="text-sm text-muted-foreground">
              {t("payout.unavailable")}
            </p>
          )}
        </div>
        {editable && (
          <form
            className="grid gap-4 rounded-xl border border-border p-4"
            noValidate
            onSubmit={addAccount}
          >
            <p className="text-sm font-medium">{t("payout.create")}</p>
            {errors.root?.server && (
              <p className="text-sm text-destructive" role="alert">
                {t("payout.errors.server")}
              </p>
            )}
            <Field data-invalid={Boolean(errors.accountHolder)}>
              <FieldLabel htmlFor="account-holder">
                {t("payout.accountHolder")}
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.accountHolder)}
                data-testid="account-holder"
                disabled={busy}
                id="account-holder"
                variant="accounting"
                {...register("accountHolder")}
              />
              <PayoutFieldError message={errors.accountHolder?.message} />
            </Field>
            <Field data-invalid={Boolean(errors.iban)}>
              <FieldLabel htmlFor="account-iban">{t("payout.iban")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.iban)}
                data-testid="account-iban"
                disabled={busy}
                id="account-iban"
                variant="figure"
                {...register("iban")}
              />
              <PayoutFieldError message={errors.iban?.message} />
            </Field>
            <Field data-invalid={Boolean(errors.bic)}>
              <FieldLabel htmlFor="account-bic">{t("payout.bic")}</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.bic)}
                data-testid="account-bic"
                disabled={busy}
                id="account-bic"
                variant="figure"
                {...register("bic")}
              />
              <PayoutFieldError message={errors.bic?.message} />
            </Field>
            <Button
              data-testid="payout-account-create"
              disabled={busy}
              size="sm"
              type="submit"
              variant="default"
            >
              {t("payout.create")}
            </Button>
          </form>
        )}
        {editable && !draft && (
          <Button
            data-testid="claim-create"
            disabled={busy || !canCreateClaim(null, Boolean(selectedId))}
            onClick={() => void saveDraft()}
            size="lg"
            type="button"
            variant="default"
          >
            {t("payout.createClaim")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimWorkspace({ partnershipId }: { partnershipId: string }) {
  const client = useQueryClient();
  const { data: activeOrganization } = authClient.useActiveOrganization();
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
  const project = useSuspenseQuery(
    orpcQuery.projects.get.queryOptions({
      input: { projectId: people.projectId },
      meta: { costTrackerORPC: true },
    }),
  ).data;
  const access = useParticipantEntryAccess(people.entryContext);
  const editable = access.permitted && canPartnerEditClaim(draft?.status);
  const corrections = Boolean(draft) && editable;
  const selectedPayout =
    payout.accounts.find(
      (account) => account.id === payout.selectedPayoutAccountId,
    ) ?? null;
  const submittedAt =
    history.findLast((event) => event.eventType === "submitted")?.occurredAt ??
    null;
  const summary = summaryFor(project, activeOrganization?.name, draft, preview);
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
    <ClaimWorkspaceLayout
      corrections={corrections}
      costs={costs}
      documents={documents}
      draft={draft}
      editable={editable}
      history={history}
      journeys={journeys}
      partnershipId={partnershipId}
      people={people}
      payout={payout}
      preview={preview}
      project={project}
      refresh={refresh}
      selectedPayout={selectedPayout}
      submittedAt={submittedAt}
      summary={summary}
    />
  );
}

interface ClaimWorkspaceSummary {
  approved: boolean;
  amount: string | null;
  hostingOrganization?: string;
  partnerOrganization?: string;
}

function summaryFor(
  project: Outputs["projects"]["get"],
  activeOrganizationName: string | undefined,
  draft: Outputs["claims"]["getDraft"],
  preview: Outputs["claims"]["previewSubmission"],
): ClaimWorkspaceSummary {
  const isPartnerView = project.relationship === "partner";
  const approved = draft?.status === "approved" || draft?.status === "paid";
  const amount = approved
    ? (draft?.reimbursementAmountEur ?? null)
    : (preview?.calculatedReimbursementEur ?? null);

  return {
    approved,
    amount: amount === null ? null : String(amount),
    hostingOrganization: isPartnerView
      ? project.hostingOrganization.name
      : activeOrganizationName,
    partnerOrganization: isPartnerView
      ? activeOrganizationName
      : project.partnerOrganizations[0]?.organizationName,
  };
}

function ClaimWorkspaceLayout({
  corrections,
  costs,
  documents,
  draft,
  editable,
  history,
  journeys,
  partnershipId,
  people,
  payout,
  preview,
  project,
  refresh,
  selectedPayout,
  submittedAt,
  summary,
}: {
  corrections: boolean;
  costs: Outputs["costs"]["list"];
  documents: Outputs["documents"]["list"];
  draft: Outputs["claims"]["getDraft"];
  editable: boolean;
  history: Outputs["claims"]["getHistory"];
  journeys: Outputs["journeys"]["list"];
  partnershipId: string;
  people: Outputs["participations"]["listPartnership"];
  payout: Outputs["claims"]["listPayoutAccounts"];
  preview: Outputs["claims"]["previewSubmission"];
  project: Outputs["projects"]["get"];
  refresh: () => Promise<void>;
  selectedPayout:
    | Outputs["claims"]["listPayoutAccounts"]["accounts"][number]
    | null;
  submittedAt: Date | null;
  summary: ClaimWorkspaceSummary;
}) {
  const t = useTranslations("claims.workspace");
  const { amount, approved, hostingOrganization, partnerOrganization } = summary;

  return (
    <section aria-label={t("label")} className="min-w-0 space-y-6">
      <ClaimSummary
        amount={amount}
        amountLabel={
          approved ? t("summary.approvedAmount") : t("summary.estimatedAmount")
        }
        hostingOrganization={hostingOrganization}
        partnerOrganization={partnerOrganization}
        payoutAccount={selectedPayout}
        project={project}
        status={draft?.status ?? null}
        submitted={Boolean(draft && draft.status !== "in_preparation")}
        submittedAt={submittedAt}
      />
      {people.projectArchived && editable && <ArchivedActionExplanation />}
      <fieldset
        className="min-w-0 border-0 p-0"
        disabled={people.projectArchived && editable}
      >
        <div className="grid gap-6 @4xl/content:grid-cols-[minmax(0,1fr)_22rem]">
          <aside className="order-1 min-w-0 space-y-6 @4xl/content:sticky @4xl/content:top-6 @4xl/content:col-start-2 @4xl/content:row-start-1 @4xl/content:self-start">
            <ClaimStateNotice draft={draft} history={history} />
            <ClaimDraftEditor
              draft={draft}
              editable={editable}
              partnershipId={partnershipId}
              payout={payout}
              refresh={refresh}
            />
            {editable && preview && (
              <ClaimSubmission
                action={claimSubmissionAction(draft?.status ?? null)}
                partnershipId={partnershipId}
                preview={preview}
                refresh={refresh}
              />
            )}
          </aside>
          <div className="order-2 min-w-0 space-y-6 @4xl/content:col-start-1 @4xl/content:row-start-1">
            {draft && !editable && (
              <Alert data-testid="claim-locked">
                <AlertDescription>
                  {t("locked")}
                  {draft.reimbursementAmountEur && (
                    <>
                      {" "}
                      {t("copy.payable", {
                        amount: draft.reimbursementAmountEur,
                      })}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {!draft && (
              <Alert variant="info">
                <AlertDescription>{t("noDraft")}</AlertDescription>
              </Alert>
            )}
            <JourneyEditor
              corrections={corrections}
              editable={editable}
              participants={people.participations}
              partnershipId={partnershipId}
              refresh={refresh}
              saved={journeys}
            />
            {draft && (
              <>
                <CostEditor
                  documents={documents}
                  editable={editable}
                  entries={costs.entries}
                  participants={people.participations}
                  partnershipId={partnershipId}
                  refresh={refresh}
                />
                <ProofEditor
                  documents={documents}
                  editable={editable}
                  entries={costs.entries}
                  partnershipId={partnershipId}
                  refresh={refresh}
                />
                <ClaimHistory events={history} />
              </>
            )}
          </div>
        </div>
      </fieldset>
    </section>
  );
}
