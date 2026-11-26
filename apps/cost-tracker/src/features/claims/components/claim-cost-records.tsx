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
  "id" | "amountEur" | "transportProfile"
>;

export type ClaimCostRecord = TravelCostEntry & {
  /** Optional journey or scope shown beside the transport label. */
  detail?: string;
  /** Participants the cost is allocated across. */
  participants: number;
  /** Proof Documents linked to this cost. */
  receipts: number;
  allocation: "equal" | "amount" | "percentage";
  /** Explicit share for a non-equal method, as stored. */
  shareEur?: string;
  percentage?: string;
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
}: {
  rows: ClaimCostRecord[];
  total?: ClaimCostRecordTotal;
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
    if (row.participants > 1) {
      return t("document.equalShareDetail", {
        amount: money(Number(row.amountEur) / row.participants),
      });
    }
    return t("document.allocationEqual");
  }

  return (
    <div>
      <ul className="divide-y border-t border-border">
        {rows.map((row) => {
          const Icon = transportIcons[row.transportProfile];
          const missingReceipt = row.receipts === 0;

          return (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-5 py-4 sm:px-6"
              key={row.id}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 text-muted-foreground"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t(transportLabelKeys[row.transportProfile])}
                  {row.detail ? (
                    // The route is supporting detail; a narrow record keeps the
                    // ledger lines that carry the money.
                    <span className="hidden text-muted-foreground sm:inline">
                      {" "}
                      · {row.detail}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {allocationDetail(row)}
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
            </li>
          );
        })}
      </ul>
      {total ? (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {t("document.claimAmount")}
            </span>
            <span className="font-mono text-2xl tabular-nums">
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
