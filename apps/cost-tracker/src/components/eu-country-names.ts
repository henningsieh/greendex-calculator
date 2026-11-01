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
  // `si` remains the product route locale, not the Sinhala presentation locale.
  const presentationLocale = locale === "si" ? "sl" : locale;
  const english = regionNames("en");
  const localized = regionNames(presentationLocale);
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(presentationLocale);
  } catch {
    collator = new Intl.Collator("en");
  }
  return EU_COUNTRY_CODES.map((code) => ({
    code,
    label: localized?.of(code) || english?.of(code) || code,
  })).sort((a, b) => collator.compare(a.label, b.label));
}
