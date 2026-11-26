"use client";

import type { travelCostEntriesTable } from "@greendex/database/schema";
import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimStatusBadge } from "@/features/claims/components/claim-status-badge";
import type { Outputs } from "@/lib/orpc/router";
import { cn } from "@/lib/utils";

export function ClaimBand({
  title,
  status,
}: {
  title: string;
  status?: NonNullable<Outputs["claims"]["getDraft"]>["status"];
}) {
  const t = useTranslations("claims");

  return (
    <header>
      <Card variant="claim-band">
        <p className="w-full type-ember-eyebrow">{t("band.eyebrow")}</p>
        <CardTitle as="h2">{title}</CardTitle>
        {status && (
          <span className="inline-flex rounded-xl bg-card">
            <ClaimStatusBadge status={status} />
          </span>
        )}
      </Card>
    </header>
  );
}

/**
 * The in-document sibling of `Card variant="claim-band"`: the same dark band
 * and brand spine, sized to sit flush at the top of a Claim document card
 * instead of standing alone.
 */
export function ClaimBandHeader({
  title,
  subtitle,
  status,
  className,
}: {
  title: string;
  subtitle?: string;
  status: NonNullable<Outputs["claims"]["getDraft"]>["status"] | null;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative flex flex-wrap items-start justify-between gap-4 bg-claim-band px-6 py-5 text-claim-band-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-5 left-0 h-9 w-1.5 bg-brand"
      />
      <div className="min-w-0">
        {subtitle ? (
          <p className="text-sm text-claim-band-foreground/70">{subtitle}</p>
        ) : null}
        <p className="font-heading text-xl font-extrabold tracking-tight">
          {title}
        </p>
      </div>
      <span className="inline-flex rounded-xl bg-card">
        <ClaimStatusBadge status={status} />
      </span>
    </header>
  );
}

export function PayoutAccountLines({
  account,
}: {
  account: { accountHolder: string; iban: string; bic: string | null };
}) {
  const t = useTranslations("claims");

  return (
    <dl className="grid min-w-0 grid-cols-[130px_minmax(0,1fr)] gap-x-5 gap-y-2 max-sm:grid-cols-1">
      <dt className="text-muted-foreground">{t("document.accountHolder")}</dt>
      <dd className="wrap-anywhere" data-testid="payout-account-holder">
        {account.accountHolder}
      </dd>
      <dt className="text-muted-foreground">{t("document.iban")}</dt>
      <dd
        className="font-mono wrap-anywhere tabular-nums select-all"
        data-testid="payout-account-iban"
        data-iban={account.iban}
      >
        {account.iban}
      </dd>
      {account.bic && (
        <>
          <dt className="text-muted-foreground">{t("document.bic")}</dt>
          <dd
            data-testid="payout-bic"
            data-bic={account.bic}
            className="font-mono wrap-anywhere"
          >
            {account.bic}
          </dd>
        </>
      )}
    </dl>
  );
}

type ClaimCostRow = Pick<
  typeof travelCostEntriesTable.$inferSelect,
  "id" | "amountEur"
> & {
  // The server projects persisted enum columns as plain strings.
  transportProfile: string;
  allocationMethod: string;
  allocations: ReactNode;
  documents: ReactNode;
  action?: ReactNode;
};

// Presentation only: callers retain the complete server list and all edit/download authority.
export function ClaimCostTable({
  rows,
  actions = false,
}: {
  rows: ClaimCostRow[];
  actions?: boolean;
}) {
  const t = useTranslations("claims");

  return (
    <Table variant="accounting" data-testid="claim-cost-table">
      <TableCaption>{t("document.caption")}</TableCaption>
      <colgroup>
        <col className="w-[12%]" />
        <col className="w-[16%]" />
        <col className="w-[30%]" />
        <col className={actions ? "w-[28%]" : "w-[42%]"} />
        {actions && <col className="w-[14%]" />}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead variant="accounting" scope="col">
            {t("document.transport")}
          </TableHead>
          <TableHead variant="amount" scope="col">
            {t("document.totalEur")}
          </TableHead>
          <TableHead variant="accounting" scope="col">
            {t("document.costAllocations")}
          </TableHead>
          <TableHead variant="accounting" scope="col">
            {t("document.proofDocuments")}
          </TableHead>
          {actions && (
            <TableHead
              data-testid="claim-cost-action-header"
              variant="accounting"
              scope="col"
            >
              {t("document.action")}
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            id={`cost-${row.id}`}
            data-transport-profile={row.transportProfile}
            data-amount-eur={row.amountEur}
          >
            <TableCell variant="accounting">{row.transportProfile}</TableCell>
            <TableCell variant="amount">{row.amountEur}</TableCell>
            <TableCell variant="accounting">
              <p className="mb-2 font-semibold">
                {row.allocationMethod === "amount"
                  ? t("document.allocationAmount")
                  : row.allocationMethod === "percentage"
                    ? t("document.allocationPercentage")
                    : t("document.allocationEqual")}
              </p>
              {row.allocations}
            </TableCell>
            <TableCell variant="accounting">{row.documents}</TableCell>
            {actions && <TableCell variant="accounting">{row.action}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
