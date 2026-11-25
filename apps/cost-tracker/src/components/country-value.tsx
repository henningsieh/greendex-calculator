"use client";

import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { useLocale } from "@greendex/i18n/client";
import { useMemo } from "react";

import { CountryFlag } from "@/components/country-flag";
import { getEUCountryLabel } from "@/components/eu-country-names";

/**
 * One read-only country presentation for lists and detail rows: the flag tile
 * followed by the country name in the active locale. The stored ISO code stays
 * the domain value; only this boundary localizes it, so a list cell and its
 * card field always agree. A code outside the supported set renders nothing,
 * matching the flag tile rather than showing a broken presentation.
 */
export function CountryValue({
  code,
}: {
  code: string;
}): React.JSX.Element | null {
  const locale = useLocale();
  const countryCode = EU_COUNTRY_CODES.find((candidate) => candidate === code);
  const euCountryLabel = useMemo(
    () => (countryCode ? getEUCountryLabel(locale, countryCode) : null),
    [countryCode, locale],
  );

  if (!countryCode || !euCountryLabel) return null;

  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 align-middle"
      data-country={countryCode}
    >
      <CountryFlag code={countryCode} />
      <span className="min-w-0">{euCountryLabel}</span>
    </span>
  );
}
