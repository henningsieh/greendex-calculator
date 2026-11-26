"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useFormatter } from "@greendex/i18n/client";
import { CheckIcon, CircleDashedIcon } from "lucide-react";

import { ErrorDetail } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { claimSubmissionAction } from "@/features/claims/claim-lifecycle";
import { useClaimSubmission } from "@/features/claims/use-claim-submission";
import { ChecklistFieldIssueSchema } from "@/lib/orpc/error-contract";
import type { Outputs } from "@/lib/orpc/router";
import { cn } from "@/lib/utils";

const itemLabelKeys = {
  payoutAccount: "item.payoutAccount",
  entries: "item.entries",
  entryDetails: "item.entryDetails",
  proofDocuments: "item.proofDocuments",
  participations: "item.participations",
  journeys: "item.journeys",
  fundingRules: "item.fundingRules",
} as const;

type Preview = NonNullable<Outputs["claims"]["previewSubmission"]>;

function gapAnchor(path: (string | number)[]) {
  const [root, id, detail] = path;
  if (root === "payoutAccount") return "claim-payout";
  if (root === "entries")
    return id
      ? `${detail === "proofDocuments" ? "proof" : "cost"}-${id}`
      : "claim-costs";
  if (root === "participations") {
    if (detail === "journey")
      return `${path.length === 3 ? "journey-gap" : "journey"}-${id}`;
    return detail === "fundingBand" ? `journey-${id}` : "claim-costs";
  }
  if (root === "journeys" || root === "fundingRules") return "claim-journeys";
  if (root === "proofDocuments") return "claim-proofs";
  return "claim-costs";
}

function ChecklistItem({
  item,
  label,
}: {
  item: Preview["items"][number];
  label: string;
}) {
  const t = useTranslations("claims.submission");

  return (
    <li className="flex gap-3 py-4" data-state={item.passed ? "passed" : "open"}>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          item.passed
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {item.passed ? (
          <CheckIcon aria-hidden="true" className="size-3.5" />
        ) : (
          <CircleDashedIcon aria-hidden="true" className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">
          {label}{" "}
          <span className="sr-only">{t(item.passed ? "done" : "open")}</span>
        </p>
        {item.gaps.map((gap, index) => {
          const parsed = ChecklistFieldIssueSchema.safeParse(gap);
          if (!parsed.success)
            return (
              <p
                className="text-sm text-muted-foreground"
                key={`invalid-${index}`}
              >
                <ErrorDetail issue={null} />
              </p>
            );
          const issue = parsed.data;
          return (
            <p
              className="text-sm text-muted-foreground"
              key={`${issue.path.join(".")}-${issue.id}`}
            >
              <a
                className="link-prose"
                data-testid={`submission-gap-${issue.path.join("-")}`}
                href={`#${gapAnchor(issue.path)}`}
              >
                {t("goToGap")}:{" "}
                <span>
                  <ErrorDetail issue={issue} />
                </span>
              </a>
            </p>
          );
        })}
      </div>
    </li>
  );
}

export function ClaimSubmission({
  partnershipId,
  preview,
  action,
  refresh,
}: {
  partnershipId: string;
  preview: Preview;
  action: ReturnType<typeof claimSubmissionAction>;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.submission");
  const format = useFormatter();
  const { confirming, pending, disabled, open, cancel, submit } =
    useClaimSubmission(partnershipId, action, preview, refresh);
  const ready = preview.items.every((item) => item.passed);
  const amount =
    preview.calculatedReimbursementEur === null
      ? null
      : format.number(Number(preview.calculatedReimbursementEur), {
          style: "currency",
          currency: "EUR",
        });

  return (
    <Card data-testid="claim-submission">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle as="h2">{t("title")}</CardTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              ready ? "text-success" : "text-muted-foreground",
            )}
          >
            {ready ? (
              <CheckIcon aria-hidden="true" className="size-3.5" />
            ) : (
              <CircleDashedIcon aria-hidden="true" className="size-3.5" />
            )}
            {ready ? t("readyToSubmit") : t("inProgress")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t("estimatedReimbursement")}
          </p>
          <p
            className="mt-1 font-mono text-2xl tabular-nums"
            data-testid="calculated-reimbursement"
            data-reimbursement={String(preview.calculatedReimbursementEur)}
          >
            {amount ?? t("unavailable")}
          </p>
          <p className="mt-2 text-xs/relaxed text-muted-foreground">
            {t("payableHelp")}
          </p>
        </div>
        <ul
          aria-label={t("checklistLabel")}
          className="divide-y divide-border"
          data-testid="submission-checklist"
        >
          {preview.items.map((item) => (
            <ChecklistItem
              item={item}
              key={item.key}
              label={t(itemLabelKeys[item.key])}
            />
          ))}
        </ul>
        {!confirming ? (
          <Button
            className="w-full"
            data-testid="claim-submit"
            disabled={disabled}
            onClick={open}
            size="lg"
            type="button"
            variant="default"
          >
            {t("submit")}
          </Button>
        ) : (
          <Alert role="alert" variant="info">
            <AlertDescription>{t("confirmDescription")}</AlertDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                data-testid="claim-submit-confirm"
                disabled={disabled}
                onClick={() => void submit()}
                size="lg"
                type="button"
                variant="default"
              >
                {t("confirm")}
              </Button>
              <Button
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
      </CardContent>
    </Card>
  );
}
