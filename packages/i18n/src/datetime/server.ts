import { getLocale, getTimeZone } from "next-intl/server";

import {
  createDateFormatter,
  type DateFormatter,
  type DateFormatterConfig,
} from "./format";

/**
 * Localized date and time formatter for Server Components and route handlers.
 *
 * Callers outside a request — scripts, and email rendered from a background job —
 * pass an explicit locale and time zone to `createDateFormatter` instead, because
 * there is no request configuration to read.
 */
export async function getDateFormat(
  overrides: Partial<DateFormatterConfig> = {},
): Promise<DateFormatter> {
  const [locale, timeZone] = await Promise.all([
    overrides.locale ?? getLocale(),
    overrides.timeZone ?? getTimeZone(),
  ]);
  return createDateFormatter({ locale, timeZone });
}
