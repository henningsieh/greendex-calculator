import { getLocale, getTimeZone } from "next-intl/server";

import { createDateFormatter, type DateFormatter } from "./format";

/**
 * Localized formatter for Server Components and route handlers. Code without a
 * request (scripts, background email) calls `createDateFormatter` with an explicit
 * locale and time zone.
 */
export async function getDateFormat(): Promise<DateFormatter> {
  const [locale, timeZone] = await Promise.all([getLocale(), getTimeZone()]);
  return createDateFormatter({ locale, timeZone });
}
