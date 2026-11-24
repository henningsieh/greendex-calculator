import {
  EU_COUNTRY_CODES,
  type EUCountryCode,
} from "@greendex/config/eu-countries";

interface EUCountryOption {
  code: EUCountryCode | "";
  label: string;
}

function regionNames(locale: string): Intl.DisplayNames | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  } catch {
    // Runtimes without DisplayNames or locale support can still offer ISO codes.
    return undefined;
  }
}

type RegionLabeler = (code: EUCountryCode) => string;

/**
 * Builds the localized-name lookup once, so a caller that labels the whole EU
 * set constructs two region formatters instead of two per country, and falls
 * back to English and then the ISO code in one place.
 */
function createRegionLabeler(locale: string): RegionLabeler {
  const english = regionNames("en");
  const localized = regionNames(locale);
  return (code) => localized?.of(code) || english?.of(code) || code;
}

export function getEUCountryLabel(locale: string, code: EUCountryCode): string {
  return createRegionLabeler(locale)(code);
}

export function getEUCountryOptions(locale: string): EUCountryOption[] {
  const label = createRegionLabeler(locale);
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(locale);
  } catch {
    collator = new Intl.Collator("en");
  }
  return EU_COUNTRY_CODES.map((code) => ({
    code,
    label: label(code),
  })).sort((a, b) => collator.compare(a.label, b.label));
}
