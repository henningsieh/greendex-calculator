"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClaimStatus } from "@/features/claims/claim-lifecycle";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";
import { cn } from "@/lib/utils";

interface ClaimSummaryAccount {
  accountHolder: string;
  iban: string;
  bic: string | null;
}

export interface ClaimSummaryProject {
  name: string;
  location: string;
  country: string;
  startDate: Date;
  endDate: Date;
}

interface ClaimSummaryItemProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

function ClaimSummaryItem({
  label,
  value,
  mono = false,
  className,
}: ClaimSummaryItemProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm font-medium wrap-anywhere",
          mono && "font-mono text-xs tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The shared identity block of a Claim: who it belongs to, where the Project
 * runs, which account will receive the money, and its current amount. Both the
 * Partner workspace and the Hosting review read this same card.
 */
export function ClaimSummary({
  status,
  project,
  partnerOrganization,
  hostingOrganization,
  payoutAccount,
  amount,
  amountLabel,
  submitted,
  submittedAt,
}: {
  status: ClaimStatus | null;
  project: ClaimSummaryProject;
  partnerOrganization?: string | null;
  hostingOrganization?: string | null;
  payoutAccount?: ClaimSummaryAccount | null;
  amount?: string | null;
  amountLabel: string;
  submitted?: boolean;
  submittedAt?: Date | null;
}) {
  const t = useTranslations("claims.summary");
  const dateFormat = useDateFormat();

  return (
    <Card data-testid="claim-summary">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle as="h2">{t("title")}</CardTitle>
            <p className="mt-3 text-xl font-semibold wrap-anywhere">
              {project.name}
            </p>
            <CardDescription className="mt-1">
              {[project.location, project.country].filter(Boolean).join(", ")}
            </CardDescription>
          </div>
          <ClaimStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 @4xl/content:grid-cols-4">
          <ClaimSummaryItem
            label={t("partner")}
            value={partnerOrganization ?? t("unknown")}
          />
          <ClaimSummaryItem
            label={t("hosting")}
            value={hostingOrganization ?? t("unknown")}
          />
          <ClaimSummaryItem
            label={t("schedule")}
            value={dateFormat.range(
              project.startDate,
              project.endDate,
              "date.medium",
            )}
          />
          <ClaimSummaryItem
            label={amountLabel}
            value={amount ?? t("notCalculated")}
            mono={Boolean(amount)}
          />
          <ClaimSummaryItem
            className="sm:col-span-2"
            label={t("payout")}
            mono={Boolean(payoutAccount)}
            value={
              payoutAccount
                ? `${payoutAccount.accountHolder} · ${payoutAccount.iban}`
                : t("noPayout")
            }
          />
          <ClaimSummaryItem
            label={t("submitted")}
            value={
              submittedAt
                ? dateFormat.format(submittedAt, "dateTime.short")
                : submitted
                  ? t("submitted")
                  : t("notSubmitted")
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}
