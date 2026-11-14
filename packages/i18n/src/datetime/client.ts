"use client";

import { useLocale, useTimeZone } from "next-intl";
import { useMemo } from "react";

import { createDateFormatter, type DateFormatter } from "./format";

/**
 * Localized formatter bound to the active request locale and time zone. Client
 * Components use this instead of `Intl.DateTimeFormat` or `Date.prototype.toLocale*`.
 */
export function useDateFormat(): DateFormatter {
  const locale = useLocale();
  // Declared optional; both apps set it. The fallback is UTC, never the host zone.
  const timeZone = useTimeZone() ?? "UTC";
  return useMemo(
    () => createDateFormatter({ locale, timeZone }),
    [locale, timeZone],
  );
}
