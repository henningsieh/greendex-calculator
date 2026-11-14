"use client";

import { useLocale, useTimeZone } from "next-intl";
import { useMemo } from "react";

import { createDateFormatter, type DateFormatter } from "./format";

/**
 * Localized date and time formatter bound to the active request locale and time
 * zone.
 *
 * Client Components use this instead of `Intl.DateTimeFormat` or
 * `Date.prototype.toLocale*`, so locale conventions come from CLDR and both
 * sides of hydration agree on the zone.
 */
export function useDateFormat(): DateFormatter {
  const locale = useLocale();
  // `useTimeZone` is declared optional even though both apps configure the
  // provider explicitly. The fallback satisfies that declaration; it is never the
  // render host's zone.
  const timeZone = useTimeZone() ?? "UTC";
  return useMemo(
    () => createDateFormatter({ locale, timeZone }),
    [locale, timeZone],
  );
}
