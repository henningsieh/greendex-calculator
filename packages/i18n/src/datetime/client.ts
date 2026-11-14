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
  // Both apps configure the provider's zone explicitly. Falling back to UTC keeps
  // an unconfigured provider deterministic instead of inheriting the render host.
  const timeZone = useTimeZone() ?? "UTC";
  return useMemo(
    () => createDateFormatter({ locale, timeZone }),
    [locale, timeZone],
  );
}
