import {
  EU_COUNTRY_CODES,
  type EUCountryCode,
} from "@greendex/config/eu-countries";

export type EUCountryOption = { code: EUCountryCode | ""; label: string };

function regionNames(locale: string): Intl.DisplayNames | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  } catch {
    // Runtimes without DisplayNames or locale support can still offer ISO codes.
    return undefined;
  }
}

export function getEUCountryOptions(locale: string): EUCountryOption[] {
  const english = regionNames("en");
  const localized = regionNames(locale);
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(locale);
  } catch {
    collator = new Intl.Collator("en");
  }
  return EU_COUNTRY_CODES.map((code) => ({
    code,
    label: localized?.of(code) || english?.of(code) || code,
  })).sort((a, b) => collator.compare(a.label, b.label));
}
