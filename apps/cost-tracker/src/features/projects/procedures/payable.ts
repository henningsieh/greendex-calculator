type Band = {
  minKm: string;
  maxKm: string;
  standardEur: string;
  greenEur: string;
};
type Entry = {
  amountEur: string;
  transportProfile: string;
  participantIds: string[];
};
type Journey = { participantId: string; distanceKm: string };

/** Convert exact persisted decimals to scaled integers; never round through JS Number. */
export function decimalUnits(value: string, scale: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid exact decimal");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > scale) throw new Error("Unsupported decimal precision");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0"))
  );
}

export function euros(cents: bigint): string {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

/** Each covered Participant is classified by their own approved allocated plane entries. */
export function derivePayable(
  entries: Entry[],
  journeys: Journey[],
  bands: Band[],
): string {
  const costs = entries.reduce(
    (sum, entry) => sum + decimalUnits(entry.amountEur, 2),
    BigInt(0),
  );
  const cap = journeys.reduce((sum, journey) => {
    const distance = decimalUnits(journey.distanceKm, 2);
    const band = bands.find(
      (row) =>
        distance >= decimalUnits(row.minKm, 2) &&
        distance <= decimalUnits(row.maxKm, 2),
    );
    if (!band)
      throw new Error(
        `No frozen funding band for Participation ${journey.participantId}.`,
      );
    const standard = entries.some(
      (entry) =>
        entry.transportProfile === "plane" &&
        entry.participantIds.includes(journey.participantId),
    );
    return sum + decimalUnits(standard ? band.standardEur : band.greenEur, 2);
  }, BigInt(0));
  return euros(costs < cap ? costs : cap);
}
