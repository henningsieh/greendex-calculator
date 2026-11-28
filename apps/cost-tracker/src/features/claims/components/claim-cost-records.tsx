"use client";

import type { ParticipantTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import type { travelCostEntriesTable } from "@greendex/database/schema";
import { useFormatter, useTranslations } from "@greendex/i18n/client";
import {
  BusIcon,
  CarFrontIcon,
  CheckIcon,
  CircleDashedIcon,
  PlaneIcon,
  ShipIcon,
  TrainFrontIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const transportIcons = {
  boat: ShipIcon,
  bus: BusIcon,
  car: CarFrontIcon,
  electricCar: CarFrontIcon,
  plane: PlaneIcon,
  train: TrainFrontIcon,
} as const satisfies Record<
  ParticipantTransportEmissionProfile,
  typeof TrainFrontIcon
>;

const transportLabelKeys = {
  boat: "transport.boat",
  bus: "transport.bus",
  car: "transport.car",
  electricCar: "transport.electricCar",
  plane: "transport.plane",
  train: "transport.train",
} as const satisfies Record<
  ParticipantTransportEmissionProfile,
  `transport.${ParticipantTransportEmissionProfile}`
>;

type TravelCostEntry = Pick<
  typeof travelCostEntriesTable.$inferSelect,
  "id" | "amountEur"
> & {
  // The server projects persisted enum columns as plain strings.
  transportProfile: string;
};

export type ClaimCostRecord = TravelCostEntry & {
  /** Optional journey or scope shown beside the transport label. */
  detail?: string;
  /** Participants the cost is allocated across. */
  participants: number;
  /** Proof Documents linked to this cost. */
  receipts: number;
  allocation: "equal" | "amount" | "percentage";
  /** Explicit allocation line when the stored method is not equal. */
  allocationDetail?: string;
  /** Explicit share for a non-equal method, as stored. */
  shareEur?: string;
  percentage?: string;
  /** Participant shares, rendered under the allocation line. */
  allocations?: ReactNode;
  /** Proof Document links, rendered under the receipts line. */
  documents?: ReactNode;
  /** Edit or review action for this row. */
  action?: ReactNode;
};

export type ClaimCostRecordTotal = Pick<
  typeof travelCostEntriesTable.$inferSelect,
  "amountEur"
> & { participants: number };

/**
 * The narrow composition of a Claim's Travel Cost Entries: the same cost,
 * allocation and Proof Document facts as `ClaimCostTable`, read as records
 * instead of columns so a Claim document holds its shape inside a card, a
 * phone, or a marketing preview.
 */
export function ClaimCostRecords({
  rows,
  total,
  testId = "claim-cost-records",
}: {
  rows: ClaimCostRecord[];
  total?: ClaimCostRecordTotal;
  testId?: string;
}) {
  const t = useTranslations("claims");
  const format = useFormatter();

  const money = (amountEur: string | number) =>
    format.number(Number(amountEur), { style: "currency", currency: "EUR" });

  function allocationDetail(row: ClaimCostRecord) {
    if (row.allocation === "percentage" && row.percentage !== undefined) {
      return t("document.percentageShareDetail", {
        percentage: row.percentage,
      });
    }
    if (row.allocation === "amount" && row.shareEur !== undefined) {
      return t("document.amountShareDetail", { amount: money(row.shareEur) });
    }
    return t("document.allocationEqual");
  }

  return (
    <div data-testid={testId}>
      <ul className="divide-y border-t border-border">
        {rows.map((row) => {
          const Icon =
            transportIcons[
              row.transportProfile as ParticipantTransportEmissionProfile
            ] ?? TrainFrontIcon;
          const transportLabel =
            transportLabelKeys[
              row.transportProfile as ParticipantTransportEmissionProfile
            ] ?? "transport.train";
          const missingReceipt = row.receipts === 0;

          return (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-5 py-4 sm:px-6"
              data-amount-eur={row.amountEur}
              data-transport-profile={row.transportProfile}
              id={`cost-${row.id}`}
              key={row.id}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 text-muted-foreground"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t(transportLabel)}
                  {row.detail ? (
                    // The route is supporting detail; a narrow record keeps the
                    // ledger lines that carry the money.
                    <span className="hidden text-muted-foreground sm:inline">
                      {" "}
                      · {row.detail}
                    </span>
                  ) : null}
                </p>
                {/* Single-word allocation details (de "Gleichmäßig")
                    cannot wrap otherwise and would burst the middle
                    column. */}
                <p className="mt-0.5 font-mono text-xs wrap-anywhere text-muted-foreground">
                  {row.allocationDetail ?? allocationDetail(row)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm tabular-nums">
                  {money(row.amountEur)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 font-mono text-xs",
                    missingReceipt ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {missingReceipt ? (
                    <CircleDashedIcon aria-hidden="true" className="size-3" />
                  ) : (
                    <CheckIcon aria-hidden="true" className="size-3" />
                  )}
                  {missingReceipt
                    ? t("document.receiptMissing")
                    : t("document.receipts", { count: row.receipts })}
                </p>
              </div>
              {row.allocations || row.documents || row.action ? (
                <div className="col-span-3 mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
                  <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
                    {row.allocations}
                    {row.documents}
                  </div>
                  {row.action ? (
                    <div className="shrink-0">{row.action}</div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {total ? (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          {/* The tabular total is one unbreakable token at text-2xl; let
              it take its own right-aligned line instead of widening the
              card at large text. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {t("document.claimAmount")}
            </span>
            <span
              className="ml-auto font-mono text-2xl tabular-nums"
              data-testid="claim-total-amount"
            >
              {money(total.amountEur)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("document.participants", { count: total.participants })} ·{" "}
            {t("document.fullyAllocated")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
