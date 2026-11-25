"use client";

import type { ParticipantTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import type { travelCostEntriesTable } from "@greendex/database/schema";
import { useFormatter, useTranslations } from "@greendex/i18n/client";

import { cn } from "@/lib/utils";

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

export type ClaimCalculationLine = Pick<
  typeof travelCostEntriesTable.$inferSelect,
  "id" | "amountEur"
> & {
  // The server projects persisted enum columns as plain strings.
  transportProfile: ParticipantTransportEmissionProfile;
  detail: string;
};

export type ClaimCalculationTotal = Pick<
  typeof travelCostEntriesTable.$inferSelect,
  "amountEur"
> & { detail: string };

/**
 * The Claim arithmetic in three beats — entry, entry, Claim amount — with the
 * operator carried by each label so the sum reads without a diagram. Currency
 * figures are longer than a two-column phone raster holds, so the strip is one
 * figure per row until it can stand as a row of three.
 */
export function ClaimCalculation({
  addends,
  total,
}: {
  addends:
    | readonly [ClaimCalculationLine]
    | readonly [ClaimCalculationLine, ClaimCalculationLine];
  total: ClaimCalculationTotal;
}) {
  const t = useTranslations("claims");
  const format = useFormatter();

  const money = (amountEur: string) =>
    format.number(Number(amountEur), { style: "currency", currency: "EUR" });

  const cells = [
    ...addends.map((line, index) => ({
      id: line.id,
      amountEur: line.amountEur,
      detail: line.detail,
      label: `${index === 0 ? "" : "+ "}${t(transportLabelKeys[line.transportProfile])}`,
      hero: false,
    })),
    {
      id: "total",
      amountEur: total.amountEur,
      detail: total.detail,
      label: `= ${t("document.claimAmount")}`,
      hero: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_var(--glass-edge)]">
      <div
        className={cn(
          "grid divide-y divide-border md:divide-x md:divide-y-0",
          cells.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {cells.map((cell) => (
          <div
            className={cn("p-6 lg:p-8", cell.hero && "bg-(--hero-wash)")}
            key={cell.id}
          >
            <p className="type-ember-stat-number max-sm:text-[40px]">
              {money(cell.amountEur)}
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {cell.label}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground/70">
              {cell.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
