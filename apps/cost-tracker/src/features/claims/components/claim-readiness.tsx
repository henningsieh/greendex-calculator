"use client";

import { useTranslations } from "@greendex/i18n/client";
import { CheckIcon, CircleDashedIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const itemLabelKeys = {
  payoutAccount: "item.payoutAccount",
  entries: "item.entries",
  proofDocuments: "item.proofDocuments",
  journeys: "item.journeys",
} as const;

export type ClaimReadinessItemKey = keyof typeof itemLabelKeys;

export interface ClaimReadinessItem {
  key: ClaimReadinessItemKey;
  passed: boolean;
  /** Evidence for the check, one line: an account, a receipt, a journey. */
  detail?: string;
}

/**
 * The submission checklist as a Claim document surface: what the workspace
 * verifies before a Claim can leave the Partnership, and the state of each
 * check. Presentation only — callers own the decision.
 */
export function ClaimReadiness({ items }: { items: ClaimReadinessItem[] }) {
  const t = useTranslations("claims.submission");
  const ready = items.every((item) => item.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li className="flex items-start gap-3 py-3" key={item.key}>
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
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t(itemLabelKeys[item.key])}
                </p>
                {item.detail ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
              </div>
              <span className="sr-only">
                {item.passed ? t("done") : t("open")}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
          <p
            className={cn(
              "inline-flex items-center gap-2",
              ready ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {ready ? (
              <CheckIcon aria-hidden="true" className="size-4 text-success" />
            ) : (
              <CircleDashedIcon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            )}
            {ready ? t("readyToSubmit") : t("inProgress")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
