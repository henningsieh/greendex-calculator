"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

const labels = {
  payoutAccount: "Selected Payout Account",
  entries: "At least one Travel Cost Entry",
  entryDetails: "Valid transport, exact costs and allocations",
  proofDocuments: "Proof Documents linked to every cost",
  participations:
    "Covered Participations belong to this Partnership and have Journeys",
  journeys: "Complete Participant Journeys",
  fundingRules: "Relationship, exact-money and frozen funding rules",
};

type Preview = NonNullable<Outputs["claims"]["previewSubmission"]>;

function gapAnchor(path: string[]) {
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

export function ClaimSubmission({
  partnershipId,
  preview,
  refresh,
}: {
  partnershipId: string;
  preview: Preview;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.submission");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const ready =
    preview.items.length === 7 &&
    preview.items.every((item) => item.passed) &&
    preview.calculatedPayableEur !== null;
  async function submit() {
    setPending(true);
    setFeedback("");
    try {
      await orpc.claims.submit({ partnershipId });
      await refresh();
    } catch (error) {
      setConfirming(false);
      setFeedback(getORPCRequestErrorMessage(error).text);
      await refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="action">
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul
          aria-label={t("checklistLabel")}
          data-testid="submission-checklist"
          className="space-y-3"
        >
          {preview.items.map((item) => (
            <li key={item.key}>
              <p>
                {item.passed ? (
                  <Badge variant="status-pass">{t("pass")}</Badge>
                ) : (
                  <Badge variant="destructive">{t("fail")}</Badge>
                )}{" "}
                {labels[item.key]}
              </p>
              {item.gaps.map((gap) => (
                <p key={`${gap.path.join(".")}-${gap.message}`}>
                  <a
                    href={`#${gapAnchor(gap.path)}`}
                    data-testid={`submission-gap-${gap.path.join("-")}`}
                  >
                    {gap.message} {t("goToGap")}
                  </a>
                </p>
              ))}
              {item.passed && (
                <a href={`#${gapAnchor([item.key])}`}>{t("viewSection")}</a>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t pt-5">
          {t("calculatedPayable")}{" "}
          {preview.calculatedPayableEur === null ? (
            "Not available until the checklist passes"
          ) : (
            <span
              className="block font-mono tabular-nums"
              data-testid="calculated-payable"
              data-payable={String(preview.calculatedPayableEur)}
            >
              {preview.calculatedPayableEur} {t("currencyEur")}
            </span>
          )}{" "}
          {t("notEditable")}
        </p>
        {!confirming ? (
          <Button
            variant="default"
            size="lg"
            type="button"
            disabled={!ready || pending}
            data-testid="claim-submit"
            onClick={() => setConfirming(true)}
          >
            {t("submit")}
          </Button>
        ) : (
          <Alert>
            <AlertDescription>{t("confirmDescription")}</AlertDescription>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="lg"
                type="button"
                disabled={!ready || pending}
                data-testid="claim-submit-confirm"
                onClick={() => void submit()}
              >
                {t("confirm")}
              </Button>
              <Button
                size="lg"
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          </Alert>
        )}
        {feedback && <output role="alert">{feedback}</output>}
      </CardContent>
    </Card>
  );
}
